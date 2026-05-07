<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Region;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DepartmentController extends Controller
{
    private const MANAGE_REGION_SLUGS = ['ict', 'federal', 'punjab', 'sindh', 'balochistan', 'kpk', 'gb', 'ajk'];

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

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('federal_admin') && ! $user->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $scopeRegionIds = $this->manageableRegionIdsFor($user);
        if ($scopeRegionIds === []) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'code' => ['nullable', 'string', 'max:64', Rule::unique('departments', 'code')],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:32'],
        ]);

        $dept = Department::query()->create([
            'code' => $data['code'] ?? null,
            'name' => $data['name'],
            'type' => $data['type'] ?? null,
        ]);
        $dept->regions()->sync($scopeRegionIds);

        return response()->json(['data' => $this->serializeRow($dept->fresh('regions'))], 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('federal_admin') && ! $user->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if (! $this->departmentWithinUserScope($department, $user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'code' => ['sometimes', 'nullable', 'string', 'max:64', Rule::unique('departments', 'code')->ignore($department->id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'nullable', 'string', 'max:32'],
        ]);

        $department->fill($data);
        $department->save();

        return response()->json(['data' => $this->serializeRow($department->fresh('regions'))]);
    }

    public function destroy(Request $request, Department $department): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('federal_admin') && ! $user->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if (! $this->departmentWithinUserScope($department, $user)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($department->users()->exists() || $department->departmentTasks()->exists()) {
            return response()->json(['message' => 'Department has assigned users or tasks. Reassign them first.'], 422);
        }

        $department->delete();
        return response()->json(['message' => 'Deleted']);
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

    /**
     * @return list<int>
     */
    private function manageableRegionIdsFor($user): array
    {
        if ($user->hasRole('federal_admin')) {
            return Region::query()
                ->whereIn('slug', ['ict', 'federal'])
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }
        if ($user->hasRole('regional_admin')) {
            if ($user->region_id === null) {
                return [];
            }
            $slug = Region::query()->whereKey($user->region_id)->value('slug');
            if (! $slug || ! in_array($slug, self::MANAGE_REGION_SLUGS, true)) {
                return [];
            }

            return Region::query()
                ->where('slug', $slug)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        return [];
    }

    private function departmentWithinUserScope(Department $department, $user): bool
    {
        $scopeRegionIds = $this->manageableRegionIdsFor($user);
        if ($scopeRegionIds === []) {
            return false;
        }

        $regionIds = $department->regions()->pluck('regions.id')->map(fn ($id) => (int) $id)->all();
        if ($regionIds === []) {
            throw ValidationException::withMessages([
                'department' => ['Department has no region mapping.'],
            ]);
        }

        foreach ($regionIds as $rid) {
            if (! in_array($rid, $scopeRegionIds, true)) {
                return false;
            }
        }

        return true;
    }
}
