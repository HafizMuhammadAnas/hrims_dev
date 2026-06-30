<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class IssueIndicator extends Model
{
    /** Synthetic gender key for year-only collection (no gender breakdown). */
    public const YEAR_ONLY_GENDER_ID = 0;

    public const AGE_UNDER_18 = 'under_18';

    public const AGE_OVER_18 = 'over_18';

    public const DISABILITY_YES = 'yes';

    public const DISABILITY_NO = 'no';

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
            || (bool) $this->collects_by_religion;
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
     * }>  $rows
     */
    public function syncCollectionByYear(array $rows, bool $collectsByGender): void
    {
        $this->yearGenderCells()->delete();
        $this->yearReligionCells()->delete();
        $this->collectionYearRows()->delete();

        $yearOnly = ! $collectsByGender && ! $this->usesDisaggregatedDimensions();

        $now = now();
        foreach ($rows as $row) {
            $yearId = (int) ($row['collection_year_id'] ?? 0);
            if ($yearId <= 0) {
                continue;
            }

            if ($yearOnly) {
                $this->collectionYearRows()->create([
                    'collection_year_id' => $yearId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

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
            }

            if (! $collectsByGender) {
                $this->collectionYearRows()->create([
                    'collection_year_id' => $yearId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    /**
     * @return list<int>
     */
    public function configuredCollectionYearIds(): array
    {
        $this->loadMissing([
            'yearGenderCells',
            'collectionYearRows',
        ]);

        $ids = collect()
            ->merge($this->yearGenderCells->pluck('collection_year_id'))
            ->merge($this->collectionYearRows->pluck('collection_year_id'))
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $ids;
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminApiArray(): array
    {
        return [
            'id' => $this->id,
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
            'collection_by_year' => $this->buildCollectionByYearPayload(),
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
        ];

        if (! $this->collects_by_year) {
            return $base;
        }

        return array_merge($base, [
            'collection_by_year' => $this->buildCollectionByYearPayload(),
        ]);
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
    public function buildCollectionByYearPayload(): array
    {
        if ($this->isYearOnlyCollection()) {
            return $this->buildYearOnlyPayload();
        }

        return $this->buildDisaggregatedYearPayload();
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
    private function buildYearOnlyPayload(): array
    {
        $rows = $this->relationLoaded('collectionYearRows')
            ? $this->collectionYearRows
            : $this->collectionYearRows()->with('collectionYear')->get();

        if (! $rows->every(fn (IssueIndicatorYear $r) => $r->relationLoaded('collectionYear'))) {
            $rows->load('collectionYear');
        }

        return $rows
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
            ->sortBy(fn (array $row) => $row['label'])
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

        $yearRows = $this->relationLoaded('collectionYearRows')
            ? $this->collectionYearRows
            : $this->collectionYearRows()->with('collectionYear')->get();

        if (! $genderCells->every(fn (IssueIndicatorYearGender $c) => $c->relationLoaded('collectionYear') && $c->relationLoaded('collectionGender'))) {
            $genderCells->load(['collectionYear', 'collectionGender']);
        }
        if (! $yearRows->every(fn (IssueIndicatorYear $r) => $r->relationLoaded('collectionYear'))) {
            $yearRows->load('collectionYear');
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

        foreach ($yearRows as $row) {
            $yearId = (int) $row->collection_year_id;
            if ($byYear->has($yearId)) {
                continue;
            }
            $year = $row->collectionYear;
            $byYear->put($yearId, [
                'year_id' => $yearId,
                'label' => $year?->label ?? '',
                'gender_ids' => [],
                'genders' => [],
                'religion_ids' => [],
                'religions' => [],
            ]);
        }

        return $byYear
            ->values()
            ->sortBy(fn (array $row) => $row['label'])
            ->values()
            ->all();
    }
}
