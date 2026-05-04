<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Convention extends Model
{
    protected $fillable = [
        'code',
        'name',
        'knowledge_icon',
        'knowledge_adopted',
        'knowledge_ratified',
        'knowledge_articles',
        'knowledge_implementation',
        'description',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function components(): HasMany
    {
        return $this->hasMany(ConventionComponent::class);
    }

    public function issues(): HasMany
    {
        return $this->hasMany(Issue::class);
    }

    public function hrRequests(): HasMany
    {
        return $this->hasMany(HrRequest::class, 'convention_id');
    }
}

