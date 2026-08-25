<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Issue;
use App\Models\IssueCategory;
use App\Models\IssueIndicator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class IssueController extends Controller
{
    /**
     * @return list<string>
     */
    private function indicatorRelations(): array
    {
        return [
            'indicators.yearGenderCells.collectionYear:id,label,sort_order',
            'indicators.yearGenderCells.collectionGender:id,name,sort_order',
            'indicators.yearReligionCells.collectionYear:id,label,sort_order',
            'indicators.yearReligionCells.collectionReligion:id,name,sort_order',
            'indicators.collectionYearRows.collectionYear:id,label,sort_order',
        ];
    }

    public function index(): JsonResponse
    {
        $rows = Issue::query()
            ->with(array_merge(
                [
                    'convention:id,code,name',
                    'category:id,name',
                    'articles:id,article_name,description',
                ],
                $this->indicatorRelations(),
            ))
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (Issue $i) => $this->serializeDetail($i)),
        ]);
    }

    public function show(Issue $issue): JsonResponse
    {
        $issue->load(array_merge(
            [
                'convention:id,code,name',
                'category:id,name',
                'articles:id,article_name',
            ],
            $this->indicatorRelations(),
        ));

        return response()->json(['data' => $this->serializeDetail($issue)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, false);

        $issue = DB::transaction(function () use ($data) {
            $issue = Issue::query()->create([
                'convention_id' => $data['convention_id'],
                'category_id' => $data['category_id'],
                'entry_kind' => $data['entry_kind'] ?? 'issue',
                'issue_title' => $data['issue_title'],
                'description' => isset($data['description']) && $data['description'] !== ''
                    ? (string) $data['description']
                    : null,
                'has_quantitative' => (bool) ($data['has_quantitative'] ?? false),
                'has_qualitative' => (bool) ($data['has_qualitative'] ?? false),
                'is_active' => true,
            ]);
            $this->syncArticles($issue, $data['articles']);
            $this->syncIndicators($issue, $data['indicators'] ?? []);

            return $issue->fresh(array_merge(
                [
                    'convention:id,code,name',
                    'category:id,name',
                    'articles:id,article_name,description',
                ],
                $this->indicatorRelations(),
            ));
        });

        return response()->json(['data' => $this->serializeDetail($issue)], 201);
    }

    public function update(Request $request, Issue $issue): JsonResponse
    {
        $data = $this->validatePayload($request, true, $issue);

        DB::transaction(function () use ($issue, $data) {
            $scalar = collect($data)->only([
                'convention_id',
                'category_id',
                'entry_kind',
                'issue_title',
                'description',
                'has_quantitative',
                'has_qualitative',
                'is_active',
            ])->all();
            if (array_key_exists('description', $scalar) && ($scalar['description'] === '' || $scalar['description'] === null)) {
                $scalar['description'] = null;
            }
            if ($scalar !== []) {
                $issue->fill($scalar);
                $issue->save();
            }
            if (array_key_exists('articles', $data)) {
                $this->syncArticles($issue, $data['articles']);
            }
            if (array_key_exists('indicators', $data)) {
                $this->syncIndicators($issue, $data['indicators']);
            }
        });

        $issue->load(array_merge(
            [
                'convention:id,code,name',
                'category:id,name',
                'articles:id,article_name',
            ],
            $this->indicatorRelations(),
        ));

        return response()->json(['data' => $this->serializeDetail($issue)]);
    }

    /**
     * Reorder indicators by stable id — updates sort_order only (never recreates rows).
     */
    public function reorderIndicators(Request $request, Issue $issue): JsonResponse
    {
        $data = $request->validate([
            'ordered_ids' => ['required', 'array', 'min:1'],
            'ordered_ids.*' => ['integer', 'distinct'],
        ]);

        $orderedIds = array_values(array_map('intval', $data['ordered_ids']));
        $existingQuery = $issue->indicators();
        if (IssueIndicator::hasIsActiveColumn()) {
            $existingQuery->where('is_active', true);
        }
        $existingIds = $existingQuery
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->sort()
            ->values()
            ->all();
        $incomingSorted = collect($orderedIds)->sort()->values()->all();

        if ($existingIds !== $incomingSorted) {
            throw ValidationException::withMessages([
                'ordered_ids' => ['The list must include every active indicator for this entry exactly once.'],
            ]);
        }

        if (! IssueIndicator::hasSortOrderColumn()) {
            throw ValidationException::withMessages([
                'ordered_ids' => ['Indicator ordering is not available until the sort_order migration has been applied.'],
            ]);
        }

        DB::transaction(function () use ($issue, $orderedIds) {
            foreach ($orderedIds as $sortOrder => $id) {
                IssueIndicator::query()
                    ->where('issue_id', $issue->id)
                    ->where('id', $id)
                    ->update(['sort_order' => (int) $sortOrder]);
            }
        });

        $issue->load(array_merge(
            [
                'convention:id,code,name',
                'category:id,name',
                'articles:id,article_name',
            ],
            $this->indicatorRelations(),
        ));

        return response()->json(['data' => $this->serializeDetail($issue)]);
    }

    /**
     * Activate or deactivate an indicator without deleting it (preserves request/response links).
     */
    public function setIndicatorActive(Request $request, Issue $issue, IssueIndicator $indicator): JsonResponse
    {
        if ((int) $indicator->issue_id !== (int) $issue->id) {
            abort(404);
        }
        if (! IssueIndicator::hasIsActiveColumn()) {
            throw ValidationException::withMessages([
                'is_active' => ['Indicator activation is not available until the is_active migration has been applied.'],
            ]);
        }

        $data = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $indicator->is_active = (bool) $data['is_active'];
        $indicator->save();

        $issue->load(array_merge(
            [
                'convention:id,code,name',
                'category:id,name',
                'articles:id,article_name',
            ],
            $this->indicatorRelations(),
        ));

        return response()->json(['data' => $this->serializeDetail($issue)]);
    }

    public function destroy(Issue $issue): JsonResponse
    {
        $issue->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, bool $partial, ?Issue $issue = null): array
    {
        $req = $partial ? 'sometimes' : 'required';

        $data = $request->validate([
            'convention_id' => [$req, 'integer', 'exists:conventions,id'],
            'category_id' => [$req, 'integer', Rule::exists('issue_categories', 'id')->where('is_active', true)],
            'entry_kind' => [$partial ? 'sometimes' : 'required', 'string', 'in:issue,recommendation'],
            'issue_title' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
            'has_quantitative' => [$partial ? 'sometimes' : 'required', 'boolean'],
            'has_qualitative' => [$partial ? 'sometimes' : 'required', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'articles' => [$partial ? 'sometimes' : 'required', 'array', 'min:1'],
            'articles.*.article_id' => ['required', 'integer'],
            'articles.*.relevant_paragraph' => ['nullable', 'string'],
            'indicators' => ['sometimes', 'array'],
            'indicators.*.id' => ['sometimes', 'nullable', 'integer', 'distinct'],
            'indicators.*.is_active' => ['sometimes', 'boolean'],
            'indicators.*.indicator_text' => ['required_with:indicators', 'string'],
            'indicators.*.disaggregation' => ['nullable', 'string'],
            'indicators.*.has_quantitative' => ['sometimes', 'boolean'],
            'indicators.*.has_qualitative' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_year' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_gender' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_age' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_location' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_disability' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_religion' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_consolidated' => ['sometimes', 'boolean'],
            // Temporary input alias for clients deployed before the dimension rename.
            'indicators.*.collects_by_others' => ['sometimes', 'boolean'],
            'indicators.*.collection_by_year' => ['sometimes', 'array'],
            'indicators.*.collection_by_year.*.collection_year_id' => ['required', 'integer', Rule::exists('collection_years', 'id')->where('is_active', true)],
            'indicators.*.collection_by_year.*.collection_gender_ids' => ['sometimes', 'array'],
            'indicators.*.collection_by_year.*.collection_gender_ids.*' => ['integer', Rule::exists('collection_genders', 'id')->where('is_active', true)],
            'indicators.*.collection_by_year.*.collection_religion_ids' => ['sometimes', 'array'],
            'indicators.*.collection_by_year.*.collection_religion_ids.*' => ['integer', 'exists:collection_religions,id'],
            'indicators.*.qualitative_collection_by_year' => ['sometimes', 'array'],
            'indicators.*.qualitative_collection_by_year.*' => ['nullable'],
        ]);

        $conventionId = (int) ($data['convention_id'] ?? $issue?->convention_id ?? $request->input('convention_id', 0));
        if ($conventionId > 0 && array_key_exists('category_id', $data)) {
            $categoryId = (int) $data['category_id'];
            $categoryOk = IssueCategory::query()
                ->where('id', $categoryId)
                ->where('convention_id', $conventionId)
                ->where('is_active', true)
                ->exists();
            if (! $categoryOk) {
                throw ValidationException::withMessages([
                    'category_id' => ['The selected category does not belong to this convention.'],
                ]);
            }
        }
        if ($conventionId > 0 && array_key_exists('articles', $data)) {
            foreach ($data['articles'] as $index => $row) {
                $articleId = (int) ($row['article_id'] ?? 0);
                $validator = Validator::make(
                    ['article_id' => $articleId],
                    [
                        'article_id' => [
                            'required',
                            'integer',
                            Rule::exists('articles', 'id')
                                ->where('is_active', true)
                                ->where('convention_id', $conventionId),
                        ],
                    ],
                );
                if ($validator->fails()) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'articles.'.$index.'.article_id' => ['The selected article does not belong to this convention.'],
                    ]);
                }
            }
        }

        return $this->normalizeEntryFields($data, $partial, $issue);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeEntryFields(array $data, bool $partial, ?Issue $issue = null): array
    {
        $entryKind = $data['entry_kind'] ?? $issue?->entry_kind ?? ($partial ? null : 'issue');
        if ($entryKind === null) {
            $entryKind = $issue?->entry_kind ?? 'issue';
        }

        if ($entryKind === 'recommendation') {
            if (! $partial || array_key_exists('description', $data)) {
                $description = trim((string) ($data['description'] ?? ''));
                if ($description === '') {
                    throw ValidationException::withMessages([
                        'description' => ['The concluding observations description is required.'],
                    ]);
                }
                $data['description'] = $description;
            }
            if (
                ! $partial
                || array_key_exists('issue_title', $data)
                || array_key_exists('description', $data)
                || array_key_exists('entry_kind', $data)
            ) {
                $data['issue_title'] = null;
            }
        } else {
            if (! $partial || array_key_exists('issue_title', $data)) {
                $title = trim((string) ($data['issue_title'] ?? ''));
                if ($title === '') {
                    throw ValidationException::withMessages([
                        'issue_title' => ['The LOI title is required.'],
                    ]);
                }
                $data['issue_title'] = $title;
            }
            if (array_key_exists('description', $data)) {
                $description = trim((string) ($data['description'] ?? ''));
                $data['description'] = $description !== '' ? $description : null;
            }
        }

        return $data;
    }

    /**
     * @param  list<array{article_id: int, relevant_paragraph?: string|null}>  $rows
     */
    private function syncArticles(Issue $issue, array $rows): void
    {
        $sync = [];
        foreach ($rows as $row) {
            $id = (int) $row['article_id'];
            $sync[$id] = [
                'relevant_paragraph' => isset($row['relevant_paragraph']) && $row['relevant_paragraph'] !== ''
                    ? (string) $row['relevant_paragraph']
                    : null,
            ];
        }
        $issue->articles()->sync($sync);
    }

    /**
     * Upsert indicators by stable id. Array index becomes sort_order.
     * Existing ids keep their primary keys so HR requests / responses stay linked.
     *
     * @param  list<array<string, mixed>>  $rows
     */
    private function syncIndicators(Issue $issue, array $rows): void
    {
        $existingById = $issue->indicators()->get()->keyBy(
            static fn (IssueIndicator $ind): int => (int) $ind->id,
        );

        $keepIds = [];
        $sortOrder = 0;

        foreach ($rows as $row) {
            $text = trim((string) ($row['indicator_text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $incomingId = isset($row['id']) ? (int) $row['id'] : 0;
            $existing = $incomingId > 0 ? ($existingById->get($incomingId) ?? null) : null;
            if ($incomingId > 0 && $existing === null) {
                throw ValidationException::withMessages([
                    'indicators' => ['One or more indicator ids do not belong to this entry.'],
                ]);
            }

            $collectsByYear = (bool) ($row['collects_by_year'] ?? false);
            $collectsByGender = (bool) ($row['collects_by_gender'] ?? false);
            $collectsByAge = (bool) ($row['collects_by_age'] ?? false);
            $collectsByLocation = (bool) ($row['collects_by_location'] ?? false);
            $collectsByDisability = (bool) ($row['collects_by_disability'] ?? false);
            $collectsByReligion = (bool) ($row['collects_by_religion'] ?? false);
            $collectsByConsolidated = (bool) (
                $row['collects_by_consolidated']
                ?? $row['collects_by_others']
                ?? false
            );
            $hasQuantitative = (bool) ($row['has_quantitative'] ?? false);
            $hasQualitative = (bool) ($row['has_qualitative'] ?? false);
            $hasYearPayload = array_key_exists('collection_by_year', $row)
                || array_key_exists('qualitative_collection_by_year', $row);
            $collectionByYear = $hasYearPayload
                ? $this->normalizeCollectionByYear($row['collection_by_year'] ?? [])
                : [];
            $qualitativeYearIds = $hasYearPayload
                ? $this->normalizeQualitativeYearIds($row['qualitative_collection_by_year'] ?? [])
                : [];
            $usesDisaggregation = $collectsByGender || $collectsByAge || $collectsByLocation
                || $collectsByDisability || $collectsByReligion || $collectsByConsolidated;

            // Year-only qualitative uses qualitative_collection_by_year; also accept collection_by_year.
            if ($hasQualitative && ! $hasQuantitative && $qualitativeYearIds === [] && $collectionByYear !== []) {
                $qualitativeYearIds = array_values(array_map(
                    static fn (array $yearRow): int => (int) $yearRow['collection_year_id'],
                    $collectionByYear,
                ));
            }

            // Years are selected by Federal Admin per request. Super Admin only sets Q/L + dimensions.
            // Keep optional catalog years for legacy rows; do not require them here.
            $collectsByYear = $hasQuantitative || $collectsByYear || $collectionByYear !== [] || $qualitativeYearIds !== [];

            if ($hasQuantitative && $usesDisaggregation && ! $collectsByGender && ! $collectsByAge
                && ! $collectsByLocation && ! $collectsByDisability && ! $collectsByReligion && ! $collectsByConsolidated) {
                throw ValidationException::withMessages([
                    'indicators' => ['Select at least one disaggregation dimension when collecting quantitative data.'],
                ]);
            }

            if ($collectsByYear && $collectsByGender && $collectionByYear !== []) {
                foreach ($collectionByYear as $yearRow) {
                    if ($yearRow['collection_gender_ids'] === []) {
                        throw ValidationException::withMessages([
                            'indicators' => ['Each selected year must include at least one gender when the gender dimension is enabled.'],
                        ]);
                    }
                }
            }

            $indicatorAttributes = [
                'issue_id' => $issue->id,
                'indicator_text' => $text,
                'disaggregation' => isset($row['disaggregation']) && $row['disaggregation'] !== ''
                    ? (string) $row['disaggregation']
                    : null,
                'has_quantitative' => $hasQuantitative,
                'has_qualitative' => $hasQualitative,
                'collects_by_year' => $hasQuantitative || $collectsByYear,
                'collects_by_gender' => $hasQuantitative && $collectsByGender,
                'collects_by_age' => $hasQuantitative && $collectsByAge,
                'collects_by_location' => $hasQuantitative && $collectsByLocation,
                'collects_by_disability' => $hasQuantitative && $collectsByDisability,
                'collects_by_religion' => $hasQuantitative && $collectsByReligion,
                'collects_by_consolidated' => $hasQuantitative && $collectsByConsolidated,
            ];
            if (IssueIndicator::hasSortOrderColumn()) {
                $indicatorAttributes['sort_order'] = $sortOrder;
            }
            if (IssueIndicator::hasIsActiveColumn()) {
                $indicatorAttributes['is_active'] = array_key_exists('is_active', $row)
                    ? (bool) $row['is_active']
                    : true;
            }

            if ($existing !== null) {
                $existing->fill($indicatorAttributes);
                $existing->save();
                $indicator = $existing;
                $keepIds[] = (int) $existing->id;
            } else {
                $indicator = IssueIndicator::query()->create($indicatorAttributes);
                $keepIds[] = (int) $indicator->id;
            }

            // Only touch catalog years when the client explicitly sent year payloads.
            if ($hasYearPayload) {
                $indicator->syncCollectionByYear(
                    $hasQuantitative ? $collectionByYear : [],
                    (bool) $indicatorAttributes['collects_by_gender'],
                    $hasQualitative ? $qualitativeYearIds : [],
                );
            }

            $sortOrder++;
        }

        // Never hard-delete: indicators omitted from the payload are deactivated so
        // existing HR requests / department responses keep stable indicator ids.
        $toDeactivate = $existingById->keys()
            ->map(static fn ($id): int => (int) $id)
            ->diff($keepIds)
            ->values()
            ->all();
        if ($toDeactivate !== [] && IssueIndicator::hasIsActiveColumn()) {
            IssueIndicator::query()
                ->where('issue_id', $issue->id)
                ->whereIn('id', $toDeactivate)
                ->update(['is_active' => false]);
        } elseif ($toDeactivate !== []) {
            throw ValidationException::withMessages([
                'indicators' => ['Cannot remove indicators until the is_active migration has been applied. Reactivate/deactivate is required instead of delete.'],
            ]);
        }
    }

    /**
     * @param  mixed  $rows
     * @return list<array{
     *   collection_year_id: int,
     *   collection_gender_ids: list<int>,
     *   collection_religion_ids: list<int>
     * }>
     */
    private function normalizeCollectionByYear(mixed $rows): array
    {
        if (! is_array($rows)) {
            return [];
        }

        $out = [];
        $seenYears = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $yearId = (int) ($row['collection_year_id'] ?? $row['year_id'] ?? 0);
            if ($yearId <= 0 || isset($seenYears[$yearId])) {
                continue;
            }
            $seenYears[$yearId] = true;
            $genderIds = array_values(array_unique(array_map(
                'intval',
                is_array($row['collection_gender_ids'] ?? null)
                    ? $row['collection_gender_ids']
                    : (is_array($row['gender_ids'] ?? null) ? $row['gender_ids'] : []),
            )));
            $genderIds = array_values(array_filter($genderIds, fn (int $id) => $id > 0));
            $religionIds = array_values(array_unique(array_map(
                'intval',
                is_array($row['collection_religion_ids'] ?? null)
                    ? $row['collection_religion_ids']
                    : (is_array($row['religion_ids'] ?? null) ? $row['religion_ids'] : []),
            )));
            $religionIds = array_values(array_filter($religionIds, fn (int $id) => $id > 0));
            $out[] = [
                'collection_year_id' => $yearId,
                'collection_gender_ids' => $genderIds,
                'collection_religion_ids' => $religionIds,
            ];
        }

        return $out;
    }

    /**
     * @param  mixed  $rows
     * @return list<int>
     */
    private function normalizeQualitativeYearIds(mixed $rows): array
    {
        if (! is_array($rows)) {
            return [];
        }

        $out = [];
        $seen = [];
        foreach ($rows as $row) {
            $yearId = 0;
            if (is_array($row)) {
                $yearId = (int) ($row['collection_year_id'] ?? $row['year_id'] ?? 0);
            } elseif (is_numeric($row)) {
                $yearId = (int) $row;
            }
            if ($yearId <= 0 || isset($seen[$yearId])) {
                continue;
            }
            $seen[$yearId] = true;
            $out[] = $yearId;
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDetail(Issue $i): array
    {
        $articlesOut = [];
        if ($i->relationLoaded('articles')) {
            foreach ($i->articles->sortBy('id')->values() as $a) {
                $articlesOut[] = [
                    'id' => $a->id,
                    'article_name' => $a->article_name,
                    'description' => $a->description,
                    'relevant_paragraph' => $a->pivot->relevant_paragraph ?? null,
                ];
            }
        }

        $indicatorsOut = [];
        if ($i->relationLoaded('indicators')) {
            $indicatorsOut = $i->indicators->map(fn (IssueIndicator $ind) => $ind->toAdminApiArray())->values()->all();
        }

        return [
            'id' => $i->id,
            'convention_id' => $i->convention_id,
            'category_id' => $i->category_id,
            'entry_kind' => $i->entry_kind === 'recommendation' ? 'recommendation' : 'issue',
            'issue_title' => $i->issue_title,
            'description' => $i->description,
            'has_quantitative' => (bool) $i->has_quantitative,
            'has_qualitative' => (bool) $i->has_qualitative,
            'is_active' => (bool) ($i->is_active ?? true),
            'created_at' => optional($i->created_at)?->toIso8601String(),
            'updated_at' => optional($i->updated_at)?->toIso8601String(),
            'convention' => $i->relationLoaded('convention') && $i->convention
                ? ['id' => $i->convention->id, 'code' => $i->convention->code, 'name' => $i->convention->name]
                : null,
            'category' => $i->relationLoaded('category') && $i->category
                ? ['id' => $i->category->id, 'name' => $i->category->name]
                : null,
            'articles' => $articlesOut,
            'article_ids' => array_values(array_filter(array_map(fn ($a) => $a['id'] ?? null, $articlesOut))),
            'indicators' => $indicatorsOut,
        ];
    }

}
