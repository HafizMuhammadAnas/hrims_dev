<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class KnowledgeUprEntry extends Model
{
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
        'upr_type_id',
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

    public function type(): BelongsTo
    {
        return $this->belongsTo(UprType::class, 'upr_type_id');
    }

    public function displayTitle(): string
    {
        if ($this->relationLoaded('cycle') && $this->cycle) {
            $cycleName = trim((string) $this->cycle->name);
            if ($cycleName !== '') {
                return $cycleName;
            }
        }

        $custom = trim((string) ($this->title ?? ''));
        if ($custom !== '') {
            return $custom;
        }

        if ($this->relationLoaded('type') && $this->type) {
            $typeName = trim((string) $this->type->name);
            if ($typeName !== '') {
                return $typeName;
            }
        }

        $kind = trim((string) ($this->kind ?? ''));

        return $kind !== '' && strtolower($kind) !== 'upr' ? ucfirst($kind) : 'UPR';
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
     * Remove a repository/analysis document reference and persist.
     */
    public function removeAttachedDocument(?string $path = null, ?string $documentId = null, ?string $href = null): void
    {
        $path = $path !== null ? trim(str_replace('\\', '/', $path)) : '';
        $documentId = $documentId !== null ? trim($documentId) : '';
        $href = $href !== null ? trim($href) : '';

        $repos = self::normalizeRepositories($this->repositories);
        $changed = false;
        foreach (self::REPOSITORY_KEYS as $key) {
            $doc = $repos[$key] ?? null;
            if ($doc !== null && self::documentMatches($doc, $path, $documentId, $href)) {
                $repos[$key] = null;
                $changed = true;
            }
        }

        $analysis = self::normalizeAnalysisFiles($this->analysis_files);
        $filtered = array_values(array_filter(
            $analysis,
            fn (array $doc) => ! self::documentMatches($doc, $path, $documentId, $href),
        ));
        if (count($filtered) !== count($analysis)) {
            $changed = true;
        }

        if (! $changed) {
            return;
        }

        $this->repositories = $repos;
        $this->analysis_files = $filtered;
        $this->save();
    }

    /**
     * Drop documents whose storage file no longer exists (stale hub links).
     *
     * @param  array<string, array<string, mixed>|null>  $repositories
     * @return array<string, array<string, mixed>|null>
     */
    public static function filterExistingRepositories(array $repositories): array
    {
        foreach (self::REPOSITORY_KEYS as $key) {
            $doc = $repositories[$key] ?? null;
            if ($doc !== null && ! self::documentFileExists($doc)) {
                $repositories[$key] = null;
            }
        }

        return $repositories;
    }

    /**
     * @param  list<array<string, mixed>>  $files
     * @return list<array<string, mixed>>
     */
    public static function filterExistingAnalysisFiles(array $files): array
    {
        return array_values(array_filter($files, fn (array $doc) => self::documentFileExists($doc)));
    }

    /**
     * @param  array<string, mixed>  $doc
     */
    private static function documentMatches(array $doc, string $path, string $documentId, string $href): bool
    {
        if ($documentId !== '' && (string) ($doc['id'] ?? '') === $documentId) {
            return true;
        }
        if ($path !== '' && trim((string) ($doc['path'] ?? '')) === $path) {
            return true;
        }
        if ($href !== '' && trim((string) ($doc['href'] ?? '')) === $href) {
            return true;
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $doc
     */
    private static function documentFileExists(array $doc): bool
    {
        $path = trim(str_replace('\\', '/', (string) ($doc['path'] ?? '')));
        if ($path === '') {
            $href = trim((string) ($doc['href'] ?? ''));
            $marker = '/api/v1/repository-files/';
            $pos = strpos($href, $marker);
            if ($pos !== false) {
                $token = explode('?', substr($href, $pos + strlen($marker)))[0] ?? '';
                $token = explode('#', $token)[0] ?? '';
                $decoded = \App\Http\Controllers\Api\V1\Admin\ConventionController::decodeRepositoryFileToken($token);
                if (is_string($decoded) && $decoded !== '') {
                    $path = $decoded;
                }
            }
        }
        if ($path !== '' && str_starts_with($path, 'knowledge-upr-repositories/')) {
            return Storage::disk('public')->exists($path);
        }

        // Keep rows we cannot resolve (avoid hiding unknown legacy links).
        return true;
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
