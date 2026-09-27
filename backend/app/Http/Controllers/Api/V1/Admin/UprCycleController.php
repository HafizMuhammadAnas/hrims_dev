<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprCycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UprCycleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $typeId = $request->query('upr_type_id');

        $rows = UprCycle::query()
            ->with('type:id,name')
            ->when(
                $typeId !== null && $typeId !== '',
                fn ($q) => $q->where('upr_type_id', (int) $typeId),
            )
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (UprCycle $row) => $this->serialize($row))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'upr_type_id' => ['required', 'integer', 'exists:upr_types,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('upr_cycles', 'name')->where(
                    fn ($q) => $q->where('upr_type_id', $request->input('upr_type_id')),
                ),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = UprCycle::query()->create([
            'upr_type_id' => (int) $data['upr_type_id'],
            'name' => $data['name'],
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);
        $row->load('type:id,name');

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, UprCycle $uprCycle): JsonResponse
    {
        $typeId = $request->input('upr_type_id', $uprCycle->upr_type_id);

        $data = $request->validate([
            'upr_type_id' => ['sometimes', 'required', 'integer', 'exists:upr_types,id'],
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
                Rule::unique('upr_cycles', 'name')
                    ->where(fn ($q) => $q->where('upr_type_id', $typeId))
                    ->ignore($uprCycle->id),
            ],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $uprCycle->fill($data);
        $uprCycle->save();
        $uprCycle->load('type:id,name');

        return response()->json(['data' => $this->serialize($uprCycle->fresh(['type:id,name']))]);
    }

    public function destroy(UprCycle $uprCycle): JsonResponse
    {
        if ($uprCycle->categories()->exists()) {
            return response()->json([
                'message' => 'Cycle is used by one or more categories. Reassign or delete those categories first.',
            ], 422);
        }

        $uprCycle->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(UprCycle $row): array
    {
        return [
            'id' => $row->id,
            'upr_type_id' => $row->upr_type_id !== null ? (int) $row->upr_type_id : null,
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
