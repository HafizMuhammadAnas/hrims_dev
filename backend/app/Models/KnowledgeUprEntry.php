<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KnowledgeUprEntry extends Model
{
    public const KIND_SUPPORTED = 'supported';

    public const KIND_NOTED = 'noted';

    public const KIND_OTHERS = 'others';

    /**
     * Fixed repository document slots shown on Knowledge Hub.
     *
     * @var list<string>
     */
    public const REPOSITORY_KEYS = [
        'upr_cycle',
        'matrix_of_recommendations',
        'national_report',
        'un_report',
        'civil_society_report',
        'outcome_review',
        'decision_of_the_outcome',
    ];

    /**
     * @var array<string, string>
     */
    public const REPOSITORY_LABELS = [
        'upr_cycle' => 'UPR cycle',
        'matrix_of_recommendations' => 'Matrix of recommendations',
        'national_report' => 'National report',
        'un_report' => 'UN report',
        'civil_society_report' => 'Civil society report',
        'outcome_review' => 'Outcome review',
        'decision_of_the_outcome' => 'Decision of the outcome',
    ];

    protected $fillable = [
        'kind',
        'title',
        'upr_cycle_id',
        'introduction',
        'repositories',
        'analysis_files',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'repositories' => 'array',
            'analysis_files' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(UprCycle::class, 'upr_cycle_id');
    }

    public function displayTitle(): string
    {
        $custom = trim((string) ($this->title ?? ''));
        if ($custom !== '') {
            return $custom;
        }

        return match ($this->kind) {
            self::KIND_SUPPORTED => 'Supported',
            self::KIND_NOTED => 'Noted',
            self::KIND_OTHERS => 'Others',
            default => ucfirst((string) $this->kind),
        };
    }

    /**
     * @param  mixed  $raw
     * @return array<string, array<string, mixed>|null>
     */
    public static function normalizeRepositories(mixed $raw): array
    {
        $input = is_array($raw) ? $raw : [];
        $out = [];
        foreach (self::REPOSITORY_KEYS as $key) {
            $doc = $input[$key] ?? null;
            $out[$key] = self::normalizeDocument($doc);
        }

        return $out;
    }

    /**
     * @param  mixed  $raw
     * @return list<array<string, mixed>>
     */
    public static function normalizeAnalysisFiles(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }
        $out = [];
        foreach ($raw as $row) {
            $doc = self::normalizeDocument($row);
            if ($doc !== null) {
                $out[] = $doc;
            }
        }

        return $out;
    }

    /**
     * @param  mixed  $raw
     * @return array<string, mixed>|null
     */
    private static function normalizeDocument(mixed $raw): ?array
    {
        if (! is_array($raw)) {
            return null;
        }
        $href = trim((string) ($raw['href'] ?? $raw['url'] ?? ''));
        $fileName = trim((string) ($raw['file_name'] ?? $raw['fileName'] ?? ''));
        $path = trim((string) ($raw['path'] ?? ''));
        if ($href === '' && $fileName === '' && $path === '') {
            return null;
        }

        return [
            'id' => (string) ($raw['id'] ?? ''),
            'title' => (string) ($raw['title'] ?? $fileName),
            'href' => $href,
            'type_label' => (string) ($raw['type_label'] ?? $raw['typeLabel'] ?? ''),
            'icon' => (string) ($raw['icon'] ?? '📄') ?: '📄',
            'file_name' => $fileName,
            'path' => $path,
        ];
    }
}
