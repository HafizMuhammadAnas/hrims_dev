<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Convention;
use App\Models\IssueCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ReportLookupController extends Controller
{
    public function conventions(): JsonResponse
    {
        $q = Convention::query();
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
        $articleId = $request->query('article_id');
        $entryKind = $request->query('entry_kind');
        $categoryId = $request->query('category_id');

        $q = DB::table('issue_indicators')
            ->join('issues', 'issues.id', '=', 'issue_indicators.issue_id')
            ->select([
                'issue_indicators.id',
                'issue_indicators.issue_id',
                'issue_indicators.indicator_text',
            ])
            ->orderBy('issue_indicators.indicator_text');

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

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'id' => (int) $r->id,
                'issue_id' => (int) $r->issue_id,
                'indicator_text' => $r->indicator_text,
            ]),
        ]);
    }

    public function issueArticleLinks(Request $request): JsonResponse
    {
        $conventionId = $request->query('convention_id');

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
