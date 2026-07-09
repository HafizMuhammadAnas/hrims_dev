<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Issue;
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
            $this->replaceIndicators($issue, $data['indicators'] ?? []);

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
                $this->replaceIndicators($issue, $data['indicators']);
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
            'indicators.*.collection_by_year' => ['sometimes', 'array'],
            'indicators.*.collection_by_year.*.collection_year_id' => ['required', 'integer', Rule::exists('collection_years', 'id')->where('is_active', true)],
            'indicators.*.collection_by_year.*.collection_gender_ids' => ['sometimes', 'array'],
            'indicators.*.collection_by_year.*.collection_gender_ids.*' => ['integer', Rule::exists('collection_genders', 'id')->where('is_active', true)],
            'indicators.*.collection_by_year.*.collection_religion_ids' => ['sometimes', 'array'],
            'indicators.*.collection_by_year.*.collection_religion_ids.*' => ['integer', 'exists:collection_religions,id'],
        ]);

        $conventionId = (int) ($data['convention_id'] ?? $issue?->convention_id ?? $request->input('convention_id', 0));
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
     * @param  list<array<string, mixed>>  $rows
     */
    private function replaceIndicators(Issue $issue, array $rows): void
    {
        $issue->indicators()->delete();
        foreach ($rows as $sortOrder => $row) {
            $text = trim((string) ($row['indicator_text'] ?? ''));
            if ($text === '') {
                continue;
            }
            $collectsByYear = (bool) ($row['collects_by_year'] ?? false);
            $collectsByGender = (bool) ($row['collects_by_gender'] ?? false);
            $collectsByAge = (bool) ($row['collects_by_age'] ?? false);
            $collectsByLocation = (bool) ($row['collects_by_location'] ?? false);
            $collectsByDisability = (bool) ($row['collects_by_disability'] ?? false);
            $collectsByReligion = (bool) ($row['collects_by_religion'] ?? false);
            $collectionByYear = $this->normalizeCollectionByYear($row['collection_by_year'] ?? []);
            $usesDisaggregation = $collectsByGender || $collectsByAge || $collectsByLocation
                || $collectsByDisability || $collectsByReligion;

            if ($collectsByYear && $collectionByYear === []) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'indicators' => ['Each indicator with year collection must include at least one year.'],
                ]);
            }

            if ($collectsByYear && $usesDisaggregation && ! $collectsByGender && ! $collectsByAge
                && ! $collectsByLocation && ! $collectsByDisability && ! $collectsByReligion) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'indicators' => ['Select at least one disaggregation dimension when collecting by year and disaggregated data.'],
                ]);
            }

            if ($collectsByYear && $collectsByGender) {
                foreach ($collectionByYear as $yearRow) {
                    if ($yearRow['collection_gender_ids'] === []) {
                        throw \Illuminate\Validation\ValidationException::withMessages([
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
                'has_quantitative' => (bool) ($row['has_quantitative'] ?? false),
                'has_qualitative' => (bool) ($row['has_qualitative'] ?? false),
                'collects_by_year' => $collectsByYear,
                'collects_by_gender' => $collectsByYear && $collectsByGender,
                'collects_by_age' => $collectsByYear && $collectsByAge,
                'collects_by_location' => $collectsByYear && $collectsByLocation,
                'collects_by_disability' => $collectsByYear && $collectsByDisability,
                'collects_by_religion' => $collectsByYear && $collectsByReligion,
            ];
            if (IssueIndicator::hasSortOrderColumn()) {
                $indicatorAttributes['sort_order'] = (int) $sortOrder;
            }

            $indicator = IssueIndicator::query()->create($indicatorAttributes);

            if ($collectsByYear) {
                $indicator->syncCollectionByYear($collectionByYear, $collectsByGender);
            }
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
