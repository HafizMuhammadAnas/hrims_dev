<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrRequestIndicatorResponse extends Model
{
    protected $fillable = [
        'hr_request_id',
        'issue_indicator_id',
        'quantitative_value',
        'qualitative_text',
    ];

    protected function casts(): array
    {
        return [
            'quantitative_value' => 'float',
        ];
    }

    public function hrRequest(): BelongsTo
    {
        return $this->belongsTo(HrRequest::class, 'hr_request_id', 'id');
    }

    public function issueIndicator(): BelongsTo
    {
        return $this->belongsTo(IssueIndicator::class, 'issue_indicator_id');
    }
}
