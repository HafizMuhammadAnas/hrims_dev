<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompiledRecord extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'hr_request_id',
        'title',
        'region_names',
        'compilation_date',
        'submitted_to',
        'submission_date',
        'status',
        'attachment',
        'summary',
    ];

    protected function casts(): array
    {
        return [
            'region_names' => 'array',
            'compilation_date' => 'date',
            'submission_date' => 'date',
        ];
    }

    public function hrRequest(): BelongsTo
    {
        return $this->belongsTo(HrRequest::class, 'hr_request_id');
    }
}
