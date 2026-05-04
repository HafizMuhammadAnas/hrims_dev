<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Region;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DepartmentController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Department::query()->with('regions')->orderBy('name')->get();

        return response()->json([
            'data' => $rows->map(fn (Department $d) => $this->serialize($d)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'region_ids' => ['required', 'array', 'min:1'],
            'region_ids.*' => ['integer', 'exists:regions,id'],
            'code' => ['nullable', 'string', 'max:64', Rule::unique('departments', 'code')],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:32'],
        ]);

        $regionIds = $this->normalizeAndValidateRegionIds($data['region_ids']);

        $dept = Department::query()->create([
            'code' => $data['code'] ?? null,
            'name' => $data['name'],
            'type' => $data['type'] ?? null,
        ]);
        $dept->regions()->sync($regionIds);

        return response()->json(['data' => $this->serialize($dept->fresh('regions'))], 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $data = $request->validate([
            'region_ids' => ['sometimes', 'array', 'min:1'],
            'region_ids.*' => ['integer', 'exists:regions,id'],
            'code' => ['sometimes', 'nullable', 'string', 'max:64', Rule::unique('departments', 'code')->ignore($department->id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'nullable', 'string', 'max:32'],
        ]);

        if (array_key_exists('region_ids', $data)) {
            $regionIds = $this->normalizeAndValidateRegionIds($data['region_ids']);
            $department->regions()->sync($regionIds);
        }

        $department->fill(collect($data)->except('region_ids')->all());
        $department->save();

        return response()->json(['data' => $this->serialize($department->fresh('regions'))]);
    }

    public function destroy(Department $department): JsonResponse
    {
        if ($department->users()->exists() || $department->departmentTasks()->exists()) {
            return response()->json(['message' => 'Department has assigned users or tasks. Reassign them first.'], 422);
        }
        $department->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @param  list<int>  $regionIds
     * @return list<int>
     */
    private function normalizeAndValidateRegionIds(array $regionIds): array
    {
        $regionIds = array_values(array_unique(array_map('intval', $regionIds)));
        $slugs = Region::query()->whereIn('id', $regionIds)->pluck('slug')->all();
        if (count($slugs) !== count($regionIds)) {
            throw ValidationException::withMessages([
                'region_ids' => ['One or more regions are invalid.'],
            ]);
        }
        foreach ($slugs as $slug) {
            if (! in_array($slug, Department::REGION_SLUGS, true)) {
                throw ValidationException::withMessages([
                    'region_ids' => ['Departments may only be linked to catalog regions.'],
                ]);
            }
        }

        return $regionIds;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Department $d): array
    {
        $regions = $d->relationLoaded('regions')
            ? $d->regions->map(fn (Region $r) => [
                'id' => $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
            ])->sortBy('id')->values()->all()
            : [];

        $regionIds = array_map(static fn (array $r) => $r['id'], $regions);

        return [
            'id' => $d->id,
            'region_ids' => $regionIds,
            'regions' => $regions,
            'code' => $d->code,
            'name' => $d->name,
            'type' => $d->type,
        ];
    }
}
