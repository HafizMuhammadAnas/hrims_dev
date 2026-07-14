<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CollectionReligion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CollectionReligionController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = CollectionReligion::query()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (CollectionReligion $row) => $this->serialize($row)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:collection_religions,name'],
        ]);

        $sortOrder = (int) (CollectionReligion::query()->max('sort_order') ?? 0) + 1;
        $row = CollectionReligion::query()->create([
            'name' => trim($data['name']),
            'sort_order' => $sortOrder,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, CollectionReligion $collection_religion): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', 'unique:collection_religions,name,'.$collection_religion->id],
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
            $collection_religion->forceFill($updates)->save();
        }

        return response()->json(['data' => $this->serialize($collection_religion)]);
    }

    public function destroy(CollectionReligion $collection_religion): JsonResponse
    {
        if (DB::table('issue_indicator_year_religion')
            ->where('collection_religion_id', $collection_religion->id)
            ->exists()) {
            return response()->json([
                'message' => 'This religion is linked to one or more issue indicators and cannot be deleted.',
            ], 422);
        }

        $collection_religion->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(CollectionReligion $row): array
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
