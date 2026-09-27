<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprCategory;
use App\Models\UprRecommendationEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UprRecommendationEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cycleId = $request->query('upr_cycle_id');
        $categoryId = $request->query('upr_category_id');

        $rows = UprRecommendationEntry::query()
            ->with([
                'cycle:id,name,upr_type_id',
                'category:id,name,upr_cycle_id',
            ])
            ->when(
                $cycleId !== null && $cycleId !== '',
                fn ($q) => $q->where('upr_cycle_id', (int) $cycleId),
            )
            ->when(
                $categoryId !== null && $categoryId !== '',
                fn ($q) => $q->where('upr_category_id', (int) $categoryId),
            )
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (UprRecommendationEntry $row) => $this->serialize($row)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'upr_cycle_id' => ['required', 'integer', 'exists:upr_cycles,id'],
            'upr_category_id' => ['required', 'integer', 'exists:upr_categories,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('upr_recommendation_entries', 'name')->where(
                    fn ($q) => $q->where('upr_category_id', $request->input('upr_category_id')),
                ),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $this->assertCategoryBelongsToCycle((int) $data['upr_category_id'], (int) $data['upr_cycle_id']);

        $row = UprRecommendationEntry::query()->create([
            'upr_cycle_id' => (int) $data['upr_cycle_id'],
            'upr_category_id' => (int) $data['upr_category_id'],
            'name' => $data['name'],
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);
        $row->load(['cycle:id,name,upr_type_id', 'category:id,name,upr_cycle_id']);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, UprRecommendationEntry $uprRecommendationEntry): JsonResponse
    {
        $cycleId = (int) $request->input('upr_cycle_id', $uprRecommendationEntry->upr_cycle_id);
        $categoryId = (int) $request->input('upr_category_id', $uprRecommendationEntry->upr_category_id);

        $data = $request->validate([
            'upr_cycle_id' => ['sometimes', 'required', 'integer', 'exists:upr_cycles,id'],
            'upr_category_id' => ['sometimes', 'required', 'integer', 'exists:upr_categories,id'],
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('upr_recommendation_entries', 'name')
                    ->where(fn ($q) => $q->where('upr_category_id', $categoryId))
                    ->ignore($uprRecommendationEntry->id),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('upr_cycle_id', $data) || array_key_exists('upr_category_id', $data)) {
            $this->assertCategoryBelongsToCycle($categoryId, $cycleId);
        }

        $uprRecommendationEntry->fill($data);
        $uprRecommendationEntry->save();
        $uprRecommendationEntry->load(['cycle:id,name,upr_type_id', 'category:id,name,upr_cycle_id']);

        return response()->json([
            'data' => $this->serialize(
                $uprRecommendationEntry->fresh(['cycle:id,name,upr_type_id', 'category:id,name,upr_cycle_id']),
            ),
        ]);
    }

    public function destroy(UprRecommendationEntry $uprRecommendationEntry): JsonResponse
    {
        $uprRecommendationEntry->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function assertCategoryBelongsToCycle(int $categoryId, int $cycleId): void
    {
        $category = UprCategory::query()->find($categoryId);
        if ($category === null) {
            throw ValidationException::withMessages([
                'upr_category_id' => ['Selected category was not found.'],
            ]);
        }
        if ((int) ($category->upr_cycle_id ?? 0) !== $cycleId) {
            throw ValidationException::withMessages([
                'upr_category_id' => ['Selected category does not belong to the selected cycle.'],
            ]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(UprRecommendationEntry $row): array
    {
        return [
            'id' => $row->id,
            'upr_cycle_id' => (int) $row->upr_cycle_id,
            'upr_category_id' => (int) $row->upr_category_id,
            'cycle' => $row->relationLoaded('cycle') && $row->cycle ? [
                'id' => $row->cycle->id,
                'name' => $row->cycle->name,
                'upr_type_id' => $row->cycle->upr_type_id !== null ? (int) $row->cycle->upr_type_id : null,
            ] : null,
            'category' => $row->relationLoaded('category') && $row->category ? [
                'id' => $row->category->id,
                'name' => $row->category->name,
                'upr_cycle_id' => $row->category->upr_cycle_id !== null ? (int) $row->category->upr_cycle_id : null,
            ] : null,
            'name' => $row->name,
            'sort_order' => (int) ($row->sort_order ?? 0),
            'is_active' => (bool) ($row->is_active ?? true),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
