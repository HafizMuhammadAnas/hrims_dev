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
        'repositories',
        'optional_protocol_body',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'repositories' => 'array',
        ];
    }

    /**
     * @return list<array{id: string, title: string, documents: list<array{id: string, title: string, href: string, type_label: string, icon: string, file_name: string}>}>
     */
    public function normalizedRepositories(): array
    {
        return self::normalizeRepositories($this->repositories);
    }

    /**
     * @param  mixed  $raw
     * @return list<array{id: string, title: string, documents: list<array{id: string, title: string, href: string, type_label: string, icon: string, file_name: string}>}>
     */
    public static function normalizeRepositories(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $cycles = [];
        foreach ($raw as $cycle) {
            if (! is_array($cycle)) {
                continue;
            }
            $documents = [];
            $docsIn = $cycle['documents'] ?? [];
            if (is_array($docsIn)) {
                foreach ($docsIn as $doc) {
                    if (! is_array($doc)) {
                        continue;
                    }
                    $title = trim((string) ($doc['title'] ?? ''));
                    $href = trim((string) ($doc['href'] ?? $doc['url'] ?? ''));
                    if ($title === '' && $href === '') {
                        continue;
                    }
                    $documents[] = [
                        'id' => trim((string) ($doc['id'] ?? '')) ?: (string) count($documents),
                        'title' => $title,
                        'href' => $href,
                        'type_label' => trim((string) ($doc['type_label'] ?? $doc['typeLabel'] ?? '')),
                        'icon' => trim((string) ($doc['icon'] ?? '')) ?: '📄',
                        'file_name' => trim((string) ($doc['file_name'] ?? $doc['fileName'] ?? '')),
                    ];
                }
            }
            $cycleTitle = trim((string) ($cycle['title'] ?? ''));
            if ($cycleTitle === '' && $documents === []) {
                continue;
            }
            $cycles[] = [
                'id' => trim((string) ($cycle['id'] ?? '')) ?: (string) count($cycles),
                'title' => $cycleTitle !== '' ? $cycleTitle : 'Repository',
                'documents' => $documents,
            ];
        }

        return $cycles;
    }

    public function components(): HasMany
    {
        return $this->hasMany(ConventionComponent::class);
    }

    public function issues(): HasMany
    {
        return $this->hasMany(Issue::class);
    }

    public function articles(): HasMany
    {
        return $this->hasMany(Article::class);
    }

    public function hrRequests(): HasMany
    {
        return $this->hasMany(HrRequest::class, 'convention_id');
    }
}

