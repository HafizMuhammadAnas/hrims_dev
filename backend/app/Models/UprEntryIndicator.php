<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UprEntryIndicator extends Model
{
    protected $fillable = [
        'upr_entry_id',
        'indicator_text',
        'has_quantitative',
        'has_qualitative',
        'collects_by_gender',
        'collects_by_age',
        'collects_by_location',
        'collects_by_disability',
        'collects_by_religion',
        'collects_by_consolidated',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'has_quantitative' => 'boolean',
            'has_qualitative' => 'boolean',
            'collects_by_gender' => 'boolean',
            'collects_by_age' => 'boolean',
            'collects_by_location' => 'boolean',
            'collects_by_disability' => 'boolean',
            'collects_by_religion' => 'boolean',
            'collects_by_consolidated' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(UprEntry::class, 'upr_entry_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminApiArray(): array
    {
        return [
            'id' => $this->id,
            'indicator_text' => $this->indicator_text,
            'has_quantitative' => (bool) $this->has_quantitative,
            'has_qualitative' => (bool) $this->has_qualitative,
            'collects_by_gender' => (bool) $this->collects_by_gender,
            'collects_by_age' => (bool) $this->collects_by_age,
            'collects_by_location' => (bool) $this->collects_by_location,
            'collects_by_disability' => (bool) $this->collects_by_disability,
            'collects_by_religion' => (bool) $this->collects_by_religion,
            'collects_by_consolidated' => (bool) $this->collects_by_consolidated,
            'sort_order' => (int) ($this->sort_order ?? 0),
            'is_active' => (bool) ($this->is_active ?? true),
        ];
    }
}
