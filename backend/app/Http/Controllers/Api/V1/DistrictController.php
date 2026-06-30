<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\District;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DistrictController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = District::query()->with('region')->orderBy('name');
        if ($request->filled('region_id')) {
            $query->where('region_id', (int) $request->query('region_id'));
        }
        $rows = $query->get();

        return response()->json([
            'data' => $rows->map(fn (District $d) => [
                'id' => $d->id,
                'region_id' => $d->region_id,
                'region_name' => $d->region?->name,
                'name' => $d->name,
                'slug' => $d->slug,
            ]),
        ]);
    }
}
