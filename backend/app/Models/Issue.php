<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Issue extends Model
{
    protected $fillable = [
        'convention_id',
        'category_id',
        'entry_kind',
        'issue_title',
        'description',
        'has_quantitative',
        'has_qualitative',
    ];

    protected function casts(): array
    {
        return [
            'has_quantitative' => 'boolean',
            'has_qualitative' => 'boolean',
        ];
    }

    public function convention(): BelongsTo
    {
        return $this->belongsTo(Convention::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(IssueCategory::class, 'category_id');
    }

    public function articles(): BelongsToMany
    {
        return $this->belongsToMany(Article::class, 'issue_articles')
            ->withPivot('relevant_paragraph')
            ->withTimestamps();
    }

    public function indicators(): HasMany
    {
        return $this->hasMany(IssueIndicator::class);
    }

    public function hrRequests(): HasMany
    {
        return $this->hasMany(HrRequest::class, 'issue_id');
    }

    /**
     * Effective Q/L collection flags for an indicator row (legacy rows fall back to issue-level flags).
     *
     * @return array{has_quantitative: bool, has_qualitative: bool}
     */
    public function effectiveIndicatorFlags(IssueIndicator $ind): array
    {
        $q = (bool) $ind->has_quantitative;
        $l = (bool) $ind->has_qualitative;
        if (! $q && ! $l) {
            $q = (bool) $this->has_quantitative;
            $l = (bool) $this->has_qualitative;
        }

        return ['has_quantitative' => $q, 'has_qualitative' => $l];
    }
}

