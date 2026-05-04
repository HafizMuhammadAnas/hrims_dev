<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Region;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RegionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:128', 'regex:/^[a-z0-9\-]+$/', 'unique:regions,slug'],
        ]);

        $region = Region::query()->create($data);

        return response()->json(['data' => $this->serialize($region)], 201);
    }

    public function update(Request $request, Region $region): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:128', 'regex:/^[a-z0-9\-]+$/', Rule::unique('regions', 'slug')->ignore($region->id)],
        ]);
        $region->fill($data);
        $region->save();

        return response()->json(['data' => $this->serialize($region->fresh())]);
    }

    public function destroy(Region $region): JsonResponse
    {
        if ($region->departments()->exists()
            || $region->districts()->exists()
            || $region->users()->exists()
            || $region->hrRequests()->exists()) {
            return response()->json(['message' => 'Region has related departments, districts, users, or requests. Remove or reassign them first.'], 422);
        }
        $region->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Region $r): array
    {
        return [
            'id' => $r->id,
            'name' => $r->name,
            'slug' => $r->slug,
        ];
    }
}
