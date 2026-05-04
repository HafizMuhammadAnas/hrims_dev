<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Convention;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ConventionController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Convention::query()->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['data' => $rows->map(fn (Convention $c) => $this->serialize($c))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64', 'unique:conventions,code'],
            'name' => ['required', 'string', 'max:255'],
            'knowledge_icon' => ['nullable', 'string', 'max:32'],
            'knowledge_adopted' => ['nullable', 'string', 'max:64'],
            'knowledge_ratified' => ['nullable', 'string', 'max:64'],
            'knowledge_articles' => ['nullable', 'string', 'max:64'],
            'knowledge_implementation' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = Convention::query()->create($data);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, Convention $convention): JsonResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:64', Rule::unique('conventions', 'code')->ignore($convention->id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'knowledge_icon' => ['sometimes', 'nullable', 'string', 'max:32'],
            'knowledge_adopted' => ['sometimes', 'nullable', 'string', 'max:64'],
            'knowledge_ratified' => ['sometimes', 'nullable', 'string', 'max:64'],
            'knowledge_articles' => ['sometimes', 'nullable', 'string', 'max:64'],
            'knowledge_implementation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'description' => ['sometimes', 'nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        $convention->fill($data);
        $convention->save();

        return response()->json(['data' => $this->serialize($convention->fresh())]);
    }

    public function destroy(Convention $convention): JsonResponse
    {
        $convention->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Convention $c): array
    {
        return [
            'id' => $c->id,
            'code' => $c->code,
            'name' => $c->name,
            'knowledge_icon' => $c->knowledge_icon,
            'knowledge_adopted' => $c->knowledge_adopted,
            'knowledge_ratified' => $c->knowledge_ratified,
            'knowledge_articles' => $c->knowledge_articles,
            'knowledge_implementation' => $c->knowledge_implementation,
            'description' => $c->description,
            'sort_order' => $c->sort_order,
            'is_active' => $c->is_active,
        ];
    }
}
