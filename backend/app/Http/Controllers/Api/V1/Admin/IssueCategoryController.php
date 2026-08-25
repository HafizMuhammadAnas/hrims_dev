<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\IssueCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class IssueCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $conventionId = $request->query('convention_id');
        $rows = IssueCategory::query()
            ->with('convention:id,code,name')
            ->when(
                $conventionId !== null && $conventionId !== '',
                fn ($q) => $q->where('convention_id', (int) $conventionId),
            )
            ->orderByDesc('updated_at')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (IssueCategory $c) => $this->serialize($c)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'convention_id' => ['required', 'integer', 'exists:conventions,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('issue_categories', 'name')->where('convention_id', (int) $request->input('convention_id')),
            ],
        ]);
        $category = IssueCategory::query()->create([
            'convention_id' => (int) $data['convention_id'],
            'name' => $data['name'],
            'is_active' => true,
        ]);
        $category->load('convention:id,code,name');

        return response()->json(['data' => $this->serialize($category)], 201);
    }

    public function update(Request $request, IssueCategory $issue_category): JsonResponse
    {
        $conventionId = (int) ($request->input('convention_id', $issue_category->convention_id) ?? $issue_category->convention_id);
        $data = $request->validate([
            'convention_id' => ['sometimes', 'required', 'integer', 'exists:conventions,id'],
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('issue_categories', 'name')
                    ->where('convention_id', $conventionId)
                    ->ignore($issue_category->id),
            ],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('convention_id', $data)) {
            $newConventionId = (int) $data['convention_id'];
            if ($issue_category->issues()->where('convention_id', '!=', $newConventionId)->exists()) {
                return response()->json([
                    'message' => 'Convention cannot be changed while this category is linked to issues under another convention.',
                ], 422);
            }
        }

        $issue_category->forceFill($data)->save();

        return response()->json(['data' => $this->serialize($issue_category->fresh(['convention:id,code,name']))]);
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
            'convention_id' => (int) $c->convention_id,
            'convention' => $c->convention ? [
                'id' => $c->convention->id,
                'code' => $c->convention->code,
                'name' => $c->convention->name,
            ] : null,
            'name' => $c->name,
            'is_active' => (bool) ($c->is_active ?? true),
            'created_at' => optional($c->created_at)?->toIso8601String(),
            'updated_at' => optional($c->updated_at)?->toIso8601String(),
        ];
    }
}
