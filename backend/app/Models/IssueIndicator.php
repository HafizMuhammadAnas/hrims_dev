<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class IssueIndicator extends Model
{
    /** Synthetic gender key for year-only collection (no gender breakdown). */
    public const YEAR_ONLY_GENDER_ID = 0;

    private static ?bool $hasSortOrderColumn = null;

    public static function hasSortOrderColumn(): bool
    {
        if (self::$hasSortOrderColumn === null) {
            self::$hasSortOrderColumn = Schema::hasColumn((new self)->getTable(), 'sort_order');
        }

        return self::$hasSortOrderColumn;
    }

    public const AGE_UNDER_18 = 'under_18';

    public const AGE_18_60 = 'age_18_60';

    public const AGE_ABOVE_60 = 'above_60';

    public const DISABILITY_PERSONS_WITH_DISABILITY = 'persons_with_disability';

    protected $fillable = [
        'issue_id',
        'indicator_text',
        'disaggregation',
        'has_quantitative',
        'has_qualitative',
        'collects_by_year',
        'collects_by_gender',
        'collects_by_age',
        'collects_by_location',
        'collects_by_disability',
        'collects_by_religion',
        'collects_by_others',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'has_quantitative' => 'boolean',
            'has_qualitative' => 'boolean',
            'collects_by_year' => 'boolean',
            'collects_by_gender' => 'boolean',
            'collects_by_age' => 'boolean',
            'collects_by_location' => 'boolean',
            'collects_by_disability' => 'boolean',
            'collects_by_religion' => 'boolean',
            'collects_by_others' => 'boolean',
        ];
    }

    public function issue(): BelongsTo
    {
        return $this->belongsTo(Issue::class);
    }

    public function yearGenderCells(): HasMany
    {
        return $this->hasMany(IssueIndicatorYearGender::class);
    }

    public function yearReligionCells(): HasMany
    {
        return $this->hasMany(IssueIndicatorYearReligion::class);
    }

    public function collectionYearRows(): HasMany
    {
        return $this->hasMany(IssueIndicatorYear::class);
    }

    public function usesDisaggregatedDimensions(): bool
    {
        return (bool) $this->collects_by_gender
            || (bool) $this->collects_by_age
            || (bool) $this->collects_by_location
            || (bool) $this->collects_by_disability
            || (bool) $this->collects_by_religion
            || (bool) $this->collects_by_others;
    }

    public function isYearOnlyCollection(): bool
    {
        return (bool) $this->collects_by_year && ! $this->usesDisaggregatedDimensions();
    }

    /**
     * @param  list<array{
     *   collection_year_id: int,
     *   collection_gender_ids: list<int>,
     *   collection_religion_ids: list<int>
     * }>  $quantitativeRows
     * @param  list<int>  $qualitativeYearIds
     */
    public function syncCollectionByYear(array $quantitativeRows, bool $collectsByGender, array $qualitativeYearIds = []): void
    {
        $this->yearGenderCells()->delete();
        $this->yearReligionCells()->delete();
        $this->collectionYearRows()->delete();

        $yearOnly = ! $collectsByGender && ! $this->usesDisaggregatedDimensions();
        $now = now();

        if ($yearOnly) {
            // Quantitative year-only years (kind=quantitative) and qualitative years (kind=qualitative).
            if ((bool) $this->has_quantitative) {
                foreach ($quantitativeRows as $row) {
                    $yearId = (int) ($row['collection_year_id'] ?? 0);
                    if ($yearId <= 0) {
                        continue;
                    }
                    $this->collectionYearRows()->create([
                        'collection_year_id' => $yearId,
                        'kind' => IssueIndicatorYear::KIND_QUANTITATIVE,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            if ((bool) $this->has_qualitative) {
                foreach (array_values(array_unique(array_map('intval', $qualitativeYearIds))) as $yearId) {
                    if ($yearId <= 0) {
                        continue;
                    }
                    $this->collectionYearRows()->create([
                        'collection_year_id' => $yearId,
                        'kind' => IssueIndicatorYear::KIND_QUALITATIVE,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            return;
        }

        foreach ($quantitativeRows as $row) {
            $yearId = (int) ($row['collection_year_id'] ?? 0);
            if ($yearId <= 0) {
                continue;
            }

            if ($collectsByGender) {
                $genderIds = array_values(array_unique(array_map('intval', $row['collection_gender_ids'] ?? [])));
                foreach ($genderIds as $genderId) {
                    if ($genderId <= 0) {
                        continue;
                    }
                    $this->yearGenderCells()->create([
                        'collection_year_id' => $yearId,
                        'collection_gender_id' => $genderId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            } else {
                // Non-gender quantitative dimensions still need year anchors.
                $this->collectionYearRows()->create([
                    'collection_year_id' => $yearId,
                    'kind' => IssueIndicatorYear::KIND_QUANTITATIVE,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        foreach (array_values(array_unique(array_map('intval', $qualitativeYearIds))) as $yearId) {
            if ($yearId <= 0) {
                continue;
            }
            $this->collectionYearRows()->create([
                'collection_year_id' => $yearId,
                'kind' => IssueIndicatorYear::KIND_QUALITATIVE,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Quantitative years only — never include qualitative narrative years.
     *
     * @return list<int>
     */
    public function quantitativeCollectionYearIds(): array
    {
        $this->loadMissing([
            'yearGenderCells',
            'collectionYearRows',
        ]);

        if ((bool) $this->collects_by_gender && $this->yearGenderCells->isNotEmpty()) {
            return $this->yearGenderCells
                ->pluck('collection_year_id')
                ->map(fn ($id) => (int) $id)
                ->filter(fn (int $id) => $id > 0)
                ->unique()
                ->sort()
                ->values()
                ->all();
        }

        return $this->collectionYearRows
            ->filter(fn (IssueIndicatorYear $row) => ($row->kind ?? IssueIndicatorYear::KIND_QUALITATIVE) === IssueIndicatorYear::KIND_QUANTITATIVE)
            ->pluck('collection_year_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    /**
     * Qualitative narrative years only.
     *
     * @return list<int>
     */
    public function qualitativeCollectionYearIds(): array
    {
        $this->loadMissing(['collectionYearRows']);

        return $this->collectionYearRows
            ->filter(fn (IssueIndicatorYear $row) => ($row->kind ?? IssueIndicatorYear::KIND_QUALITATIVE) === IssueIndicatorYear::KIND_QUALITATIVE)
            ->pluck('collection_year_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }

    /**
     * @deprecated Use quantitativeCollectionYearIds() for matrices. Kept as alias for compatibility.
     *
     * @return list<int>
     */
    public function configuredCollectionYearIds(): array
    {
        return $this->quantitativeCollectionYearIds();
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminApiArray(): array
    {
        return [
            'id' => $this->id,
            'sort_order' => (int) ($this->sort_order ?? 0),
            'indicator_text' => $this->indicator_text,
            'disaggregation' => $this->disaggregation,
            'has_quantitative' => (bool) $this->has_quantitative,
            'has_qualitative' => (bool) $this->has_qualitative,
            'collects_by_year' => (bool) $this->collects_by_year,
            'collects_by_gender' => (bool) $this->collects_by_gender,
            'collects_by_age' => (bool) $this->collects_by_age,
            'collects_by_location' => (bool) $this->collects_by_location,
            'collects_by_disability' => (bool) $this->collects_by_disability,
            'collects_by_religion' => (bool) $this->collects_by_religion,
            'collects_by_others' => (bool) $this->collects_by_others,
            'collection_by_year' => $this->buildCollectionByYearPayload(),
            'qualitative_collection_by_year' => $this->buildQualitativeCollectionByYearPayload(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toHrApiArray(Issue $issue): array
    {
        $flags = $issue->effectiveIndicatorFlags($this);
        $base = [
            'id' => $this->id,
            'indicator_text' => $this->indicator_text,
            'disaggregation' => $this->disaggregation,
            'has_quantitative' => $flags['has_quantitative'],
            'has_qualitative' => $flags['has_qualitative'],
            'collects_by_year' => (bool) $this->collects_by_year,
            'collects_by_gender' => (bool) $this->collects_by_gender,
            'collects_by_age' => (bool) $this->collects_by_age,
            'collects_by_location' => (bool) $this->collects_by_location,
            'collects_by_disability' => (bool) $this->collects_by_disability,
            'collects_by_religion' => (bool) $this->collects_by_religion,
            'collects_by_others' => (bool) $this->collects_by_others,
        ];

        if (! $this->collects_by_year && ! (bool) $this->has_qualitative) {
            return $base;
        }

        $out = $base;
        if ($flags['has_quantitative'] && $this->collects_by_year) {
            $out['collection_by_year'] = $this->buildCollectionByYearPayload();
        }
        if ($flags['has_qualitative']) {
            $out['qualitative_collection_by_year'] = $this->buildQualitativeCollectionByYearPayload();
        }

        return $out;
    }

    /**
     * Quantitative years for numeric matrices only (never qualitative narrative years).
     *
     * @return list<array{
     *   year_id: int,
     *   label: string,
     *   gender_ids: list<int>,
     *   genders: list<array{id: int, name: string}>,
     *   religion_ids: list<int>,
     *   religions: list<array{id: int, name: string}>
     * }>
     */
    public function buildCollectionByYearPayload(): array
    {
        if (! (bool) $this->has_quantitative) {
            return [];
        }

        if ((bool) $this->collects_by_gender) {
            return $this->buildDisaggregatedYearPayload();
        }

        return $this->buildYearOnlyPayload(IssueIndicatorYear::KIND_QUANTITATIVE);
    }

    /**
     * @return list<array{
     *   year_id: int,
     *   label: string,
     *   gender_ids: list<int>,
     *   genders: list<array{id: int, name: string}>,
     *   religion_ids: list<int>,
     *   religions: list<array{id: int, name: string}>
     * }>
     */
    private function buildYearOnlyPayload(string $kind): array
    {
        $rows = $this->relationLoaded('collectionYearRows')
            ? $this->collectionYearRows
            : $this->collectionYearRows()->with('collectionYear')->get();

        if (! $rows->every(fn (IssueIndicatorYear $r) => $r->relationLoaded('collectionYear'))) {
            $rows->load('collectionYear');
        }

        return $rows
            ->filter(fn (IssueIndicatorYear $row) => ($row->kind ?? IssueIndicatorYear::KIND_QUALITATIVE) === $kind)
            ->map(function (IssueIndicatorYear $row) {
                $year = $row->collectionYear;

                return [
                    'year_id' => (int) $row->collection_year_id,
                    'label' => $year?->label ?? '',
                    'gender_ids' => [],
                    'genders' => [],
                    'religion_ids' => [],
                    'religions' => [],
                ];
            })
            ->sortBy(fn (array $row) => [
                is_numeric($row['label']) ? (int) $row['label'] : PHP_INT_MAX,
                $row['label'],
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array{
     *   year_id: int,
     *   label: string,
     *   gender_ids: list<int>,
     *   genders: list<array{id: int, name: string}>,
     *   religion_ids: list<int>,
     *   religions: list<array{id: int, name: string}>
     * }>
     */
    private function buildDisaggregatedYearPayload(): array
    {
        $genderCells = $this->relationLoaded('yearGenderCells')
            ? $this->yearGenderCells
            : $this->yearGenderCells()->with(['collectionYear', 'collectionGender'])->get();

        if (! $genderCells->every(fn (IssueIndicatorYearGender $c) => $c->relationLoaded('collectionYear') && $c->relationLoaded('collectionGender'))) {
            $genderCells->load(['collectionYear', 'collectionGender']);
        }

        /** @var Collection<int, array<string, mixed>> $byYear */
        $byYear = collect();

        foreach ($genderCells->groupBy('collection_year_id') as $yearId => $group) {
            /** @var IssueIndicatorYearGender $first */
            $first = $group->first();
            $year = $first->collectionYear;
            $genders = $group
                ->map(fn (IssueIndicatorYearGender $c) => $c->collectionGender)
                ->filter()
                ->unique('id')
                ->sortBy(fn (CollectionGender $g) => [$g->sort_order, $g->name])
                ->values();

            $byYear->put((int) $yearId, [
                'year_id' => (int) $yearId,
                'label' => $year?->label ?? '',
                'gender_ids' => $genders->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
                'genders' => $genders->map(fn (CollectionGender $g) => [
                    'id' => $g->id,
                    'name' => $g->name,
                ])->all(),
                'religion_ids' => [],
                'religions' => [],
            ]);
        }

        return $byYear
            ->values()
            ->sortBy(fn (array $row) => [
                is_numeric($row['label']) ? (int) $row['label'] : PHP_INT_MAX,
                $row['label'],
            ])
            ->values()
            ->all();
    }

    /**
     * Qualitative collection years (independent of quantitative disaggregation years).
     *
     * @return list<array{year_id: int, label: string}>
     */
    public function buildQualitativeCollectionByYearPayload(): array
    {
        if (! (bool) $this->has_qualitative) {
            return [];
        }

        return array_map(
            static fn (array $row): array => [
                'year_id' => $row['year_id'],
                'label' => $row['label'],
            ],
            $this->buildYearOnlyPayload(IssueIndicatorYear::KIND_QUALITATIVE),
        );
    }
}
