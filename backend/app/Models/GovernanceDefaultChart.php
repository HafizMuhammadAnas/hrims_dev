<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GovernanceDefaultChart extends Model
{
    protected $fillable = [
        'sort_order',
        'kind',
        'title',
        'shape',
        'series_a_key',
        'series_a_label',
        'series_a_indicator_id',
        'series_b_key',
        'series_b_label',
        'series_b_indicator_id',
        'is_active',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'series_a_indicator_id' => 'integer',
        'series_b_indicator_id' => 'integer',
        'is_active' => 'boolean',
    ];

    public function seriesAIndicator(): BelongsTo
    {
        return $this->belongsTo(IssueIndicator::class, 'series_a_indicator_id');
    }

    public function seriesBIndicator(): BelongsTo
    {
        return $this->belongsTo(IssueIndicator::class, 'series_b_indicator_id');
    }
}
