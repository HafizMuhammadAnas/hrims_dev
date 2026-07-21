<?php

namespace App\Support;

use App\Models\CollectionGender;
use App\Models\CollectionYear;
use App\Models\HrRequest;
use App\Models\HrRequestIndicatorYear;
use App\Models\IssueIndicator;
use App\Models\IssueIndicatorYear;
use Illuminate\Support\Collection;

/**
 * Builds request-scoped year payloads for HR indicators (Federal selects years at request create).
 */
final class RequestIndicatorYears
{
    /** @var list<string> */
    private const HIDDEN_GENDER_NAMES = [
        'juvenile male',
        'juvenile female',
        'male juvenile',
        'female juvenile',
    ];

    /**
     * @return array{quantitative: list<int>, qualitative: list<int>}
     */
    public static function yearIdsForIndicator(HrRequest $hrRequest, int $indicatorId): array
    {
        $hrRequest->loadMissing('indicatorYears');
        $rows = $hrRequest->indicatorYears
            ->where('issue_indicator_id', $indicatorId)
            ->values();

        $quant = $rows
            ->where('kind', HrRequestIndicatorYear::KIND_QUANTITATIVE)
            ->pluck('collection_year_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
        $qual = $rows
            ->where('kind', HrRequestIndicatorYear::KIND_QUALITATIVE)
            ->pluck('collection_year_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        return ['quantitative' => $quant, 'qualitative' => $qual];
    }

    public static function hasRequestYears(HrRequest $hrRequest, int $indicatorId): bool
    {
        $ids = self::yearIdsForIndicator($hrRequest, $indicatorId);

        return $ids['quantitative'] !== [] || $ids['qualitative'] !== [];
    }

    /**
     * Overlay Federal-selected years onto an indicator API array (falls back to catalog when empty).
     *
     * @param  array<string, mixed>  $api
     * @return array<string, mixed>
     */
    public static function applyToIndicatorApi(array $api, IssueIndicator $indicator, HrRequest $hrRequest): array
    {
        if (! self::hasRequestYears($hrRequest, (int) $indicator->id)) {
            return $api;
        }

        $ids = self::yearIdsForIndicator($hrRequest, (int) $indicator->id);
        $yearsById = self::activeYearsById();

        if (! empty($api['has_quantitative']) && (bool) $indicator->collects_by_year) {
            $api['collection_by_year'] = self::buildQuantitativeYearRows(
                $ids['quantitative'],
                $yearsById,
                (bool) $indicator->collects_by_gender,
            );
        }

        if (! empty($api['has_qualitative'])) {
            $api['qualitative_collection_by_year'] = self::buildQualitativeYearRows(
                $ids['qualitative'],
                $yearsById,
            );
        }

        return $api;
    }

    /**
     * @param  list<int>  $yearIds
     * @param  Collection<int, CollectionYear>  $yearsById
     * @return list<array<string, mixed>>
     */
    public static function buildQuantitativeYearRows(array $yearIds, Collection $yearsById, bool $withGenders): array
    {
        $genders = $withGenders ? self::selectableGenders() : collect();
        $rows = [];
        foreach ($yearIds as $yearId) {
            $year = $yearsById->get($yearId);
            if (! $year) {
                continue;
            }
            $rows[] = [
                'year_id' => (int) $yearId,
                'label' => (string) $year->label,
                'gender_ids' => $genders->pluck('id')->map(fn ($id) => (int) $id)->values()->all(),
                'genders' => $genders->map(fn (CollectionGender $g) => [
                    'id' => (int) $g->id,
                    'name' => (string) $g->name,
                ])->values()->all(),
                'religion_ids' => [],
                'religions' => [],
            ];
        }

        return self::sortYearRows($rows);
    }

    /**
     * @param  list<int>  $yearIds
     * @param  Collection<int, CollectionYear>  $yearsById
     * @return list<array{year_id: int, label: string}>
     */
    public static function buildQualitativeYearRows(array $yearIds, Collection $yearsById): array
    {
        $rows = [];
        foreach ($yearIds as $yearId) {
            $year = $yearsById->get($yearId);
            if (! $year) {
                continue;
            }
            $rows[] = [
                'year_id' => (int) $yearId,
                'label' => (string) $year->label,
            ];
        }

        return array_map(
            static fn (array $row): array => [
                'year_id' => $row['year_id'],
                'label' => $row['label'],
            ],
            self::sortYearRows($rows),
        );
    }

    /**
     * Hydrate in-memory year/gender relations from Federal request years so
     * department validation can reuse catalog-based normalizers.
     */
    public static function hydrateIndicatorRelations(IssueIndicator $indicator, HrRequest $hrRequest): void
    {
        if (! self::hasRequestYears($hrRequest, (int) $indicator->id)) {
            return;
        }

        $ids = self::yearIdsForIndicator($hrRequest, (int) $indicator->id);
        $yearsById = self::activeYearsById();
        $now = now();

        $yearRows = collect();
        foreach ($ids['quantitative'] as $yearId) {
            $year = $yearsById->get($yearId);
            if (! $year) {
                continue;
            }
            $row = new IssueIndicatorYear([
                'issue_indicator_id' => $indicator->id,
                'collection_year_id' => $yearId,
                'kind' => HrRequestIndicatorYear::KIND_QUANTITATIVE,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $row->setRelation('collectionYear', $year);
            $yearRows->push($row);
        }
        foreach ($ids['qualitative'] as $yearId) {
            $year = $yearsById->get($yearId);
            if (! $year) {
                continue;
            }
            $row = new IssueIndicatorYear([
                'issue_indicator_id' => $indicator->id,
                'collection_year_id' => $yearId,
                'kind' => HrRequestIndicatorYear::KIND_QUALITATIVE,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $row->setRelation('collectionYear', $year);
            $yearRows->push($row);
        }
        $indicator->setRelation('collectionYearRows', $yearRows);

        if ((bool) $indicator->collects_by_gender) {
            $genders = self::selectableGenders();
            $cells = collect();
            foreach ($ids['quantitative'] as $yearId) {
                $year = $yearsById->get($yearId);
                if (! $year) {
                    continue;
                }
                foreach ($genders as $gender) {
                    $cell = new \App\Models\IssueIndicatorYearGender([
                        'issue_indicator_id' => $indicator->id,
                        'collection_year_id' => $yearId,
                        'collection_gender_id' => $gender->id,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $cell->setRelation('collectionYear', $year);
                    $cell->setRelation('collectionGender', $gender);
                    $cells->push($cell);
                }
            }
            $indicator->setRelation('yearGenderCells', $cells);
        }
    }

    /**
     * @return Collection<int, CollectionYear>
     */
    public static function activeYearsById(): Collection
    {
        return CollectionYear::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get(['id', 'label', 'sort_order'])
            ->keyBy('id');
    }

    /**
     * @return list<array{id: int, label: string}>
     */
    public static function activeYearsList(): array
    {
        return CollectionYear::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get(['id', 'label'])
            ->map(fn (CollectionYear $y) => [
                'id' => (int) $y->id,
                'label' => (string) $y->label,
            ])
            ->values()
            ->all();
    }

    /**
     * @return Collection<int, CollectionGender>
     */
    private static function selectableGenders(): Collection
    {
        return CollectionGender::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'sort_order'])
            ->filter(function (CollectionGender $g) {
                $name = strtolower(trim((string) $g->name));

                return ! in_array($name, self::HIDDEN_GENDER_NAMES, true);
            })
            ->values();
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private static function sortYearRows(array $rows): array
    {
        usort($rows, static function (array $a, array $b): int {
            $la = (string) ($a['label'] ?? '');
            $lb = (string) ($b['label'] ?? '');
            $na = is_numeric($la) ? (int) $la : PHP_INT_MAX;
            $nb = is_numeric($lb) ? (int) $lb : PHP_INT_MAX;
            if ($na !== $nb) {
                return $na <=> $nb;
            }

            return strcmp($la, $lb);
        });

        return array_values($rows);
    }
}
