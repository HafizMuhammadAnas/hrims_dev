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
            ->orderBy('sort_order')
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
        ]);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, CollectionYear $collection_year): JsonResponse
    {
        $data = $request->validate([
            'label' => ['required', 'string', 'max:32', 'unique:collection_years,label,'.$collection_year->id],
        ]);
        $collection_year->forceFill(['label' => trim($data['label'])])->save();

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
        ];
    }
}
