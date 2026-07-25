<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\Region;
use App\Models\RegionalResponse;
use App\Models\User;
use App\Support\HrimsAccess;
use App\Support\NotificationService;
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
            'content' => ['nullable', 'string'],
            'region_id' => ['sometimes', 'integer', 'exists:regions,id'],
        ]);

        $hrRequest = HrRequest::query()->with('regions')->find($data['hr_request_id']);
        if (! $hrRequest) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $user = $request->user();
        $targetRegionId = $this->resolveCompilationRegionId($user, $hrRequest, $data['region_id'] ?? null);
        if ($targetRegionId === null) {
            return response()->json(['message' => 'Could not determine region for this compilation.'], 422);
        }

        if (! $this->hrRequestTouchesRegion($hrRequest, $targetRegionId)) {
            return response()->json(['message' => 'This HR request is not assigned to the selected region.'], 422);
        }

        $dup = RegionalResponse::query()
            ->where('hr_request_id', $hrRequest->id)
            ->where('region_id', $targetRegionId)
            ->exists();
        if ($dup) {
            return response()->json(['message' => 'A compilation already exists for this request in this region.'], 422);
        }

        $model = RegionalResponse::query()->create([
            'id' => 'RES-'.strtoupper(Str::random(10)),
            'hr_request_id' => $hrRequest->id,
            'region_id' => $targetRegionId,
            'title' => $data['title'],
            'submission_date' => now()->toDateString(),
            'review_status' => 'pending',
            'comments' => null,
            'content' => $data['content'] ?? '',
        ]);

        $model->load(['region', 'hrRequest']);
        app(NotificationService::class)->notifyRegionalResponseCreated($model, $request->user());

        return response()->json(['data' => $this->serialize($model)], 201);
    }

    /**
     * Federal / super-admin review (POST so JSON body is not stripped by proxies).
     */
    public function review(Request $request, string $regionalResponse): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('federal_admin') && ! HrimsAccess::isConventionAdmin($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = RegionalResponse::query()->with(['region', 'hrRequest'])->find($regionalResponse);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if ($model->hrRequest && ! HrimsAccess::userMayViewHrRequest($user, $model->hrRequest)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'review_status' => ['required', Rule::in(['pending', 'accepted', 'needs-modification', 'rejected'])],
            'comments' => ['nullable', 'string'],
        ]);

        $previousStatus = $model->review_status;
        $model->review_status = $data['review_status'];
        $model->comments = $data['comments'] ?? null;
        if (! $model->save()) {
            return response()->json(['message' => 'Could not save review.'], 500);
        }

        $model->refresh();
        $model->load(['region', 'hrRequest']);

        app(NotificationService::class)->notifyRegionalResponseReviewed($model, $request->user(), $previousStatus);

        return response()
            ->json(['data' => $this->serialize($model)])
            ->header('Cache-Control', 'no-store, private');
    }

    /** Regional admin: resubmit compilation after federal requested changes. */
    public function update(Request $request, string $regionalResponse): JsonResponse
    {
        $model = RegionalResponse::query()->with(['region', 'hrRequest'])->find($regionalResponse);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $user = $request->user();

        $mayResubmit =
            ($user->hasRole('regional_admin') && $user->region_id !== null
                && (int) $model->region_id === (int) $user->region_id)
            || ($user->hasRole('federal_admin')
                && $model->region && in_array((string) $model->region->slug, ['ict', 'federal'], true));

        if ($mayResubmit) {
            if ($model->review_status !== 'needs-modification') {
                return response()->json(['message' => 'Only responses returned for modification can be updated.'], 422);
            }

            $data = $request->validate([
                'title' => ['required', 'string', 'max:500'],
                'content' => ['required', 'string'],
            ]);

            $model->title = $data['title'];
            $model->content = $data['content'];
            $model->review_status = 'pending';
            $model->save();

            return response()
                ->json(['data' => $this->serialize($model->fresh(['region', 'hrRequest']))])
                ->header('Cache-Control', 'no-store, private');
        }

        return response()->json(['message' => 'Forbidden'], 403);
    }

    public function index(Request $request): JsonResponse
    {
        $query = RegionalResponse::query()->with(['region', 'hrRequest']);
        $user = $request->user();

        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            // no filter
        } elseif (HrimsAccess::isConventionAdmin($user)) {
            $cid = HrimsAccess::conventionId($user);
            if ($cid === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereHas('hrRequest', fn ($q) => $q->where('convention_id', $cid));
            }
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

        $rows = $query->orderByDesc('submission_date')->orderByDesc('id')->get();

        return response()
            ->json([
                'data' => $rows->map(fn (RegionalResponse $r) => $this->serialize($r)),
            ])
            ->header('Cache-Control', 'no-store, private');
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

    /**
     * Department submissions for a regional compilation (federal / super-admin review).
     * Federal list endpoints only expose ICT tasks; provincial tasks are loaded here.
     */
    public function departmentTasks(Request $request, string $regionalResponse): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('super_admin') && ! $user->hasRole('federal_admin') && ! HrimsAccess::isConventionAdmin($user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = RegionalResponse::query()->with(['region'])->find($regionalResponse);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $this->userMayView($user, $model)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $tasks = DepartmentTask::query()
            ->with(['region', 'department'])
            ->where('hr_request_id', $model->hr_request_id)
            ->where('region_id', $model->region_id)
            ->orderBy('department_id')
            ->get();

        return response()
            ->json([
                'data' => $tasks->map(
                    fn (DepartmentTask $t) => DepartmentTaskController::serializeDepartmentTask($t, false),
                )->values()->all(),
            ])
            ->header('Cache-Control', 'no-store, private');
    }

    private function userMayView(User $user, RegionalResponse $model): bool
    {
        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            return true;
        }

        if (HrimsAccess::isConventionAdmin($user)) {
            $model->loadMissing('hrRequest');

            return $model->hrRequest
                ? HrimsAccess::userMayViewHrRequest($user, $model->hrRequest)
                : false;
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
    private function hrRequestTouchesRegion(HrRequest $hrRequest, int $regionId): bool
    {
        if ((int) $hrRequest->region_id === $regionId) {
            return true;
        }
        if ($hrRequest->regions()->where('regions.id', $regionId)->exists()) {
            return true;
        }

        return DepartmentTask::query()
            ->where('hr_request_id', $hrRequest->id)
            ->where('region_id', $regionId)
            ->exists();
    }

    private function resolveCompilationRegionId(User $user, HrRequest $hrRequest, ?int $requestedRegionId): ?int
    {
        if ($user->hasRole('regional_admin') && $user->region_id !== null) {
            $home = (int) $user->region_id;
            if ($requestedRegionId !== null && (int) $requestedRegionId !== $home) {
                return null;
            }

            return $home;
        }

        if ($user->hasRole('federal_admin') || $user->hasRole('super_admin')) {
            if ($requestedRegionId !== null) {
                $region = Region::query()->find($requestedRegionId);
                if (! $region || ! in_array((string) $region->slug, ['ict', 'federal'], true)) {
                    return null;
                }

                return (int) $region->id;
            }

            if ($hrRequest->region_id !== null) {
                return (int) $hrRequest->region_id;
            }
        }

        return null;
    }

    private function serialize(RegionalResponse $r): array
    {
        return [
            'id' => $r->id,
            'req_id' => $r->hr_request_id,
            'region_id' => $r->region_id,
            'region_slug' => $r->region?->slug,
            'region_name' => $r->region?->name,
            'title' => $r->title,
            'submission_date' => $r->submission_date->format('Y-m-d'),
            'review_status' => $r->review_status,
            'comments' => $r->comments,
            'content' => $r->content,
        ];
    }
}
