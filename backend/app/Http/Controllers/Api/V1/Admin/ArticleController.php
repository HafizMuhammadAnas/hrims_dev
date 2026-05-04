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
            'data' => $rows->map(fn (Article $a) => [
                'id' => $a->id,
                'article_name' => $a->article_name,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'article_name' => ['required', 'string', 'max:255'],
        ]);
        $article = Article::query()->create($data);

        return response()->json([
            'data' => [
                'id' => $article->id,
                'article_name' => $article->article_name,
            ],
        ], 201);
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
