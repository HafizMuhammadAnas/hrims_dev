<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\IssueCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IssueCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = IssueCategory::query()->orderBy('name')->get();

        return response()->json([
            'data' => $rows->map(fn (IssueCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);
        $category = IssueCategory::query()->create($data);

        return response()->json([
            'data' => [
                'id' => $category->id,
                'name' => $category->name,
            ],
        ], 201);
    }
}
