<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrRequest extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $table = 'hr_requests';

    protected $fillable = [
        'id',
        'title',
        'conv',
        'region_id',
        'due_date',
        'status',
        'details',
        'attachment_file_name',
        'category_id',
        'subcategory_id',
        'indicator_id',
        'recommendation_id',
        'sdg',
        'sdg_indicator',
        'upr',
        'upr_indicator',
        'issue_cards',
        'convention_id',
        'issue_id',
        'request_type',
        'other_issue_text',
        'reporting_framework',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'issue_cards' => 'array',
        ];
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function regions(): BelongsToMany
    {
        return $this->belongsToMany(Region::class, 'hr_request_region', 'hr_request_id', 'region_id');
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'hr_request_department', 'hr_request_id', 'department_id');
    }

    public function convention(): BelongsTo
    {
        return $this->belongsTo(Convention::class);
    }

    public function issue(): BelongsTo
    {
        return $this->belongsTo(Issue::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(HrRequestAttachment::class, 'hr_request_id', 'id');
    }

    public function indicatorResponses(): HasMany
    {
        return $this->hasMany(HrRequestIndicatorResponse::class, 'hr_request_id', 'id');
    }

    public function indicatorYears(): HasMany
    {
        return $this->hasMany(HrRequestIndicatorYear::class, 'hr_request_id', 'id');
    }

    public function regionalResponses(): HasMany
    {
        return $this->hasMany(RegionalResponse::class, 'hr_request_id');
    }

    public function compiledRecords(): HasMany
    {
        return $this->hasMany(CompiledRecord::class, 'hr_request_id');
    }

    public function departmentTasks(): HasMany
    {
        return $this->hasMany(DepartmentTask::class, 'hr_request_id');
    }
}
