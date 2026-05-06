<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Region;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Department::query()->orderBy('name');

        if ($user->hasRole('super_admin')) {
            $rows = $query->with('regions')->get();

            return response()->json([
                'data' => $rows->map(fn (Department $d) => $this->serializeRow($d)),
            ]);
        }

        if ($user->hasRole('federal_admin')) {
            $query->whereHas('regions', fn ($q) => $q->where('slug', 'ict'));
        } elseif ($user->hasRole('regional_admin')) {
            if ($user->region_id === null) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $slug = Region::query()->whereKey($user->region_id)->value('slug');
            if (! $slug) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $query->whereHas('regions', fn ($q) => $q->where('slug', $slug));
        } elseif ($user->hasRole('department_admin') || $user->hasRole('viewer')) {
            if ($user->department_id === null) {
                return response()->json(['data' => []]);
            }
            $query->where('id', $user->department_id);
        } else {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $rows = $query->with('regions')->get();

        return response()->json([
            'data' => $rows->map(fn (Department $d) => $this->serializeRow($d)),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRow(Department $d): array
    {
        $regions = $d->relationLoaded('regions') ? $d->regions->sortBy('id')->values() : collect();
        $regionIds = $regions->pluck('id')->all();

        return [
            'id' => $d->id,
            'code' => $d->code,
            'name' => $d->name,
            'type' => $d->type,
            'region_id' => $regionIds[0] ?? null,
            'region_ids' => $regionIds,
            'region_slug' => $regions->first()?->slug,
            'region_name' => $regions->isNotEmpty() ? $regions->pluck('name')->join(', ') : null,
        ];
    }
}
