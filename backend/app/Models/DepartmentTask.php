<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepartmentTask extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'hr_request_id',
        'region_id',
        'department_id',
        'status',
        'regional_review_status',
        'regional_review_comments',
        'assigned_date',
        'assignment_instructions',
        'assigned_indicator_ids',
        'submission_date',
        'response_data',
        'attachment_url',
        'category_id',
        'subcategory_id',
        'indicator_id',
    ];

    protected function casts(): array
    {
        return [
            'assigned_date' => 'date',
            'submission_date' => 'date',
            'assigned_indicator_ids' => 'array',
        ];
    }

    public function hrRequest(): BelongsTo
    {
        return $this->belongsTo(HrRequest::class, 'hr_request_id');
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
