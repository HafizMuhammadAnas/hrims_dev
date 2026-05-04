<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrRequestAttachment extends Model
{
    protected $fillable = [
        'hr_request_id',
        'disk',
        'path',
        'original_name',
        'mime',
        'size',
    ];

    public function hrRequest(): BelongsTo
    {
        return $this->belongsTo(HrRequest::class, 'hr_request_id', 'id');
    }
}
