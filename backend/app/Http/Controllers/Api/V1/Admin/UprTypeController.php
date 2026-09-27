<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\UprType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UprTypeController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = UprType::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (UprType $row) => $this->serialize($row))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:upr_types,name'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = UprType::query()->create([
            'name' => $data['name'],
            'sort_order' => $data['sort_order'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, UprType $uprType): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('upr_types', 'name')->ignore($uprType->id)],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $uprType->fill($data);
        $uprType->save();

        return response()->json(['data' => $this->serialize($uprType->fresh())]);
    }

    public function destroy(UprType $uprType): JsonResponse
    {
        if ($uprType->cycles()->exists()) {
            return response()->json([
                'message' => 'Type is used by one or more cycles. Reassign or delete those cycles first.',
            ], 422);
        }

        $uprType->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(UprType $row): array
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
