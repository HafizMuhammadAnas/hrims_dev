<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrRequestClarificationAttachment extends Model
{
    protected $fillable = [
        'hr_request_clarification_id',
        'side',
        'disk',
        'path',
        'original_name',
        'mime',
        'size',
    ];

    public function clarification(): BelongsTo
    {
        return $this->belongsTo(HrRequestClarification::class, 'hr_request_clarification_id');
    }
}
