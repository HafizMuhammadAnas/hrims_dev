<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Issue;
use App\Models\IssueIndicator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class IssueController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Issue::query()
            ->with([
                'convention:id,code,name',
                'category:id,name',
                'articles:id,article_name',
                'indicators',
            ])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (Issue $i) => $this->serializeDetail($i)),
        ]);
    }

    public function show(Issue $issue): JsonResponse
    {
        $issue->load([
            'convention:id,code,name',
            'category:id,name',
            'articles:id,article_name',
            'indicators',
        ]);

        return response()->json(['data' => $this->serializeDetail($issue)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, false);

        $issue = DB::transaction(function () use ($data) {
            $issue = Issue::query()->create([
                'convention_id' => $data['convention_id'],
                'category_id' => $data['category_id'],
                'issue_title' => $data['issue_title'],
                'description' => isset($data['description']) && $data['description'] !== ''
                    ? (string) $data['description']
                    : null,
                'has_quantitative' => (bool) ($data['has_quantitative'] ?? false),
                'has_qualitative' => (bool) ($data['has_qualitative'] ?? false),
            ]);
            $this->syncArticles($issue, $data['articles']);
            $this->replaceIndicators($issue, $data['indicators'] ?? []);

            return $issue->fresh([
                'convention:id,code,name',
                'category:id,name',
                'articles:id,article_name',
                'indicators',
            ]);
        });

        return response()->json(['data' => $this->serializeDetail($issue)], 201);
    }

    public function update(Request $request, Issue $issue): JsonResponse
    {
        $data = $this->validatePayload($request, true);

        DB::transaction(function () use ($issue, $data) {
            $scalar = collect($data)->only([
                'convention_id',
                'category_id',
                'issue_title',
                'description',
                'has_quantitative',
                'has_qualitative',
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

        $issue->load([
            'convention:id,code,name',
            'category:id,name',
            'articles:id,article_name',
            'indicators',
        ]);

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
    private function validatePayload(Request $request, bool $partial): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'convention_id' => [$req, 'integer', 'exists:conventions,id'],
            'category_id' => [$req, 'integer', 'exists:issue_categories,id'],
            'issue_title' => [$req, 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'has_quantitative' => [$partial ? 'sometimes' : 'required', 'boolean'],
            'has_qualitative' => [$partial ? 'sometimes' : 'required', 'boolean'],
            'articles' => [$partial ? 'sometimes' : 'required', 'array', 'min:1'],
            'articles.*.article_id' => ['required', 'integer', 'exists:articles,id'],
            'articles.*.relevant_paragraph' => ['nullable', 'string'],
            'indicators' => ['sometimes', 'array'],
            'indicators.*.indicator_text' => ['required_with:indicators', 'string'],
            'indicators.*.disaggregation' => ['nullable', 'string'],
            'indicators.*.has_quantitative' => ['sometimes', 'boolean'],
            'indicators.*.has_qualitative' => ['sometimes', 'boolean'],
        ]);
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
        foreach ($rows as $row) {
            $text = trim((string) ($row['indicator_text'] ?? ''));
            if ($text === '') {
                continue;
            }
            IssueIndicator::query()->create([
                'issue_id' => $issue->id,
                'indicator_text' => $text,
                'disaggregation' => isset($row['disaggregation']) && $row['disaggregation'] !== ''
                    ? (string) $row['disaggregation']
                    : null,
                'has_quantitative' => (bool) ($row['has_quantitative'] ?? false),
                'has_qualitative' => (bool) ($row['has_qualitative'] ?? false),
            ]);
        }
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
                    'relevant_paragraph' => $a->pivot->relevant_paragraph ?? null,
                ];
            }
        }

        $indicatorsOut = [];
        if ($i->relationLoaded('indicators')) {
            $indicatorsOut = $i->indicators->map(fn (IssueIndicator $ind) => [
                'id' => $ind->id,
                'indicator_text' => $ind->indicator_text,
                'disaggregation' => $ind->disaggregation,
                'has_quantitative' => (bool) $ind->has_quantitative,
                'has_qualitative' => (bool) $ind->has_qualitative,
            ])->values()->all();
        }

        return [
            'id' => $i->id,
            'convention_id' => $i->convention_id,
            'category_id' => $i->category_id,
            'issue_title' => $i->issue_title,
            'description' => $i->description,
            'has_quantitative' => (bool) $i->has_quantitative,
            'has_qualitative' => (bool) $i->has_qualitative,
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
