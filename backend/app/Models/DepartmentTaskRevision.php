<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepartmentTaskRevision extends Model
{
    protected $fillable = [
        'department_task_id',
        'revision_no',
        'response_data',
        'attachment_url',
        'regional_review_status',
        'regional_review_comments',
        'revision_origin',
        'submitted_by_user_id',
    ];

    public function departmentTask(): BelongsTo
    {
        return $this->belongsTo(DepartmentTask::class, 'department_task_id', 'id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }
}
