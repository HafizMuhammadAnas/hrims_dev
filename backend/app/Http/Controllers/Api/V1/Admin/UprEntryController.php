<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprCategory;
use App\Models\UprEntry;
use App\Models\UprEntryIndicator;
use App\Models\UprRecommendationEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UprEntryController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = UprEntry::query()
            ->with([
                'type:id,name',
                'cycle:id,name',
                'category:id,name,upr_cycle_id',
                'recommendations:id,name,upr_cycle_id,upr_category_id',
                'indicators',
            ])
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (UprEntry $row) => $this->serialize($row)),
        ]);
    }

    public function show(UprEntry $uprEntry): JsonResponse
    {
        $uprEntry->load([
            'type:id,name',
            'cycle:id,name',
            'category:id,name,upr_cycle_id',
            'recommendations:id,name,upr_cycle_id,upr_category_id',
            'indicators',
        ]);

        return response()->json(['data' => $this->serialize($uprEntry)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'upr_type_id' => ['required', 'integer', 'exists:upr_types,id'],
            'upr_cycle_id' => ['required', 'integer', 'exists:upr_cycles,id'],
            'upr_category_id' => ['required', 'integer', 'exists:upr_categories,id'],
            'is_dummy' => ['sometimes', 'boolean'],
            'has_quantitative' => ['sometimes', 'boolean'],
            'has_qualitative' => ['sometimes', 'boolean'],
            'indicators' => ['sometimes', 'array'],
            'indicators.*.indicator_text' => ['required', 'string', 'max:5000'],
            'indicators.*.has_quantitative' => ['sometimes', 'boolean'],
            'indicators.*.has_qualitative' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_gender' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_age' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_location' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_disability' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_religion' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_consolidated' => ['sometimes', 'boolean'],
        ]);

        $this->assertCategoryMatchesCycleAndType(
            (int) $data['upr_category_id'],
            (int) $data['upr_cycle_id'],
            (int) $data['upr_type_id'],
        );

        $recommendationIds = UprRecommendationEntry::query()
            ->where('upr_cycle_id', (int) $data['upr_cycle_id'])
            ->where('upr_category_id', (int) $data['upr_category_id'])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $entry = DB::transaction(function () use ($data, $recommendationIds) {
            $indicators = $data['indicators'] ?? [];
            $hasQuantitative = (bool) ($data['has_quantitative'] ?? false);
            $hasQualitative = (bool) ($data['has_qualitative'] ?? false);
            if (! array_key_exists('has_quantitative', $data) || ! array_key_exists('has_qualitative', $data)) {
                foreach ($indicators as $row) {
                    if ((bool) ($row['has_quantitative'] ?? false)) {
                        $hasQuantitative = true;
                    }
                    if ((bool) ($row['has_qualitative'] ?? false)) {
                        $hasQualitative = true;
                    }
                }
            }

            $entry = UprEntry::query()->create([
                'upr_type_id' => (int) $data['upr_type_id'],
                'upr_cycle_id' => (int) $data['upr_cycle_id'],
                'upr_category_id' => (int) $data['upr_category_id'],
                'is_dummy' => (bool) ($data['is_dummy'] ?? false),
                'has_quantitative' => $hasQuantitative,
                'has_qualitative' => $hasQualitative,
                'is_active' => true,
            ]);

            if ($recommendationIds !== []) {
                $entry->recommendations()->sync($recommendationIds);
            }

            $this->syncIndicators($entry, $indicators);

            return $entry->fresh([
                'type:id,name',
                'cycle:id,name',
                'category:id,name,upr_cycle_id,upr_type_id',
                'recommendations:id,name,upr_cycle_id,upr_category_id',
                'indicators',
            ]);
        });

        return response()->json(['data' => $this->serialize($entry)], 201);
    }

    public function update(Request $request, UprEntry $uprEntry): JsonResponse
    {
        $data = $request->validate([
            'upr_type_id' => ['sometimes', 'required', 'integer', 'exists:upr_types,id'],
            'upr_cycle_id' => ['sometimes', 'required', 'integer', 'exists:upr_cycles,id'],
            'upr_category_id' => ['sometimes', 'required', 'integer', 'exists:upr_categories,id'],
            'is_dummy' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'has_quantitative' => ['sometimes', 'boolean'],
            'has_qualitative' => ['sometimes', 'boolean'],
            'indicators' => ['sometimes', 'array'],
            'indicators.*.id' => ['sometimes', 'integer'],
            'indicators.*.indicator_text' => ['required_with:indicators', 'string', 'max:5000'],
            'indicators.*.has_quantitative' => ['sometimes', 'boolean'],
            'indicators.*.has_qualitative' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_gender' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_age' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_location' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_disability' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_religion' => ['sometimes', 'boolean'],
            'indicators.*.collects_by_consolidated' => ['sometimes', 'boolean'],
        ]);

        $typeId = (int) ($data['upr_type_id'] ?? $uprEntry->upr_type_id);
        $cycleId = (int) ($data['upr_cycle_id'] ?? $uprEntry->upr_cycle_id);
        $categoryId = (int) ($data['upr_category_id'] ?? $uprEntry->upr_category_id);

        if (
            array_key_exists('upr_type_id', $data)
            || array_key_exists('upr_cycle_id', $data)
            || array_key_exists('upr_category_id', $data)
        ) {
            $this->assertCategoryMatchesCycleAndType($categoryId, $cycleId, $typeId);
        }

        $entry = DB::transaction(function () use ($uprEntry, $data, $typeId, $cycleId, $categoryId) {
            $cycleChanged = array_key_exists('upr_cycle_id', $data)
                && (int) $data['upr_cycle_id'] !== (int) $uprEntry->upr_cycle_id;
            $categoryChanged = array_key_exists('upr_category_id', $data)
                && (int) $data['upr_category_id'] !== (int) $uprEntry->upr_category_id;

            $scalar = collect($data)->only([
                'upr_type_id',
                'upr_cycle_id',
                'upr_category_id',
                'is_dummy',
                'is_active',
                'has_quantitative',
                'has_qualitative',
            ])->all();

            if (array_key_exists('indicators', $data)
                && (! array_key_exists('has_quantitative', $data) || ! array_key_exists('has_qualitative', $data))
            ) {
                $hasQuantitative = false;
                $hasQualitative = false;
                foreach ($data['indicators'] as $row) {
                    if ((bool) ($row['has_quantitative'] ?? false)) {
                        $hasQuantitative = true;
                    }
                    if ((bool) ($row['has_qualitative'] ?? false)) {
                        $hasQualitative = true;
                    }
                }
                $scalar['has_quantitative'] = $hasQuantitative;
                $scalar['has_qualitative'] = $hasQualitative;
            }

            if ($scalar !== []) {
                $uprEntry->fill($scalar);
                $uprEntry->save();
            }

            if ($cycleChanged || $categoryChanged) {
                $recommendationIds = UprRecommendationEntry::query()
                    ->where('upr_cycle_id', $cycleId)
                    ->where('upr_category_id', $categoryId)
                    ->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('name')
                    ->pluck('id')
                    ->map(fn ($id) => (int) $id)
                    ->all();
                $uprEntry->recommendations()->sync($recommendationIds);
            }

            if (array_key_exists('indicators', $data)) {
                $this->syncIndicators($uprEntry, $data['indicators'], true);
            }

            return $uprEntry->fresh([
                'type:id,name',
                'cycle:id,name',
                'category:id,name,upr_cycle_id,upr_type_id',
                'recommendations:id,name,upr_cycle_id,upr_category_id',
                'indicators',
            ]);
        });

        return response()->json(['data' => $this->serialize($entry)]);
    }

    public function destroy(UprEntry $uprEntry): JsonResponse
    {
        $uprEntry->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function syncIndicators(UprEntry $entry, array $rows, bool $replace = false): void
    {
        $existingById = $replace
            ? $entry->indicators()->get()->keyBy(static fn (UprEntryIndicator $ind): int => (int) $ind->id)
            : collect();
        $keepIds = [];
        $sortOrder = 0;

        foreach ($rows as $row) {
            $text = trim((string) ($row['indicator_text'] ?? ''));
            if ($text === '') {
                continue;
            }

            $hasQuantitative = (bool) ($row['has_quantitative'] ?? false);
            $hasQualitative = (bool) ($row['has_qualitative'] ?? false);
            if (! $hasQuantitative && ! $hasQualitative) {
                throw ValidationException::withMessages([
                    'indicators' => ['Each indicator must have Quantitative and/or Qualitative selected.'],
                ]);
            }

            $payload = [
                'indicator_text' => $text,
                'has_quantitative' => $hasQuantitative,
                'has_qualitative' => $hasQualitative,
                'collects_by_gender' => $hasQuantitative ? (bool) ($row['collects_by_gender'] ?? true) : false,
                'collects_by_age' => $hasQuantitative ? (bool) ($row['collects_by_age'] ?? true) : false,
                'collects_by_location' => false,
                'collects_by_disability' => $hasQuantitative ? (bool) ($row['collects_by_disability'] ?? true) : false,
                'collects_by_religion' => $hasQuantitative ? (bool) ($row['collects_by_religion'] ?? true) : false,
                'collects_by_consolidated' => $hasQuantitative ? (bool) ($row['collects_by_consolidated'] ?? true) : false,
                'sort_order' => $sortOrder,
                'is_active' => true,
            ];

            $incomingId = isset($row['id']) ? (int) $row['id'] : 0;
            $existing = $incomingId > 0 ? ($existingById->get($incomingId) ?? null) : null;

            if ($replace && $existing) {
                $existing->fill($payload);
                $existing->save();
                $keepIds[] = (int) $existing->id;
            } else {
                $created = UprEntryIndicator::query()->create([
                    'upr_entry_id' => $entry->id,
                    ...$payload,
                ]);
                $keepIds[] = (int) $created->id;
            }
            $sortOrder++;
        }

        if ($replace) {
            $entry->indicators()
                ->whereNotIn('id', $keepIds === [] ? [0] : $keepIds)
                ->delete();
        }
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
    private function serialize(UprEntry $row): array
    {
        return [
            'id' => $row->id,
            'upr_type_id' => (int) $row->upr_type_id,
            'upr_cycle_id' => (int) $row->upr_cycle_id,
            'upr_category_id' => (int) $row->upr_category_id,
            'is_dummy' => (bool) ($row->is_dummy ?? false),
            'has_quantitative' => (bool) ($row->has_quantitative ?? false),
            'has_qualitative' => (bool) ($row->has_qualitative ?? false),
            'is_active' => (bool) ($row->is_active ?? true),
            'type' => $row->relationLoaded('type') && $row->type ? [
                'id' => $row->type->id,
                'name' => $row->type->name,
            ] : null,
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
            'recommendations' => $row->relationLoaded('recommendations')
                ? $row->recommendations->map(fn (UprRecommendationEntry $rec) => [
                    'id' => $rec->id,
                    'name' => $rec->name,
                    'upr_cycle_id' => (int) $rec->upr_cycle_id,
                    'upr_category_id' => (int) $rec->upr_category_id,
                ])->values()->all()
                : [],
            'recommendation_ids' => $row->relationLoaded('recommendations')
                ? $row->recommendations->pluck('id')->map(fn ($id) => (int) $id)->values()->all()
                : [],
            'indicators' => $row->relationLoaded('indicators')
                ? $row->indicators->map(fn (UprEntryIndicator $ind) => $ind->toAdminApiArray())->values()->all()
                : [],
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
