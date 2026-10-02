<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprCategory;
use App\Models\UprRecommendationEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UprRecommendationEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cycleId = $request->query('upr_cycle_id');
        $categoryId = $request->query('upr_category_id');
        $typeId = $request->query('upr_type_id');

        $rows = UprRecommendationEntry::query()
            ->with([
                'cycle:id,name',
                'category:id,name,upr_cycle_id,upr_type_id',
                'category.type:id,name',
            ])
            ->when(
                $cycleId !== null && $cycleId !== '',
                fn ($q) => $q->where('upr_cycle_id', (int) $cycleId),
            )
            ->when(
                $categoryId !== null && $categoryId !== '',
                fn ($q) => $q->where('upr_category_id', (int) $categoryId),
            )
            ->when(
                $typeId !== null && $typeId !== '',
                fn ($q) => $q->whereHas(
                    'category',
                    fn ($cq) => $cq->where('upr_type_id', (int) $typeId),
                ),
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
            'upr_type_id' => ['required', 'integer', 'exists:upr_types,id'],
            'upr_category_id' => ['required', 'integer', 'exists:upr_categories,id'],
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'names' => ['sometimes', 'array', 'min:1'],
            'names.*' => ['required', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $names = [];
        if (! empty($data['names']) && is_array($data['names'])) {
            foreach ($data['names'] as $n) {
                $trimmed = trim((string) $n);
                if ($trimmed !== '') {
                    $names[] = $trimmed;
                }
            }
        } elseif (! empty($data['name'])) {
            $trimmed = trim((string) $data['name']);
            if ($trimmed !== '') {
                $names[] = $trimmed;
            }
        }

        if ($names === []) {
            throw ValidationException::withMessages([
                'names' => ['Provide at least one recommendation name.'],
            ]);
        }

        $cycleId = (int) $data['upr_cycle_id'];
        $typeId = (int) $data['upr_type_id'];
        $categoryId = (int) $data['upr_category_id'];
        $this->assertCategoryMatchesCycleAndType($categoryId, $cycleId, $typeId);

        $uniqueNames = array_values(array_unique($names));
        foreach ($uniqueNames as $name) {
            $exists = UprRecommendationEntry::query()
                ->where('upr_category_id', $categoryId)
                ->where('name', $name)
                ->exists();
            if ($exists) {
                throw ValidationException::withMessages([
                    'names' => ["Recommendation “{$name}” already exists for this category."],
                ]);
            }
        }

        $created = DB::transaction(function () use ($data, $uniqueNames, $cycleId, $categoryId) {
            $rows = [];
            $sortBase = (int) ($data['sort_order'] ?? 0);
            foreach ($uniqueNames as $index => $name) {
                $rows[] = UprRecommendationEntry::query()->create([
                    'upr_cycle_id' => $cycleId,
                    'upr_category_id' => $categoryId,
                    'name' => $name,
                    'sort_order' => $sortBase + $index,
                    'is_active' => $data['is_active'] ?? true,
                ])->load([
                    'cycle:id,name',
                    'category:id,name,upr_cycle_id,upr_type_id',
                    'category.type:id,name',
                ]);
            }

            return $rows;
        });

        return response()->json([
            'data' => array_map(fn (UprRecommendationEntry $row) => $this->serialize($row), $created),
        ], 201);
    }

    public function update(Request $request, UprRecommendationEntry $uprRecommendationEntry): JsonResponse
    {
        $cycleId = (int) $request->input('upr_cycle_id', $uprRecommendationEntry->upr_cycle_id);
        $categoryId = (int) $request->input('upr_category_id', $uprRecommendationEntry->upr_category_id);

        $data = $request->validate([
            'upr_cycle_id' => ['sometimes', 'required', 'integer', 'exists:upr_cycles,id'],
            'upr_type_id' => ['sometimes', 'required', 'integer', 'exists:upr_types,id'],
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

        if (
            array_key_exists('upr_cycle_id', $data)
            || array_key_exists('upr_category_id', $data)
            || array_key_exists('upr_type_id', $data)
        ) {
            $category = UprCategory::query()->find($categoryId);
            $typeId = (int) ($data['upr_type_id'] ?? $category?->upr_type_id ?? 0);
            $this->assertCategoryMatchesCycleAndType($categoryId, $cycleId, $typeId);
        }

        unset($data['upr_type_id']);
        $uprRecommendationEntry->fill($data);
        $uprRecommendationEntry->save();
        $uprRecommendationEntry->load([
            'cycle:id,name',
            'category:id,name,upr_cycle_id,upr_type_id',
            'category.type:id,name',
        ]);

        return response()->json([
            'data' => $this->serialize(
                $uprRecommendationEntry->fresh([
                    'cycle:id,name',
                    'category:id,name,upr_cycle_id,upr_type_id',
                    'category.type:id,name',
                ]),
            ),
        ]);
    }

    public function destroy(UprRecommendationEntry $uprRecommendationEntry): JsonResponse
    {
        $uprRecommendationEntry->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function assertCategoryMatchesCycleAndType(int $categoryId, int $cycleId, int $typeId): void
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
        if ((int) ($category->upr_type_id ?? 0) !== $typeId) {
            throw ValidationException::withMessages([
                'upr_category_id' => ['Selected category does not belong to the selected UPR type.'],
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
            'upr_type_id' => $row->relationLoaded('category') && $row->category
                ? ($row->category->upr_type_id !== null ? (int) $row->category->upr_type_id : null)
                : null,
            'cycle' => $row->relationLoaded('cycle') && $row->cycle ? [
                'id' => $row->cycle->id,
                'name' => $row->cycle->name,
            ] : null,
            'category' => $row->relationLoaded('category') && $row->category ? [
                'id' => $row->category->id,
                'name' => $row->category->name,
                'upr_cycle_id' => $row->category->upr_cycle_id !== null ? (int) $row->category->upr_cycle_id : null,
                'upr_type_id' => $row->category->upr_type_id !== null ? (int) $row->category->upr_type_id : null,
            ] : null,
            'type' => $row->relationLoaded('category')
                && $row->category
                && $row->category->relationLoaded('type')
                && $row->category->type
                ? [
                    'id' => $row->category->type->id,
                    'name' => $row->category->type->name,
                ]
                : null,
            'name' => $row->name,
            'sort_order' => (int) ($row->sort_order ?? 0),
            'is_active' => (bool) ($row->is_active ?? true),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
