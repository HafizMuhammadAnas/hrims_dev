<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UprRecommendationEntry extends Model
{
    protected $fillable = [
        'upr_cycle_id',
        'upr_category_id',
        'name',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(UprCycle::class, 'upr_cycle_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(UprCategory::class, 'upr_category_id');
    }
}
