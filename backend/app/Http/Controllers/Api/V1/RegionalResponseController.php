<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HrRequest;
use App\Models\RegionalResponse;
use App\Models\User;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RegionalResponseController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin')
            && ! $request->user()->hasRole('federal_admin')
            && ! $request->user()->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'hr_request_id' => ['required', 'string', 'exists:hr_requests,id'],
            'title' => ['required', 'string', 'max:500'],
            'content' => ['required', 'string'],
            'federal_group_id' => ['nullable', 'string', 'exists:federal_groups,id'],
        ]);

        $hrRequest = HrRequest::query()->find($data['hr_request_id']);
        if (! $hrRequest || $hrRequest->region_id === null) {
            return response()->json(['message' => 'Request has no region assignment'], 422);
        }

        $regionIds = HrimsAccess::scopedRegionIds($request->user());
        if ($regionIds !== null && ! in_array((int) $hrRequest->region_id, $regionIds, true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = RegionalResponse::query()->create([
            'id' => 'RES-'.strtoupper(Str::random(10)),
            'hr_request_id' => $hrRequest->id,
            'federal_group_id' => $data['federal_group_id'] ?? $hrRequest->federal_group_id,
            'region_id' => $hrRequest->region_id,
            'title' => $data['title'],
            'submission_date' => now()->toDateString(),
            'review_status' => 'pending',
            'comments' => null,
            'content' => $data['content'],
        ]);

        $model->load(['region', 'hrRequest']);

        return response()->json(['data' => $this->serialize($model)], 201);
    }

    public function update(Request $request, string $regionalResponse): JsonResponse
    {
        if (! $request->user()->hasRole('federal_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = RegionalResponse::query()->with(['region', 'hrRequest'])->find($regionalResponse);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $data = $request->validate([
            'review_status' => ['required', Rule::in(['pending', 'accepted', 'needs-modification', 'rejected'])],
            'comments' => ['nullable', 'string'],
        ]);

        $model->fill($data);
        $model->save();

        return response()->json(['data' => $this->serialize($model->fresh(['region', 'hrRequest']))]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = RegionalResponse::query()->with(['region', 'hrRequest']);
        $user = $request->user();

        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            // no filter
        } elseif ($user->hasRole('regional_admin') && $user->region_id !== null) {
            $query->where('region_id', $user->region_id);
        } elseif (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $ids = HrimsAccess::hrRequestIdsForDepartmentUser($user);
            if ($ids === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('hr_request_id', $ids);
            }
            if ($user->region_id !== null) {
                $query->where('region_id', $user->region_id);
            }
        } else {
            $query->whereRaw('1 = 0');
        }

        $rows = $query->orderByDesc('submission_date')->get();

        return response()->json([
            'data' => $rows->map(fn (RegionalResponse $r) => $this->serialize($r)),
        ]);
    }

    public function show(Request $request, string $regionalResponse): JsonResponse
    {
        $model = RegionalResponse::query()->with(['region', 'hrRequest'])->find($regionalResponse);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $this->userMayView($request->user(), $model)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json(['data' => $this->serialize($model)]);
    }

    private function userMayView(User $user, RegionalResponse $model): bool
    {
        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            return true;
        }

        if ($user->hasRole('regional_admin') && $user->region_id !== null) {
            return (int) $model->region_id === (int) $user->region_id;
        }

        if (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $ids = HrimsAccess::hrRequestIdsForDepartmentUser($user);

            return in_array($model->hr_request_id, $ids, true)
                && ($user->region_id === null || (int) $model->region_id === (int) $user->region_id);
        }

        return false;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(RegionalResponse $r): array
    {
        return [
            'id' => $r->id,
            'req_id' => $r->hr_request_id,
            'federal_id' => $r->federal_group_id,
            'region_name' => $r->region?->name,
            'title' => $r->title,
            'submission_date' => $r->submission_date->format('Y-m-d'),
            'review_status' => $r->review_status,
            'comments' => $r->comments,
            'content' => $r->content,
        ];
    }
}
