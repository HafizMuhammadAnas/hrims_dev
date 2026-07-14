<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Region;
use Illuminate\Http\JsonResponse;

class RegionController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Region::query()->orderBy('name')->get();

        return response()->json([
            'data' => $rows->map(fn (Region $region) => [
                'id' => $region->id,
                'name' => $region->name,
                'slug' => $region->slug,
                'created_at' => optional($region->created_at)?->toIso8601String(),
                'updated_at' => optional($region->updated_at)?->toIso8601String(),
            ]),
        ]);
    }
}
