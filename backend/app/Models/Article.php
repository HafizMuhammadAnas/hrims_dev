<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Article extends Model
{
    protected $fillable = [
        'convention_id',
        'article_name',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function convention(): BelongsTo
    {
        return $this->belongsTo(Convention::class);
    }

    public function issues(): BelongsToMany
    {
        return $this->belongsToMany(Issue::class, 'issue_articles')->withTimestamps();
    }

    /**
     * First integer found in the article title (e.g. "Article 12" → 12).
     * Titles without a number sort after numbered articles.
     */
    public static function naturalNumberFromName(?string $name): ?int
    {
        if ($name === null || $name === '') {
            return null;
        }

        if (preg_match('/(\d+)/', $name, $matches) !== 1) {
            return null;
        }

        return (int) $matches[1];
    }

    /**
     * Sort Article 1, 2, 3 … 10 (not alphabetical Article 1, 10, 11, 2).
     * Non-numbered titles (e.g. "Followup") come after numbered ones, A–Z.
     *
     * @param  iterable<int, self>  $articles
     * @return \Illuminate\Support\Collection<int, self>
     */
    public static function sortByNaturalName(iterable $articles): \Illuminate\Support\Collection
    {
        return collect($articles)
            ->sort(function (self $a, self $b): int {
                $numA = self::naturalNumberFromName($a->article_name);
                $numB = self::naturalNumberFromName($b->article_name);

                if ($numA !== null && $numB !== null && $numA !== $numB) {
                    return $numA <=> $numB;
                }
                if ($numA !== null && $numB === null) {
                    return -1;
                }
                if ($numA === null && $numB !== null) {
                    return 1;
                }

                $byName = strnatcasecmp((string) $a->article_name, (string) $b->article_name);
                if ($byName !== 0) {
                    return $byName;
                }

                return ((int) $a->id) <=> ((int) $b->id);
            })
            ->values();
    }
}
