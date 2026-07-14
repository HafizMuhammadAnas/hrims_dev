<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CollectionGender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollectionGenderController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = CollectionGender::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (CollectionGender $row) => $this->serialize($row)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:collection_genders,name'],
        ]);

        $sortOrder = (int) (CollectionGender::query()->max('sort_order') ?? 0) + 1;
        $row = CollectionGender::query()->create([
            'name' => trim($data['name']),
            'sort_order' => $sortOrder,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, CollectionGender $collection_gender): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', 'unique:collection_genders,name,'.$collection_gender->id],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = trim($data['name']);
        }
        if (array_key_exists('is_active', $data)) {
            $updates['is_active'] = (bool) $data['is_active'];
        }
        if ($updates !== []) {
            $collection_gender->forceFill($updates)->save();
        }

        return response()->json(['data' => $this->serialize($collection_gender)]);
    }

    public function destroy(CollectionGender $collection_gender): JsonResponse
    {
        if (\Illuminate\Support\Facades\DB::table('issue_indicator_year_gender')
            ->where('collection_gender_id', $collection_gender->id)
            ->exists()) {
            return response()->json([
                'message' => 'This gender is linked to one or more issue indicators and cannot be deleted.',
            ], 422);
        }

        $collection_gender->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(CollectionGender $row): array
    {
        return [
            'id' => $row->id,
            'name' => $row->name,
            'sort_order' => $row->sort_order,
            'is_active' => (bool) ($row->is_active ?? true),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
