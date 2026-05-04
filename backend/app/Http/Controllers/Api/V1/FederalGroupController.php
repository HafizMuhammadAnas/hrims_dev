<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DepartmentTask;
use App\Models\FederalGroup;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FederalGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = FederalGroup::query()->with(['hrRequests' => fn ($q) => $q->with('region')]);

        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            // no filter
        } elseif ($user->hasRole('regional_admin')) {
            $regionIds = HrimsAccess::scopedRegionIds($user);
            if ($regionIds !== null) {
                $query->whereHas('hrRequests', fn ($q) => $q->whereIn('region_id', $regionIds));
            }
        } elseif (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $allowed = DepartmentTask::query()->where('department_id', $user->department_id)->pluck('hr_request_id')->unique()->values()->all();
            if ($allowed === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereHas('hrRequests', fn ($q) => $q->whereIn('id', $allowed));
            }
        } else {
            $query->whereRaw('1 = 0');
        }

        $groups = $query->orderBy('initiated_on', 'desc')->get();

        return response()->json([
            'data' => $groups->map(fn (FederalGroup $g) => [
                'id' => $g->id,
                'title' => $g->title,
                'conv' => $g->conv,
                'date' => $g->initiated_on->format('Y-m-d'),
                'status' => $g->status,
                'linked_requests' => $g->hrRequests->pluck('id')->values()->all(),
            ]),
        ]);
    }

    public function show(Request $request, string $federalGroup): JsonResponse
    {
        $model = FederalGroup::query()->with(['hrRequests' => fn ($q) => $q->with('region')])->find($federalGroup);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $user = $request->user();
        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            // allowed
        } elseif ($user->hasRole('regional_admin')) {
            $regionIds = HrimsAccess::scopedRegionIds($user) ?? [];
            $visible = $model->hrRequests->contains(fn ($r) => in_array((int) $r->region_id, $regionIds, true));
            if (! $visible && $model->hrRequests->isNotEmpty()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } elseif (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $allowed = collect(HrimsAccess::hrRequestIdsForDepartmentUser($user));
            $visible = $model->hrRequests->contains(fn ($r) => $allowed->contains($r->id));
            if (! $visible && $model->hrRequests->isNotEmpty()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } else {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json([
            'data' => [
                'id' => $model->id,
                'title' => $model->title,
                'conv' => $model->conv,
                'date' => $model->initiated_on->format('Y-m-d'),
                'status' => $model->status,
                'linked_requests' => $model->hrRequests->pluck('id')->values()->all(),
            ],
        ]);
    }
}
