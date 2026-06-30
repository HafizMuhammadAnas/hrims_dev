<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CollectionGender extends Model
{
    protected $fillable = [
        'name',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function issueIndicators(): BelongsToMany
    {
        return $this->belongsToMany(IssueIndicator::class, 'issue_indicator_year_gender', 'collection_gender_id', 'issue_indicator_id')
            ->withTimestamps();
    }
}
