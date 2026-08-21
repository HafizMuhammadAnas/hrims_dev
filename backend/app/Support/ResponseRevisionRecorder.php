<?php

namespace App\Support;

use App\Models\DepartmentTask;
use App\Models\DepartmentTaskRevision;
use App\Models\RegionalResponse;
use App\Models\RegionalResponseRevision;
use App\Models\User;
use Illuminate\Support\Facades\Schema;

class ResponseRevisionRecorder
{
    public const ORIGIN_FEDERAL_FOLLOW_UP = 'federal_follow_up';

    public const ORIGIN_REGIONAL = 'regional';

    public function snapshotRegionalResponse(RegionalResponse $response, ?User $actor = null): RegionalResponseRevision
    {
        $next = (int) RegionalResponseRevision::query()
            ->where('regional_response_id', $response->id)
            ->max('revision_no') + 1;

        return RegionalResponseRevision::query()->create([
            'regional_response_id' => $response->id,
            'revision_no' => max(1, $next),
            'title' => $response->title,
            'content' => $response->content,
            'review_status' => $response->review_status,
            'comments' => $response->comments,
            'submitted_by_user_id' => $actor?->id,
        ]);
    }

    public function snapshotDepartmentTask(DepartmentTask $task, ?User $actor = null): DepartmentTaskRevision
    {
        $next = (int) DepartmentTaskRevision::query()
            ->where('department_task_id', $task->id)
            ->max('revision_no') + 1;

        $origin = $this->resolveDepartmentRevisionOrigin($task);

        $payload = [
            'department_task_id' => $task->id,
            'revision_no' => max(1, $next),
            'response_data' => $task->response_data,
            'attachment_url' => $task->attachment_url,
            'regional_review_status' => $task->regional_review_status,
            'regional_review_comments' => $task->regional_review_comments,
            'submitted_by_user_id' => $actor?->id,
        ];
        if (Schema::hasColumn('department_task_revisions', 'revision_origin')) {
            $payload['revision_origin'] = $origin;
        }

        return DepartmentTaskRevision::query()->create($payload);
    }

    public function resolveDepartmentRevisionOrigin(DepartmentTask $task): string
    {
        $pending = trim((string) ($task->pending_revision_origin ?? ''));
        if ($pending === self::ORIGIN_FEDERAL_FOLLOW_UP || $pending === self::ORIGIN_REGIONAL) {
            return $pending;
        }

        return $this->inferOriginFromRegionalResponse($task);
    }

    public function inferOriginFromRegionalResponse(DepartmentTask $task): string
    {
        $regional = RegionalResponse::query()
            ->where('hr_request_id', $task->hr_request_id)
            ->where('region_id', $task->region_id)
            ->first();

        if ($regional && $regional->review_status === 'needs-modification') {
            return self::ORIGIN_FEDERAL_FOLLOW_UP;
        }

        return self::ORIGIN_REGIONAL;
    }
}
