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

    public function update(Request $request, IssueCategory $issue_category): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);
        $issue_category->forceFill($data)->save();

        return response()->json([
            'data' => [
                'id' => $issue_category->id,
                'name' => $issue_category->name,
            ],
        ]);
    }

    public function destroy(IssueCategory $issue_category): JsonResponse
    {
        if ($issue_category->issues()->exists()) {
            return response()->json(['message' => 'Category is used by one or more issues. Reassign or delete those issues first.'], 422);
        }
        $issue_category->delete();

        return response()->json(['message' => 'Deleted']);
    }
}
