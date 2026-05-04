<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Convention;
use App\Models\ConventionComponent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ConventionComponentController extends Controller
{
    public function index(Convention $convention): JsonResponse
    {
        $rows = ConventionComponent::query()
            ->where('convention_id', $convention->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (ConventionComponent $c) => $this->serialize($c))]);
    }

    public function store(Request $request, Convention $convention): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'integer', Rule::exists('convention_components', 'id')->where('convention_id', $convention->id)],
            'type' => ['required', 'string', 'max:64'],
            'code' => ['required', 'string', 'max:128'],
            'title' => ['required', 'string', 'max:500'],
            'body' => ['nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $data['convention_id'] = $convention->id;
        $row = ConventionComponent::query()->create($data);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, ConventionComponent $conventionComponent): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'integer', Rule::exists('convention_components', 'id')->where('convention_id', $conventionComponent->convention_id)],
            'type' => ['sometimes', 'string', 'max:64'],
            'code' => ['sometimes', 'string', 'max:128'],
            'title' => ['sometimes', 'string', 'max:500'],
            'body' => ['sometimes', 'nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('parent_id', $data) && $data['parent_id'] === $conventionComponent->id) {
            return response()->json(['message' => 'Component cannot be its own parent.'], 422);
        }

        $conventionComponent->fill($data);
        $conventionComponent->save();

        return response()->json(['data' => $this->serialize($conventionComponent->fresh())]);
    }

    public function destroy(ConventionComponent $conventionComponent): JsonResponse
    {
        if ($conventionComponent->children()->exists()) {
            return response()->json(['message' => 'Remove child components first.'], 422);
        }
        $conventionComponent->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(ConventionComponent $c): array
    {
        return [
            'id' => $c->id,
            'convention_id' => $c->convention_id,
            'parent_id' => $c->parent_id,
            'type' => $c->type,
            'code' => $c->code,
            'title' => $c->title,
            'body' => $c->body,
            'sort_order' => $c->sort_order,
        ];
    }
}
