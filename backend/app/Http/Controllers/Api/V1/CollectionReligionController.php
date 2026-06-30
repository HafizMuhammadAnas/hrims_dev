<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CollectionReligion;
use Illuminate\Http\JsonResponse;

class CollectionReligionController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = CollectionReligion::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (CollectionReligion $row) => [
                'id' => $row->id,
                'name' => $row->name,
                'sort_order' => $row->sort_order,
            ]),
        ]);
    }
}
