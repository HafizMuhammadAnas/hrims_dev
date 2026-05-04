<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DepartmentTaskController extends Controller
{
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
        }

        $task->load(['region', 'department']);
        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => [
                'id' => $task->id,
                'req_id' => $task->hr_request_id,
                'region_name' => $task->region?->name,
                'department_id' => $task->department?->code ?? (string) $task->department_id,
                'department_name' => $task->department?->name,
                'status' => $task->status,
                'assigned_date' => $task->assigned_date->format('Y-m-d'),
                'submission_date' => $task->submission_date?->format('Y-m-d'),
                'response_data' => $redact ? null : $task->response_data,
                'attachment_url' => $redact ? null : $task->attachment_url,
            ],
        ], 201);
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
            'data' => $rows->map(fn (DepartmentTask $t) => [
                'id' => $t->id,
                'req_id' => $t->hr_request_id,
                'region_name' => $t->region?->name,
                'department_id' => $t->department?->code ?? (string) $t->department_id,
                'department_name' => $t->department?->name,
                'status' => $t->status,
                'assigned_date' => $t->assigned_date->format('Y-m-d'),
                'submission_date' => $t->submission_date?->format('Y-m-d'),
                'response_data' => $redact ? null : $t->response_data,
                'attachment_url' => $redact ? null : $t->attachment_url,
            ]),
        ]);
    }
}
