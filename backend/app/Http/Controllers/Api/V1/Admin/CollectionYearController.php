<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CollectionYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollectionYearController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = CollectionYear::query()
            ->orderByRaw('CAST(label AS UNSIGNED)')
            ->orderBy('label')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (CollectionYear $row) => $this->serialize($row)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:32', 'unique:collection_years,label'],
        ]);

        $sortOrder = (int) (CollectionYear::query()->max('sort_order') ?? 0) + 1;
        $row = CollectionYear::query()->create([
            'label' => trim($data['label']),
            'sort_order' => $sortOrder,
            'is_active' => true,
        ]);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, CollectionYear $collection_year): JsonResponse
    {
        $data = $request->validate([
            'label' => ['sometimes', 'required', 'string', 'max:32', 'unique:collection_years,label,'.$collection_year->id],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $updates = [];
        if (array_key_exists('label', $data)) {
            $updates['label'] = trim($data['label']);
        }
        if (array_key_exists('is_active', $data)) {
            $updates['is_active'] = (bool) $data['is_active'];
        }
        if ($updates !== []) {
            $collection_year->forceFill($updates)->save();
        }

        return response()->json(['data' => $this->serialize($collection_year)]);
    }

    public function destroy(CollectionYear $collection_year): JsonResponse
    {
        if (\Illuminate\Support\Facades\DB::table('issue_indicator_year_gender')
            ->where('collection_year_id', $collection_year->id)
            ->exists()) {
            return response()->json([
                'message' => 'This year is linked to one or more issue indicators and cannot be deleted.',
            ], 422);
        }

        $collection_year->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(CollectionYear $row): array
    {
        return [
            'id' => $row->id,
            'label' => $row->label,
            'sort_order' => $row->sort_order,
            'is_active' => (bool) ($row->is_active ?? true),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
