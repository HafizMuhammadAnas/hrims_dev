<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\HrRequestClarificationResource;
use App\Models\HrRequest;
use App\Models\HrRequestClarification;
use App\Models\HrRequestClarificationAttachment;
use App\Models\User;
use App\Support\HrimsAccess;
use App\Support\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class HrRequestClarificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $query = HrRequestClarification::query()
            ->with(['region', 'hrRequest.regions', 'hrRequest.convention', 'attachments', 'requestedBy', 'respondedBy'])
            ->orderByDesc('updated_at')
            ->orderByDesc('id');

        if (HrimsAccess::seesAllRegions($user)) {
            if ($request->filled('status')) {
                $query->where('status', $request->string('status')->toString());
            }
        } elseif ($user->hasRole('regional_admin') && $user->region_id) {
            $query->where('region_id', (int) $user->region_id);
        } else {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($request->filled('hr_request_id')) {
            $query->where('hr_request_id', $request->string('hr_request_id')->toString());
        }

        return HrRequestClarificationResource::collection($query->get());
    }

    public function pendingFederalCount(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User || ! HrimsAccess::seesAllRegions($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $count = HrRequestClarification::query()
            ->where('status', 'pending_federal')
            ->count();

        return response()->json(['data' => ['count' => $count]]);
    }

    public function activeForRequest(Request $request, string $hrRequest): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $model = HrRequest::query()->find($hrRequest);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if (! HrimsAccess::userMayViewHrRequest($user, $model)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $regionId = $user->region_id;
        if (HrimsAccess::seesAllRegions($user) && $request->filled('region_id')) {
            $regionId = (int) $request->integer('region_id');
        }
        if (! $regionId) {
            return response()->json(['data' => null]);
        }

        $row = $this->latestActiveFor($hrRequest, (int) $regionId);
        if (! $row) {
            return response()->json(['data' => null]);
        }

        $row->load(['region', 'attachments', 'requestedBy', 'respondedBy']);

        return response()->json(['data' => new HrRequestClarificationResource($row)]);
    }

    public function show(Request $request, HrRequestClarification $hrRequestClarification): HrRequestClarificationResource|JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        if (! $this->userMayAccess($user, $hrRequestClarification)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $hrRequestClarification->load([
            'region',
            'hrRequest.regions',
            'hrRequest.convention',
            'hrRequest.issue.category',
            'hrRequest.issue.articles',
            'hrRequest.issue.indicators',
            'hrRequest.attachments',
            'hrRequest.indicatorResponses',
            'hrRequest.departments',
            'attachments',
            'requestedBy',
            'respondedBy',
        ]);

        return new HrRequestClarificationResource($hrRequestClarification);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User || ! $user->hasRole('regional_admin') || ! $user->region_id) {
            return response()->json(['message' => 'Only regional administrators can request clarification.'], 403);
        }

        $data = $request->validate([
            'hr_request_id' => ['required', 'string', 'exists:hr_requests,id'],
            'region_message' => ['required', 'string', 'max:20000'],
            'attachment' => ['nullable', 'file', 'max:15360'],
        ]);

        $hrRequest = HrRequest::query()->with('regions')->findOrFail($data['hr_request_id']);
        if (! HrimsAccess::userMayViewHrRequest($user, $hrRequest)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $regionId = (int) $user->region_id;
        $existing = $this->latestActiveFor($hrRequest->id, $regionId);
        if ($existing && $existing->status === 'pending_federal') {
            return response()->json(['message' => 'A clarification request is already awaiting federal response.'], 422);
        }

        $hasTasks = \App\Models\DepartmentTask::query()
            ->where('hr_request_id', $hrRequest->id)
            ->where('region_id', $regionId)
            ->exists();
        if ($hasTasks) {
            return response()->json(['message' => 'Departments are already assigned for this request.'], 422);
        }

        $row = DB::transaction(function () use ($request, $user, $data, $regionId, $existing) {
            if ($existing && $existing->status === 'pending_region') {
                $existing->update([
                    'status' => 'pending_federal',
                    'region_message' => $data['region_message'],
                    'region_submitted_at' => now(),
                    'requested_by_user_id' => $user->id,
                ]);
                $existing->attachments()->where('side', 'region')->delete();
                $row = $existing;
            } else {
                $row = HrRequestClarification::query()->create([
                    'hr_request_id' => $data['hr_request_id'],
                    'region_id' => $regionId,
                    'status' => 'pending_federal',
                    'region_message' => $data['region_message'],
                    'requested_by_user_id' => $user->id,
                    'region_submitted_at' => now(),
                ]);
            }

            if ($request->hasFile('attachment')) {
                $this->storeAttachment($row, $request->file('attachment'), 'region');
            }

            return $row;
        });

        $row->load(['region', 'attachments', 'requestedBy']);

        app(NotificationService::class)->notifyClarificationRequested($row, $user);

        return response()->json(['data' => new HrRequestClarificationResource($row)], 201);
    }

    public function respond(Request $request, HrRequestClarification $hrRequestClarification): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User || ! HrimsAccess::seesAllRegions($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($hrRequestClarification->status !== 'pending_federal') {
            return response()->json(['message' => 'This clarification is not awaiting a federal response.'], 422);
        }

        $data = $request->validate([
            'federal_response' => ['required', 'string', 'max:20000'],
            'attachment' => ['nullable', 'file', 'max:15360'],
        ]);

        DB::transaction(function () use ($request, $user, $data, $hrRequestClarification) {
            $hrRequestClarification->update([
                'federal_response' => $data['federal_response'],
                'status' => 'pending_region',
                'responded_by_user_id' => $user->id,
                'federal_responded_at' => now(),
            ]);
            $hrRequestClarification->attachments()->where('side', 'federal')->delete();
            if ($request->hasFile('attachment')) {
                $this->storeAttachment($hrRequestClarification, $request->file('attachment'), 'federal');
            }
        });

        $hrRequestClarification->load(['region', 'attachments', 'requestedBy', 'respondedBy', 'hrRequest']);

        app(NotificationService::class)->notifyClarificationAnswered($hrRequestClarification, $user);

        return response()->json(['data' => new HrRequestClarificationResource($hrRequestClarification->fresh(['region', 'attachments', 'requestedBy', 'respondedBy']))]);
    }

    public function close(Request $request, HrRequestClarification $hrRequestClarification): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        if (! $this->userMayAccess($user, $hrRequestClarification)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $hrRequestClarification->update(['status' => 'closed']);

        return response()->json(['data' => new HrRequestClarificationResource($hrRequestClarification->fresh(['region', 'attachments']))]);
    }

    public function downloadAttachment(
        Request $request,
        HrRequestClarification $hrRequestClarification,
        HrRequestClarificationAttachment $attachment,
    ): Response|JsonResponse {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        if ((int) $attachment->hr_request_clarification_id !== (int) $hrRequestClarification->id) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if (! $this->userMayAccess($user, $hrRequestClarification)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (! Storage::disk($attachment->disk)->exists($attachment->path)) {
            return response()->json(['message' => 'File missing'], 404);
        }

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name);
    }

    private function latestActiveFor(string $hrRequestId, int $regionId): ?HrRequestClarification
    {
        return HrRequestClarification::query()
            ->where('hr_request_id', $hrRequestId)
            ->where('region_id', $regionId)
            ->whereIn('status', ['pending_federal', 'pending_region'])
            ->orderByDesc('id')
            ->first();
    }

    private function userMayAccess(User $user, HrRequestClarification $row): bool
    {
        if (HrimsAccess::seesAllRegions($user)) {
            return true;
        }
        if ($user->hasRole('regional_admin') && $user->region_id) {
            return (int) $row->region_id === (int) $user->region_id;
        }

        return false;
    }

    private function storeAttachment(HrRequestClarification $row, \Illuminate\Http\UploadedFile $file, string $side): void
    {
        if (! $file->isValid()) {
            return;
        }
        $path = $file->store('hr-clarifications/'.$row->id, 'public');
        HrRequestClarificationAttachment::query()->create([
            'hr_request_clarification_id' => $row->id,
            'side' => $side,
            'disk' => 'public',
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime' => $file->getClientMimeType(),
            'size' => $file->getSize(),
        ]);
    }
}
