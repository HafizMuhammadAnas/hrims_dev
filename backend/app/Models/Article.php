<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Article extends Model
{
    protected $fillable = [
        'article_name',
    ];

    public function issues(): BelongsToMany
    {
        return $this->belongsToMany(Issue::class, 'issue_articles')->withTimestamps();
    }
}
