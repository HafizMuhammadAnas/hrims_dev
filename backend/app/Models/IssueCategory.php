<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IssueCategory extends Model
{
    protected $fillable = [
        'name',
    ];

    public function issues(): HasMany
    {
        return $this->hasMany(Issue::class, 'category_id');
    }
}
