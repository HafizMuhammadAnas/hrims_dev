<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssueIndicator extends Model
{
    protected $fillable = [
        'issue_id',
        'indicator_text',
        'disaggregation',
        'has_quantitative',
        'has_qualitative',
    ];

    protected function casts(): array
    {
        return [
            'has_quantitative' => 'boolean',
            'has_qualitative' => 'boolean',
        ];
    }

    public function issue(): BelongsTo
    {
        return $this->belongsTo(Issue::class);
    }
}
