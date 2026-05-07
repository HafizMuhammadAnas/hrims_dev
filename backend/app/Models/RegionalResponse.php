<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegionalResponse extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'hr_request_id',
        'region_id',
        'title',
        'submission_date',
        'review_status',
        'comments',
        'content',
    ];

    protected function casts(): array
    {
        return [
            'submission_date' => 'date',
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
}
