<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CollectionYear;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class CollectionYearController extends Controller
{
    public function index(): JsonResponse
    {
        $query = CollectionYear::query();
        if (Schema::hasColumn((new CollectionYear)->getTable(), 'is_active')) {
            $query->where('is_active', true);
        }

        $rows = $query
            ->orderByRaw('CAST(label AS UNSIGNED)')
            ->orderBy('label')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (CollectionYear $row) => [
                'id' => (int) $row->id,
                'label' => (string) $row->label,
                'sort_order' => (int) ($row->sort_order ?? 0),
            ]),
        ]);
    }
}
