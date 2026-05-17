<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrRequestClarification extends Model
{
    protected $fillable = [
        'hr_request_id',
        'region_id',
        'status',
        'region_message',
        'federal_response',
        'requested_by_user_id',
        'responded_by_user_id',
        'region_submitted_at',
        'federal_responded_at',
    ];

    protected function casts(): array
    {
        return [
            'region_submitted_at' => 'datetime',
            'federal_responded_at' => 'datetime',
        ];
    }

    public function hrRequest(): BelongsTo
    {
        return $this->belongsTo(HrRequest::class, 'hr_request_id', 'id');
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(HrRequestClarificationAttachment::class, 'hr_request_clarification_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    public function respondedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responded_by_user_id');
    }
}
