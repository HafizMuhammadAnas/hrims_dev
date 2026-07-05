<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ArticleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $conventionId = $request->query('convention_id');
        $rows = Article::query()
            ->with('convention:id,code,name')
            ->when(
                $conventionId !== null && $conventionId !== '',
                fn ($q) => $q->where('convention_id', (int) $conventionId),
            )
            ->orderBy('convention_id')
            ->orderBy('article_name')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (Article $a) => $this->serialize($a)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'convention_id' => ['required', 'integer', 'exists:conventions,id'],
            'article_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('articles', 'article_name')->where('convention_id', (int) $request->input('convention_id')),
            ],
            'description' => ['nullable', 'string'],
        ]);
        $article = Article::query()->create([
            'convention_id' => (int) $data['convention_id'],
            'article_name' => $data['article_name'],
            'description' => isset($data['description']) && $data['description'] !== ''
                ? (string) $data['description']
                : null,
            'is_active' => true,
        ]);
        $article->load('convention:id,code,name');

        return response()->json(['data' => $this->serialize($article)], 201);
    }

    public function update(Request $request, Article $article): JsonResponse
    {
        $conventionId = (int) ($request->input('convention_id', $article->convention_id) ?? $article->convention_id);
        $data = $request->validate([
            'convention_id' => ['sometimes', 'required', 'integer', 'exists:conventions,id'],
            'article_name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('articles', 'article_name')
                    ->where('convention_id', $conventionId)
                    ->ignore($article->id),
            ],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('convention_id', $data)) {
            $newConventionId = (int) $data['convention_id'];
            if ($article->issues()->where('convention_id', '!=', $newConventionId)->exists()) {
                return response()->json([
                    'message' => 'Convention cannot be changed while this article is linked to issues under another convention.',
                ], 422);
            }
        }

        if (array_key_exists('description', $data) && ($data['description'] === '' || $data['description'] === null)) {
            $data['description'] = null;
        }
        $article->forceFill($data)->save();

        return response()->json(['data' => $this->serialize($article->fresh(['convention:id,code,name']))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Article $a): array
    {
        return [
            'id' => $a->id,
            'convention_id' => (int) $a->convention_id,
            'convention' => $a->convention ? [
                'id' => $a->convention->id,
                'code' => $a->convention->code,
                'name' => $a->convention->name,
            ] : null,
            'article_name' => $a->article_name,
            'description' => $a->description,
            'is_active' => (bool) ($a->is_active ?? true),
        ];
    }

    public function destroy(Article $article): JsonResponse
    {
        if ($article->issues()->exists()) {
            return response()->json(['message' => 'Article is linked to one or more issues. Remove links first.'], 422);
        }
        $article->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
