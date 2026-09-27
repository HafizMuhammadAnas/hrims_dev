<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Convention;
use App\Models\Issue;
use App\Models\IssueIndicator;
use App\Models\KnowledgeCard;
use App\Models\KnowledgeUprEntry;
use App\Models\SdgNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class KnowledgeHubController extends Controller
{
    public function conventions(): JsonResponse
    {
        $rows = Convention::query()
            ->where('is_active', true)
            ->withCount($this->conventionCountRelations())
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows->map(fn (Convention $c) => $this->serializeConvention($c))]);
    }

    public function showConvention(Convention $convention): JsonResponse
    {
        if (! $convention->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $convention->loadCount($this->conventionCountRelations());

        $components = $convention->components()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => [
                ...$this->serializeConvention($convention),
                'components' => $components->map(fn ($x) => [
                    'id' => $x->id,
                    'type' => $x->type,
                    'code' => $x->code,
                    'title' => $x->title,
                    'body' => $x->body,
                    'sort_order' => $x->sort_order,
                ])->all(),
            ],
        ]);
    }

    /**
     * Category | Indicator catalog for Knowledge Hub → Human Rights Indicators.
     */
    public function conventionIndicatorCatalog(Convention $convention): JsonResponse
    {
        if (! $convention->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $convention->loadCount($this->conventionCountRelations());

        $q = DB::table('issue_indicators')
            ->join('issues', 'issues.id', '=', 'issue_indicators.issue_id')
            ->leftJoin('issue_categories', 'issue_categories.id', '=', 'issues.category_id')
            ->where('issues.convention_id', $convention->id)
            ->select([
                'issue_categories.id as category_id',
                'issue_categories.name as category_name',
                'issue_indicators.id as indicator_id',
                'issue_indicators.indicator_text',
                'issues.id as issue_id',
            ]);

        if (Schema::hasColumn('issues', 'is_active')) {
            $q->where('issues.is_active', true);
        }
        if (Schema::hasColumn('issue_indicators', 'is_active')) {
            $q->where('issue_indicators.is_active', true);
        }

        $q->orderBy('issue_categories.name')
            ->orderBy('issues.id');
        if (Schema::hasColumn('issue_indicators', 'sort_order')) {
            $q->orderBy('issue_indicators.sort_order');
        }
        $q->orderBy('issue_indicators.id');

        $rows = $q->get();

        return response()->json([
            'data' => [
                'convention' => $this->serializeConvention($convention),
                'categories_count' => (int) ($convention->categories_count ?? 0),
                'indicators_count' => (int) ($convention->indicators_count ?? 0),
                'rows' => $rows->map(fn ($r) => [
                    'category_id' => $r->category_id !== null ? (int) $r->category_id : null,
                    'category_name' => trim((string) ($r->category_name ?? '')) !== ''
                        ? (string) $r->category_name
                        : 'Uncategorized',
                    'indicator_id' => (int) $r->indicator_id,
                    'indicator_text' => (string) $r->indicator_text,
                    'issue_id' => (int) $r->issue_id,
                ])->all(),
            ],
        ]);
    }

    public function conventionArticles(Convention $convention): JsonResponse
    {
        if (! $convention->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $rows = Article::sortByNaturalName(
            Article::query()
                ->where('convention_id', $convention->id)
                ->where('is_active', true)
                ->with([
                    'issues' => function ($q) use ($convention): void {
                        $q->where('issues.convention_id', $convention->id)
                            ->where('issues.is_active', true)
                            ->orderBy('issues.id');
                    },
                ])
                ->get(['id', 'convention_id', 'article_name', 'description'])
        );

        return response()->json([
            'data' => $rows->map(function (Article $a) {
                $relatedLoi = [];
                $relatedObservations = [];
                foreach ($a->issues as $issue) {
                    $payload = $this->serializeRelatedIssue($issue);
                    if ($issue->entry_kind === 'recommendation') {
                        $relatedObservations[] = $payload;
                    } else {
                        $relatedLoi[] = $payload;
                    }
                }

                return [
                    'id' => $a->id,
                    'convention_id' => (int) $a->convention_id,
                    'article_name' => $a->article_name,
                    'description' => $a->description,
                    'related_loi' => $relatedLoi,
                    'related_concluding_observations' => $relatedObservations,
                ];
            })->all(),
        ]);
    }

    public function conventionIssues(Request $request, Convention $convention): JsonResponse
    {
        if (! $convention->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $entryKind = $request->query('entry_kind') === 'recommendation' ? 'recommendation' : 'issue';

        $rows = Issue::query()
            ->where('convention_id', $convention->id)
            ->where('entry_kind', $entryKind)
            ->where('is_active', true)
            ->with([
                'category:id,name',
                'articles',
            ])
            ->get();

        $sorted = $rows
            ->sort(function (Issue $a, Issue $b): int {
                $firstA = Article::sortByNaturalName($a->articles)->first();
                $firstB = Article::sortByNaturalName($b->articles)->first();

                $numA = $firstA ? Article::naturalNumberFromName($firstA->article_name) : null;
                $numB = $firstB ? Article::naturalNumberFromName($firstB->article_name) : null;

                if ($numA !== null && $numB !== null && $numA !== $numB) {
                    return $numA <=> $numB;
                }
                if ($numA !== null && $numB === null) {
                    return -1;
                }
                if ($numA === null && $numB !== null) {
                    return 1;
                }

                if ($firstA && $firstB) {
                    $byName = strnatcasecmp((string) $firstA->article_name, (string) $firstB->article_name);
                    if ($byName !== 0) {
                        return $byName;
                    }
                } elseif ($firstA && ! $firstB) {
                    return -1;
                } elseif (! $firstA && $firstB) {
                    return 1;
                }

                return ((int) $a->id) <=> ((int) $b->id);
            })
            ->values();

        return response()->json([
            'data' => $sorted->map(fn (Issue $i) => $this->serializeIssueListRow($i))->all(),
        ]);
    }

    public function showIssue(Issue $issue): JsonResponse
    {
        if (! $issue->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $issue->load([
            'convention:id,code,name',
            'category:id,name',
            'articles',
            'indicators.yearGenderCells.collectionYear:id,label,sort_order',
            'indicators.yearGenderCells.collectionGender:id,name,sort_order',
            'indicators.yearReligionCells.collectionYear:id,label,sort_order',
            'indicators.yearReligionCells.collectionReligion:id,name,sort_order',
            'indicators.collectionYearRows.collectionYear:id,label,sort_order',
        ]);

        return response()->json(['data' => $this->serializeIssueDetail($issue)]);
    }

    public function sdgGoals(): JsonResponse
    {
        $rows = SdgNode::query()
            ->where('node_type', 'goal')
            ->orderBy('goal_number')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (SdgNode $n) => $this->serializeSdgGoal($n))]);
    }

    public function indicators(): JsonResponse
    {
        return $this->cardsForSection('indicators');
    }

    public function uprHighlights(): JsonResponse
    {
        return $this->cardsForSection('upr');
    }

    public function uprEntries(): JsonResponse
    {
        $rows = KnowledgeUprEntry::query()
            ->where('is_active', true)
            ->with(['cycle:id,name,upr_type_id'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (KnowledgeUprEntry $row) => $this->serializeUprEntry($row)),
        ]);
    }

    public function showUprEntry(KnowledgeUprEntry $knowledgeUprEntry): JsonResponse
    {
        if (! (bool) ($knowledgeUprEntry->is_active ?? true)) {
            return response()->json(['message' => 'Not found'], 404);
        }
        $knowledgeUprEntry->load(['cycle:id,name,upr_type_id']);

        return response()->json(['data' => $this->serializeUprEntry($knowledgeUprEntry)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUprEntry(KnowledgeUprEntry $row): array
    {
        return [
            'id' => $row->id,
            'kind' => $row->kind,
            'title' => $row->title,
            'display_title' => $row->displayTitle(),
            'upr_cycle_id' => $row->upr_cycle_id !== null ? (int) $row->upr_cycle_id : null,
            'cycle' => $row->relationLoaded('cycle') && $row->cycle ? [
                'id' => $row->cycle->id,
                'name' => $row->cycle->name,
            ] : null,
            'introduction' => $row->introduction,
            'repositories' => KnowledgeUprEntry::normalizeRepositories($row->repositories),
            'repository_labels' => KnowledgeUprEntry::REPOSITORY_LABELS,
            'analysis_files' => KnowledgeUprEntry::normalizeAnalysisFiles($row->analysis_files),
            'sort_order' => (int) ($row->sort_order ?? 0),
        ];
    }

    private function cardsForSection(string $section): JsonResponse
    {
        $rows = KnowledgeCard::query()
            ->where('section', $section)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (KnowledgeCard $k) => $this->serializeCard($k))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeConvention(Convention $c): array
    {
        return [
            'id' => $c->id,
            'code' => $c->code,
            'name' => $c->name,
            'knowledge_icon' => $c->knowledge_icon,
            'knowledge_adopted' => $c->knowledge_adopted,
            'knowledge_ratified' => $c->knowledge_ratified,
            'knowledge_articles' => $c->knowledge_articles,
            'knowledge_implementation' => $c->knowledge_implementation,
            'articles_count' => (int) ($c->articles_count ?? 0),
            'categories_count' => (int) ($c->categories_count ?? 0),
            'indicators_count' => (int) ($c->indicators_count ?? 0),
            'description' => $c->description,
            'repositories' => $c->normalizedRepositories(),
            'optional_protocol_body' => $c->optional_protocol_body,
            'sort_order' => $c->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSdgGoal(SdgNode $n): array
    {
        return [
            'id' => $n->id,
            'code' => $n->code,
            'title' => $n->title,
            'goal_number' => $n->goal_number,
            'knowledge_icon' => $n->knowledge_icon,
            'summary' => $n->summary,
            'body' => $n->body,
            'stat_1_value' => $n->stat_1_value,
            'stat_1_label' => $n->stat_1_label,
            'stat_2_value' => $n->stat_2_value,
            'stat_2_label' => $n->stat_2_label,
            'sort_order' => $n->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCard(KnowledgeCard $k): array
    {
        return [
            'id' => $k->id,
            'section' => $k->section,
            'icon' => $k->icon,
            'title' => $k->title,
            'summary' => $k->summary,
            'stat_1_value' => $k->stat_1_value,
            'stat_1_label' => $k->stat_1_label,
            'stat_2_value' => $k->stat_2_value,
            'stat_2_label' => $k->stat_2_label,
            'body' => $k->body,
            'sort_order' => $k->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRelatedIssue(Issue $i): array
    {
        return [
            'id' => $i->id,
            'entry_kind' => $i->entry_kind === 'recommendation' ? 'recommendation' : 'issue',
            'issue_title' => $i->issue_title,
            'description' => $i->description,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeIssueListRow(Issue $i): array
    {
        $articlesOut = [];
        if ($i->relationLoaded('articles')) {
            foreach (Article::sortByNaturalName($i->articles) as $a) {
                $articlesOut[] = [
                    'id' => $a->id,
                    'article_name' => $a->article_name,
                    'description' => $a->description,
                    'relevant_paragraph' => $a->pivot->relevant_paragraph ?? null,
                ];
            }
        }

        return [
            'id' => $i->id,
            'convention_id' => $i->convention_id,
            'category_id' => $i->category_id,
            'entry_kind' => $i->entry_kind === 'recommendation' ? 'recommendation' : 'issue',
            'issue_title' => $i->issue_title,
            'description' => $i->description,
            'is_active' => (bool) ($i->is_active ?? true),
            'category' => $i->relationLoaded('category') && $i->category
                ? ['id' => $i->category->id, 'name' => $i->category->name]
                : null,
            'articles' => $articlesOut,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeIssueDetail(Issue $i): array
    {
        $base = $this->serializeIssueListRow($i);
        $base['has_quantitative'] = (bool) $i->has_quantitative;
        $base['has_qualitative'] = (bool) $i->has_qualitative;
        $base['convention'] = $i->relationLoaded('convention') && $i->convention
            ? ['id' => $i->convention->id, 'code' => $i->convention->code, 'name' => $i->convention->name]
            : null;
        $base['indicators'] = $i->relationLoaded('indicators')
            ? $i->indicators->map(fn (IssueIndicator $ind) => $ind->toAdminApiArray())->values()->all()
            : [];

        return $base;
    }

    /**
     * @return array<string, \Closure>
     */
    private function conventionCountRelations(): array
    {
        $relations = [
            'articles' => fn ($q) => $q->where('is_active', true),
            'issueCategories as categories_count' => fn ($q) => $q->where('is_active', true),
        ];

        $relations['issueIndicators as indicators_count'] = function ($q): void {
            if (Schema::hasColumn('issues', 'is_active')) {
                $q->where('issues.is_active', true);
            }
            if (IssueIndicator::hasIsActiveColumn()) {
                $q->where('issue_indicators.is_active', true);
            }
        };

        return $relations;
    }
}
