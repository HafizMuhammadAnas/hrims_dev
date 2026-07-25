<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Convention;
use App\Models\IssueCategory;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ReportLookupController extends Controller
{
    public function conventions(Request $request): JsonResponse
    {
        $q = Convention::query();
        $cid = HrimsAccess::conventionId($request->user());
        if ($cid !== null) {
            $q->whereKey($cid);
        }
        if (Schema::hasColumn('conventions', 'sort_order')) {
            $q->orderBy('sort_order');
        }
        $rows = $q->orderBy('name')->get(['id', 'code', 'name']);

        return response()->json([
            'data' => $rows->map(fn (Convention $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
            ]),
        ]);
    }

    public function issueCategories(): JsonResponse
    {
        $q = IssueCategory::query()->orderBy('name');
        if (Schema::hasColumn('issue_categories', 'is_active')) {
            $q->where('is_active', true);
        }
        $rows = $q->get(['id', 'name']);

        return response()->json([
            'data' => $rows->map(fn (IssueCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
            ]),
        ]);
    }

    public function articles(Request $request): JsonResponse
    {
        $conventionId = $request->query('convention_id');
        $locked = HrimsAccess::conventionId($request->user());
        if ($locked !== null) {
            $conventionId = $locked;
        }
        $q = Article::query()->orderBy('article_name');
        if (Schema::hasColumn('articles', 'is_active')) {
            $q->where('is_active', true);
        }
        if ($conventionId !== null && $conventionId !== '') {
            $q->where('convention_id', (int) $conventionId);
        }
        $rows = $q->get(['id', 'convention_id', 'article_name']);

        return response()->json([
            'data' => $rows->map(fn (Article $a) => [
                'id' => $a->id,
                'convention_id' => (int) $a->convention_id,
                'article_name' => $a->article_name,
            ]),
        ]);
    }

    public function indicators(Request $request): JsonResponse
    {
        $conventionId = $request->query('convention_id');
        $locked = HrimsAccess::conventionId($request->user());
        if ($locked !== null) {
            $conventionId = $locked;
        }
        $articleId = $request->query('article_id');
        $entryKind = $request->query('entry_kind');
        $categoryId = $request->query('category_id');

        $q = DB::table('issue_indicators')
            ->join('issues', 'issues.id', '=', 'issue_indicators.issue_id')
            ->select([
                'issue_indicators.id',
                'issue_indicators.issue_id',
                'issue_indicators.indicator_text',
            ]);

        if (Schema::hasColumn('issue_indicators', 'is_active')) {
            $q->where('issue_indicators.is_active', true);
        }

        if (Schema::hasColumn('issue_indicators', 'sort_order')) {
            $q->orderBy('issues.id')
                ->orderBy('issue_indicators.sort_order')
                ->orderBy('issue_indicators.id');
        } else {
            $q->orderBy('issue_indicators.indicator_text');
        }

        if (Schema::hasColumn('issues', 'is_active')) {
            $q->where('issues.is_active', true);
        }
        if ($conventionId !== null && $conventionId !== '') {
            $q->where('issues.convention_id', (int) $conventionId);
        }
        if ($entryKind !== null && $entryKind !== '') {
            $q->where('issues.entry_kind', $entryKind === 'recommendation' ? 'recommendation' : 'issue');
        }
        if ($categoryId !== null && $categoryId !== '') {
            $q->where('issues.category_id', (int) $categoryId);
        }
        if ($articleId !== null && $articleId !== '') {
            $q->whereExists(function ($sub) use ($articleId) {
                $sub->from('issue_articles')
                    ->whereColumn('issue_articles.issue_id', 'issues.id')
                    ->where('issue_articles.article_id', (int) $articleId);
            });
        }

        $rows = $q->get();

        $yearsByIndicator = $this->collectionYearsByIndicator(
            $rows->pluck('id')->map(fn ($id) => (int) $id)->all(),
        );

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'id' => (int) $r->id,
                'issue_id' => (int) $r->issue_id,
                'indicator_text' => $r->indicator_text,
                'collection_years' => $yearsByIndicator[(int) $r->id] ?? [],
            ]),
        ]);
    }

    /**
     * Distinct collection years used in each indicator's disaggregated/year data.
     *
     * @param  list<int>  $indicatorIds
     * @return array<int, list<array{id: int, label: string}>>
     */
    private function collectionYearsByIndicator(array $indicatorIds): array
    {
        if ($indicatorIds === []) {
            return [];
        }

        $select = [
            'src.issue_indicator_id as ind_id',
            'collection_years.id as year_id',
            'collection_years.label as label',
            'collection_years.sort_order as sort_order',
        ];

        $genderYears = DB::table('issue_indicator_year_gender as src')
            ->join('collection_years', 'collection_years.id', '=', 'src.collection_year_id')
            ->whereIn('src.issue_indicator_id', $indicatorIds)
            ->select($select);

        $rows = DB::table('issue_indicator_years as src')
            ->join('collection_years', 'collection_years.id', '=', 'src.collection_year_id')
            ->whereIn('src.issue_indicator_id', $indicatorIds)
            ->select($select)
            ->union($genderYears)
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $indId = (int) $row->ind_id;
            $yearId = (int) $row->year_id;
            $map[$indId][$yearId] = [
                'id' => $yearId,
                'label' => (string) $row->label,
                'sort_order' => (int) $row->sort_order,
            ];
        }

        $out = [];
        foreach ($map as $indId => $years) {
            $list = array_values($years);
            usort($list, function ($a, $b) {
                return [$b['sort_order'], $b['label']] <=> [$a['sort_order'], $a['label']];
            });
            $out[$indId] = array_map(fn ($y) => ['id' => $y['id'], 'label' => $y['label']], $list);
        }

        return $out;
    }

    /**
     * Catalog totals for the reporting dashboard summary cards.
     * Reflects real DB totals, narrowed by the active catalog filters.
     */
    public function summary(Request $request): JsonResponse
    {
        $conventionId = $this->intParam($request->query('convention_id'));
        $locked = HrimsAccess::conventionId($request->user());
        if ($locked !== null) {
            $conventionId = $locked;
        }
        $articleId = $this->intParam($request->query('article_id'));
        $categoryId = $this->intParam($request->query('category_id'));
        $yearId = $this->intParam($request->query('collection_year_id'));
        $entryKind = $request->query('entry_kind');
        $entryKind = in_array($entryKind, ['issue', 'recommendation'], true) ? $entryKind : null;

        $articleQ = Article::query();
        if (Schema::hasColumn('articles', 'is_active')) {
            $articleQ->where('is_active', true);
        }
        if ($conventionId !== null) {
            $articleQ->where('convention_id', $conventionId);
        }
        $articlesCount = $articleId !== null ? 1 : $articleQ->count();

        $catQ = IssueCategory::query();
        if (Schema::hasColumn('issue_categories', 'is_active')) {
            $catQ->where('is_active', true);
        }
        $categoriesCount = $categoryId !== null ? 1 : $catQ->count();

        $loiCount = $entryKind === 'recommendation'
            ? 0
            : $this->issuesQuery($conventionId, $articleId, $categoryId, $yearId, 'issue')->count();
        $concludingCount = $entryKind === 'issue'
            ? 0
            : $this->issuesQuery($conventionId, $articleId, $categoryId, $yearId, 'recommendation')->count();

        $loiIndicatorCount = $entryKind === 'recommendation'
            ? 0
            : $this->indicatorsQuery($conventionId, $articleId, $categoryId, $yearId, 'issue')->count();
        $concludingIndicatorCount = $entryKind === 'issue'
            ? 0
            : $this->indicatorsQuery($conventionId, $articleId, $categoryId, $yearId, 'recommendation')->count();

        return response()->json([
            'data' => [
                'articles' => $articlesCount,
                'categories' => $categoriesCount,
                'loi_count' => $loiCount,
                'loi_indicator_count' => $loiIndicatorCount,
                'concluding_count' => $concludingCount,
                'concluding_indicator_count' => $concludingIndicatorCount,
            ],
        ]);
    }

    private function intParam(mixed $value): ?int
    {
        return $value !== null && $value !== '' ? (int) $value : null;
    }

    /**
     * @return \Illuminate\Database\Query\Builder
     */
    private function issuesQuery(?int $conventionId, ?int $articleId, ?int $categoryId, ?int $yearId, string $entryKind)
    {
        $q = DB::table('issues')->where('issues.entry_kind', $entryKind);
        if (Schema::hasColumn('issues', 'is_active')) {
            $q->where('issues.is_active', true);
        }
        if ($conventionId !== null) {
            $q->where('issues.convention_id', $conventionId);
        }
        if ($categoryId !== null) {
            $q->where('issues.category_id', $categoryId);
        }
        if ($articleId !== null) {
            $q->whereExists(function ($sub) use ($articleId) {
                $sub->from('issue_articles')
                    ->whereColumn('issue_articles.issue_id', 'issues.id')
                    ->where('issue_articles.article_id', $articleId);
            });
        }
        if ($yearId !== null) {
            $q->whereExists(function ($sub) use ($yearId) {
                $sub->from('issue_indicators')
                    ->whereColumn('issue_indicators.issue_id', 'issues.id');
                $this->applyIndicatorYear($sub, $yearId);
            });
        }

        return $q;
    }

    /**
     * @return \Illuminate\Database\Query\Builder
     */
    private function indicatorsQuery(?int $conventionId, ?int $articleId, ?int $categoryId, ?int $yearId, string $entryKind)
    {
        $q = DB::table('issue_indicators')
            ->join('issues', 'issues.id', '=', 'issue_indicators.issue_id')
            ->where('issues.entry_kind', $entryKind);
        if (Schema::hasColumn('issue_indicators', 'is_active')) {
            $q->where('issue_indicators.is_active', true);
        }
        if (Schema::hasColumn('issues', 'is_active')) {
            $q->where('issues.is_active', true);
        }
        if ($conventionId !== null) {
            $q->where('issues.convention_id', $conventionId);
        }
        if ($categoryId !== null) {
            $q->where('issues.category_id', $categoryId);
        }
        if ($articleId !== null) {
            $q->whereExists(function ($sub) use ($articleId) {
                $sub->from('issue_articles')
                    ->whereColumn('issue_articles.issue_id', 'issues.id')
                    ->where('issue_articles.article_id', $articleId);
            });
        }
        if ($yearId !== null) {
            $this->applyIndicatorYear($q, $yearId);
        }

        return $q;
    }

    /**
     * Restrict to indicators that collect data in the given year (gender or year-only rows).
     */
    private function applyIndicatorYear(mixed $query, int $yearId): void
    {
        $query->where(function ($w) use ($yearId) {
            $w->whereExists(function ($g) use ($yearId) {
                $g->from('issue_indicator_year_gender')
                    ->whereColumn('issue_indicator_year_gender.issue_indicator_id', 'issue_indicators.id')
                    ->where('issue_indicator_year_gender.collection_year_id', $yearId);
            })->orWhereExists(function ($y) use ($yearId) {
                $y->from('issue_indicator_years')
                    ->whereColumn('issue_indicator_years.issue_indicator_id', 'issue_indicators.id')
                    ->where('issue_indicator_years.collection_year_id', $yearId);
            });
        });
    }

    public function issueArticleLinks(Request $request): JsonResponse
    {
        $conventionId = $request->query('convention_id');
        $locked = HrimsAccess::conventionId($request->user());
        if ($locked !== null) {
            $conventionId = $locked;
        }

        $q = DB::table('issue_articles')
            ->join('issues', 'issues.id', '=', 'issue_articles.issue_id')
            ->select(['issue_articles.issue_id', 'issue_articles.article_id']);

        if ($conventionId !== null && $conventionId !== '') {
            $q->where('issues.convention_id', (int) $conventionId);
        }

        $rows = $q->get();

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'issue_id' => (int) $r->issue_id,
                'article_id' => (int) $r->article_id,
            ]),
        ]);
    }
}
