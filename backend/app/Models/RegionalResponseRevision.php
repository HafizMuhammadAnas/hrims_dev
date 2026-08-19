<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegionalResponseRevision extends Model
{
    protected $fillable = [
        'regional_response_id',
        'revision_no',
        'title',
        'content',
        'review_status',
        'comments',
        'submitted_by_user_id',
    ];

    public function regionalResponse(): BelongsTo
    {
        return $this->belongsTo(RegionalResponse::class, 'regional_response_id', 'id');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }
}
