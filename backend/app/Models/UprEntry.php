<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UprEntry extends Model
{
    protected $fillable = [
        'upr_type_id',
        'upr_cycle_id',
        'upr_category_id',
        'is_dummy',
        'has_quantitative',
        'has_qualitative',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_dummy' => 'boolean',
            'has_quantitative' => 'boolean',
            'has_qualitative' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(UprType::class, 'upr_type_id');
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(UprCycle::class, 'upr_cycle_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(UprCategory::class, 'upr_category_id');
    }

    public function recommendations(): BelongsToMany
    {
        return $this->belongsToMany(
            UprRecommendationEntry::class,
            'upr_entry_recommendation',
            'upr_entry_id',
            'upr_recommendation_entry_id',
        )->withTimestamps();
    }

    public function indicators(): HasMany
    {
        return $this->hasMany(UprEntryIndicator::class)->orderBy('sort_order')->orderBy('id');
    }
}
