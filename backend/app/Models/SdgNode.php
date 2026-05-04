<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SdgNode extends Model
{
    protected $fillable = [
        'parent_id',
        'node_type',
        'code',
        'title',
        'knowledge_icon',
        'summary',
        'body',
        'stat_1_value',
        'stat_1_label',
        'stat_2_value',
        'stat_2_label',
        'goal_number',
        'sort_order',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
