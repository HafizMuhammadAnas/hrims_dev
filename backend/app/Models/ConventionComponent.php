<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConventionComponent extends Model
{
    protected $fillable = [
        'convention_id',
        'parent_id',
        'type',
        'code',
        'title',
        'body',
        'sort_order',
    ];

    public function convention(): BelongsTo
    {
        return $this->belongsTo(Convention::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
