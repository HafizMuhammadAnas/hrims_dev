<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ViolationEntry;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ViolationEntryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ViolationEntry::query()->with('region');
        $user = $request->user();

        if (HrimsAccess::seesAllRegions($user)) {
            // no filter
        } elseif ($user->region_id !== null) {
            $query->where('region_id', $user->region_id);
        } else {
            $query->whereRaw('1 = 0');
        }

        $rows = $query->orderByDesc('event_date')->get();

        return response()->json([
            'data' => $rows->map(fn (ViolationEntry $v) => [
                'id' => $v->id,
                'entry_number' => $v->entry_number,
                'title' => $v->title,
                'event_date' => $v->event_date->format('Y-m-d'),
                'event_time' => $v->event_time,
                'event_year' => $v->event_year,
                'region_name' => $v->region?->name,
                'district' => $v->district,
                'violation_category' => $v->violation_category,
                'violation_sub_category' => $v->violation_sub_category,
                'violation_indicator' => $v->violation_indicator,
                'monitoring_status' => $v->monitoring_status,
                'description' => $v->description,
                'created_at' => $v->created_at?->toIso8601String(),
                'updated_at' => $v->updated_at?->toIso8601String(),
            ]),
        ]);
    }
}
