<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Support\HrimsAccess;
use App\Support\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DepartmentTaskController extends Controller
{
    /**
     * @return array<string, mixed>
     */
    private function serializeTask(DepartmentTask $t, bool $redact): array
    {
        $t->loadMissing(['region', 'department']);

        return [
            'id' => $t->id,
            'req_id' => $t->hr_request_id,
            'region_id' => $t->region_id,
            'region_name' => $t->region?->name,
            'department_id' => $t->department?->code ?? (string) $t->department_id,
            'department_name' => $t->department?->name,
            'status' => $t->status,
            'regional_review_status' => $t->regional_review_status,
            'regional_review_comments' => $t->regional_review_comments,
            'assigned_date' => $t->assigned_date->format('Y-m-d'),
            'submission_date' => $t->submission_date?->format('Y-m-d'),
            'response_data' => $redact ? null : $t->response_data,
            'attachment_url' => $redact ? null : $t->attachment_url,
        ];
    }

    public function store(Request $request): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'hr_request_id' => ['required', 'string', 'exists:hr_requests,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
        ]);

        $hrRequest = HrRequest::query()->find($data['hr_request_id']);
        if (! $hrRequest || $hrRequest->region_id === null) {
            return response()->json(['message' => 'Request has no region assignment'], 422);
        }

        $regionIds = HrimsAccess::scopedRegionIds($request->user());
        if ($regionIds !== null && ! in_array((int) $hrRequest->region_id, $regionIds, true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $department = Department::query()->with('regions')->find($data['department_id']);
        $reqRegionId = (int) $hrRequest->region_id;
        if (! $department || ! $department->regions->pluck('id')->contains($reqRegionId)) {
            return response()->json(['message' => 'Department must be linked to the same region as the request.'], 422);
        }

        $dup = DepartmentTask::query()
            ->where('hr_request_id', $hrRequest->id)
            ->where('department_id', $data['department_id'])
            ->where('region_id', $hrRequest->region_id)
            ->exists();
        if ($dup) {
            return response()->json(['message' => 'This department is already assigned to the request'], 422);
        }

        $task = DepartmentTask::query()->create([
            'id' => 'TSK-'.strtoupper(Str::random(10)),
            'hr_request_id' => $hrRequest->id,
            'region_id' => $hrRequest->region_id,
            'department_id' => $data['department_id'],
            'status' => 'assigned',
            'assigned_date' => now()->toDateString(),
        ]);

        if ($hrRequest->status === 'pending') {
            $hrRequest->update(['status' => 'in-progress']);
            app(NotificationService::class)->notifyHrRequestUpdated($hrRequest->fresh(['regions', 'departments']), $request->user(), 'pending');
        }

        $task->load(['region', 'department']);
        app(NotificationService::class)->notifyDepartmentTaskAssigned($task, $request->user());
        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($task, $redact),
        ], 201);
    }

    public function updateReview(Request $request, DepartmentTask $departmentTask): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('regional_admin') && ! $user->hasRole('federal_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($user->hasRole('regional_admin')) {
            if ($user->region_id === null || (int) $user->region_id !== (int) $departmentTask->region_id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $hasResponse = $departmentTask->submission_date !== null || $departmentTask->status === 'submitted';
        if (! $hasResponse) {
            return response()->json(['message' => 'This task has no departmental response yet.'], 422);
        }

        $data = $request->validate([
            'regional_review_status' => ['required', 'in:accepted,needs-modification'],
            'regional_review_comments' => ['nullable', 'string', 'max:20000'],
        ]);

        $departmentTask->update([
            'regional_review_status' => $data['regional_review_status'],
            'regional_review_comments' => $data['regional_review_comments'] ?? null,
        ]);

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($departmentTask->fresh(['region', 'department']), $redact),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = DepartmentTask::query()->with(['region', 'department']);

        if (HrimsAccess::seesAllRegions($user)) {
            // no filter
        } elseif (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $query->where('department_id', $user->department_id);
            if ($user->region_id) {
                $query->where('region_id', $user->region_id);
            }
        } else {
            $regionIds = HrimsAccess::scopedRegionIds($user);
            if ($regionIds !== null) {
                $query->whereIn('region_id', $regionIds);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $rows = $query->orderByDesc('assigned_date')->get();
        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($user);

        return response()->json([
            'data' => $rows->map(fn (DepartmentTask $t) => $this->serializeTask($t, $redact)),
        ]);
    }
}
