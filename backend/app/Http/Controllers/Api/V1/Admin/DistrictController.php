<?php

namespace App\Http\Controllers\Api\V1\Admin;

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
            'data' => $rows->map(fn (District $d) => $this->serialize($d)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'region_id' => ['required', 'integer', 'exists:regions,id'],
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:128', 'regex:/^[a-z0-9\-]*$/'],
        ]);

        if (! empty($data['slug'])) {
            $exists = District::query()
                ->where('region_id', $data['region_id'])
                ->where('slug', $data['slug'])
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'Slug already used in this region.'], 422);
            }
        }

        $district = District::query()->create($data);

        return response()->json(['data' => $this->serialize($district->load('region'))], 201);
    }

    public function update(Request $request, District $district): JsonResponse
    {
        $data = $request->validate([
            'region_id' => ['sometimes', 'integer', 'exists:regions,id'],
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:128', 'regex:/^[a-z0-9\-]*$/'],
        ]);

        $regionId = $data['region_id'] ?? $district->region_id;
        if (array_key_exists('slug', $data) && $data['slug'] !== null && $data['slug'] !== '') {
            $dup = District::query()
                ->where('region_id', $regionId)
                ->where('slug', $data['slug'])
                ->where('id', '!=', $district->id)
                ->exists();
            if ($dup) {
                return response()->json(['message' => 'Slug already used in this region.'], 422);
            }
        }

        $district->fill($data);
        $district->save();

        return response()->json(['data' => $this->serialize($district->fresh('region'))]);
    }

    public function destroy(District $district): JsonResponse
    {
        $district->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(District $d): array
    {
        return [
            'id' => $d->id,
            'region_id' => $d->region_id,
            'region_name' => $d->relationLoaded('region') ? $d->region?->name : null,
            'name' => $d->name,
            'slug' => $d->slug,
        ];
    }
}
