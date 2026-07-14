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
        $rows = IssueCategory::query()->orderByDesc('updated_at')->orderByDesc('created_at')->orderByDesc('id')->get();

        return response()->json([
            'data' => $rows->map(fn (IssueCategory $c) => $this->serialize($c)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);
        $category = IssueCategory::query()->create([
            'name' => $data['name'],
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->serialize($category)], 201);
    }

    public function update(Request $request, IssueCategory $issue_category): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $issue_category->forceFill($data)->save();

        return response()->json(['data' => $this->serialize($issue_category)]);
    }

    public function destroy(IssueCategory $issue_category): JsonResponse
    {
        if ($issue_category->issues()->exists()) {
            return response()->json(['message' => 'Category is used by one or more issues. Reassign or delete those issues first.'], 422);
        }
        $issue_category->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(IssueCategory $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'is_active' => (bool) ($c->is_active ?? true),
            'created_at' => optional($c->created_at)?->toIso8601String(),
            'updated_at' => optional($c->updated_at)?->toIso8601String(),
        ];
    }
}
