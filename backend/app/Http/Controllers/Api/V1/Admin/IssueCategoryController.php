<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\IssueCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class IssueCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $conventionId = $request->query('convention_id');
        $hasConvention = Schema::hasColumn('issue_categories', 'convention_id');

        $rows = IssueCategory::query()
            ->when($hasConvention, fn ($q) => $q->with('convention:id,code,name'))
            ->when(
                $hasConvention && $conventionId !== null && $conventionId !== '',
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
        if (! Schema::hasColumn('issue_categories', 'convention_id')) {
            return response()->json([
                'message' => 'Category convention mapping is not available until the migration has been applied.',
            ], 503);
        }

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
        $hasConvention = Schema::hasColumn('issue_categories', 'convention_id');
        $conventionId = $hasConvention
            ? (int) ($request->input('convention_id', $issue_category->convention_id) ?? $issue_category->convention_id)
            : 0;

        $rules = [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ];
        if ($hasConvention) {
            $rules['convention_id'] = ['sometimes', 'required', 'integer', 'exists:conventions,id'];
            $rules['name'][] = Rule::unique('issue_categories', 'name')
                ->where('convention_id', $conventionId)
                ->ignore($issue_category->id);
        }

        $data = $request->validate($rules);

        if ($hasConvention && array_key_exists('convention_id', $data)) {
            $newConventionId = (int) $data['convention_id'];
            if ($issue_category->issues()->where('convention_id', '!=', $newConventionId)->exists()) {
                return response()->json([
                    'message' => 'Convention cannot be changed while this category is linked to issues under another convention.',
                ], 422);
            }
        }

        $issue_category->forceFill($data)->save();
        if ($hasConvention) {
            $issue_category->load('convention:id,code,name');
        }

        return response()->json(['data' => $this->serialize($issue_category->fresh($hasConvention ? ['convention:id,code,name'] : []))]);
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
        $hasConvention = Schema::hasColumn('issue_categories', 'convention_id');

        return [
            'id' => $c->id,
            'convention_id' => $hasConvention && $c->convention_id !== null ? (int) $c->convention_id : null,
            'convention' => $hasConvention && $c->relationLoaded('convention') && $c->convention ? [
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
