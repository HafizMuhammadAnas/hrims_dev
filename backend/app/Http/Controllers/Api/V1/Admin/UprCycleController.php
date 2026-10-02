<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprCycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UprCycleController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = UprCycle::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (UprCycle $row) => $this->serialize($row))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:upr_cycles,name'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = UprCycle::query()->create([
            'name' => $data['name'],
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, UprCycle $uprCycle): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('upr_cycles', 'name')->ignore($uprCycle->id)],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $uprCycle->fill($data);
        $uprCycle->save();

        return response()->json(['data' => $this->serialize($uprCycle->fresh())]);
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
            'name' => $row->name,
            'sort_order' => (int) ($row->sort_order ?? 0),
            'is_active' => (bool) ($row->is_active ?? true),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
