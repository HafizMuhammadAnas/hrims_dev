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

    protected $fillable = [
        'issue_id',
        'indicator_text',
        'disaggregation',
        'has_quantitative',
        'has_qualitative',
        'collects_by_year',
        'collects_by_gender',
    ];

    protected function casts(): array
    {
        return [
            'has_quantitative' => 'boolean',
            'has_qualitative' => 'boolean',
            'collects_by_year' => 'boolean',
            'collects_by_gender' => 'boolean',
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

    public function collectionYearRows(): HasMany
    {
        return $this->hasMany(IssueIndicatorYear::class);
    }

    /**
     * @param  list<array{collection_year_id: int, collection_gender_ids: list<int>}>  $rows
     */
    public function syncCollectionByYear(array $rows, bool $collectsByGender): void
    {
        if ($collectsByGender) {
            $this->collectionYearRows()->delete();
            $this->yearGenderCells()->delete();

            $now = now();
            foreach ($rows as $row) {
                $yearId = (int) ($row['collection_year_id'] ?? 0);
                if ($yearId <= 0) {
                    continue;
                }
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

            return;
        }

        $this->yearGenderCells()->delete();
        $this->collectionYearRows()->delete();

        $now = now();
        foreach ($rows as $row) {
            $yearId = (int) ($row['collection_year_id'] ?? 0);
            if ($yearId <= 0) {
                continue;
            }
            $this->collectionYearRows()->create([
                'collection_year_id' => $yearId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
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
     *   genders: list<array{id: int, name: string}>
     * }>
     */
    public function buildCollectionByYearPayload(): array
    {
        if ((bool) $this->collects_by_gender) {
            return $this->buildYearGenderPayload();
        }

        return $this->buildYearOnlyPayload();
    }

    /**
     * @return list<array{
     *   year_id: int,
     *   label: string,
     *   gender_ids: list<int>,
     *   genders: list<array{id: int, name: string}>
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
     *   genders: list<array{id: int, name: string}>
     * }>
     */
    private function buildYearGenderPayload(): array
    {
        $cells = $this->relationLoaded('yearGenderCells')
            ? $this->yearGenderCells
            : $this->yearGenderCells()->with(['collectionYear', 'collectionGender'])->get();

        if (! $cells->every(fn (IssueIndicatorYearGender $c) => $c->relationLoaded('collectionYear') && $c->relationLoaded('collectionGender'))) {
            $cells->load(['collectionYear', 'collectionGender']);
        }

        /** @var Collection<int, Collection<int, IssueIndicatorYearGender>> $byYear */
        $byYear = $cells->groupBy('collection_year_id');

        return $byYear
            ->map(function (Collection $group, $yearId) {
                /** @var IssueIndicatorYearGender $first */
                $first = $group->first();
                $year = $first->collectionYear;
                $genders = $group
                    ->map(fn (IssueIndicatorYearGender $c) => $c->collectionGender)
                    ->filter()
                    ->unique('id')
                    ->sortBy(fn (CollectionGender $g) => [$g->sort_order, $g->name])
                    ->values();

                return [
                    'year_id' => (int) $yearId,
                    'label' => $year?->label ?? '',
                    'gender_ids' => $genders->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
                    'genders' => $genders->map(fn (CollectionGender $g) => [
                        'id' => $g->id,
                        'name' => $g->name,
                    ])->all(),
                ];
            })
            ->sortBy(fn (array $row) => $row['label'])
            ->values()
            ->all();
    }
}
