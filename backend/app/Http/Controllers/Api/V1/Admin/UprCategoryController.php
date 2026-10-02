<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UprCategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cycleId = $request->query('upr_cycle_id');
        $typeId = $request->query('upr_type_id');

        $rows = UprCategory::query()
            ->with([
                'cycle:id,name',
                'type:id,name',
            ])
            ->when(
                $cycleId !== null && $cycleId !== '',
                fn ($q) => $q->where('upr_cycle_id', (int) $cycleId),
            )
            ->when(
                $typeId !== null && $typeId !== '',
                fn ($q) => $q->where('upr_type_id', (int) $typeId),
            )
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (UprCategory $row) => $this->serialize($row))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'upr_cycle_id' => ['required', 'integer', 'exists:upr_cycles,id'],
            'upr_type_id' => ['required', 'integer', 'exists:upr_types,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('upr_categories', 'name')->where(
                    fn ($q) => $q
                        ->where('upr_cycle_id', $request->input('upr_cycle_id'))
                        ->where('upr_type_id', $request->input('upr_type_id')),
                ),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = UprCategory::query()->create([
            'upr_cycle_id' => (int) $data['upr_cycle_id'],
            'upr_type_id' => (int) $data['upr_type_id'],
            'name' => $data['name'],
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);
        $row->load(['cycle:id,name', 'type:id,name']);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, UprCategory $uprCategory): JsonResponse
    {
        $cycleId = $request->input('upr_cycle_id', $uprCategory->upr_cycle_id);
        $typeId = $request->input('upr_type_id', $uprCategory->upr_type_id);

        $data = $request->validate([
            'upr_cycle_id' => ['sometimes', 'required', 'integer', 'exists:upr_cycles,id'],
            'upr_type_id' => ['sometimes', 'required', 'integer', 'exists:upr_types,id'],
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('upr_categories', 'name')
                    ->where(fn ($q) => $q->where('upr_cycle_id', $cycleId)->where('upr_type_id', $typeId))
                    ->ignore($uprCategory->id),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $uprCategory->fill($data);
        $uprCategory->save();
        $uprCategory->load(['cycle:id,name', 'type:id,name']);

        return response()->json(['data' => $this->serialize($uprCategory->fresh(['cycle:id,name', 'type:id,name']))]);
    }

    public function destroy(UprCategory $uprCategory): JsonResponse
    {
        $uprCategory->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(UprCategory $row): array
    {
        return [
            'id' => $row->id,
            'upr_cycle_id' => $row->upr_cycle_id !== null ? (int) $row->upr_cycle_id : null,
            'upr_type_id' => $row->upr_type_id !== null ? (int) $row->upr_type_id : null,
            'cycle' => $row->relationLoaded('cycle') && $row->cycle ? [
                'id' => $row->cycle->id,
                'name' => $row->cycle->name,
            ] : null,
            'type' => $row->relationLoaded('type') && $row->type ? [
                'id' => $row->type->id,
                'name' => $row->type->name,
            ] : null,
            'name' => $row->name,
            'sort_order' => (int) ($row->sort_order ?? 0),
            'is_active' => (bool) ($row->is_active ?? true),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
