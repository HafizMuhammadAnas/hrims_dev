<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Article::query()->orderBy('article_name')->get();

        return response()->json([
            'data' => $rows->map(fn (Article $a) => $this->serialize($a)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'article_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);
        $article = Article::query()->create([
            'article_name' => $data['article_name'],
            'description' => isset($data['description']) && $data['description'] !== ''
                ? (string) $data['description']
                : null,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->serialize($article)], 201);
    }

    public function update(Request $request, Article $article): JsonResponse
    {
        $data = $request->validate([
            'article_name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('description', $data) && ($data['description'] === '' || $data['description'] === null)) {
            $data['description'] = null;
        }
        $article->forceFill($data)->save();

        return response()->json(['data' => $this->serialize($article->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Article $a): array
    {
        return [
            'id' => $a->id,
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
