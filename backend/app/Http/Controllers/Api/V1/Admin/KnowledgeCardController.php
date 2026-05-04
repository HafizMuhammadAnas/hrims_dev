<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\KnowledgeCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class KnowledgeCardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $section = $request->validate(['section' => ['required', 'string', Rule::in(['indicators', 'upr'])]])['section'];

        $rows = KnowledgeCard::query()
            ->where('section', $section)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (KnowledgeCard $k) => $this->serialize($k))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'section' => ['required', 'string', Rule::in(['indicators', 'upr'])],
            'icon' => ['sometimes', 'string', 'max:32'],
            'title' => ['required', 'string', 'max:255'],
            'summary' => ['nullable', 'string'],
            'stat_1_value' => ['nullable', 'string', 'max:64'],
            'stat_1_label' => ['nullable', 'string', 'max:128'],
            'stat_2_value' => ['nullable', 'string', 'max:64'],
            'stat_2_label' => ['nullable', 'string', 'max:128'],
            'body' => ['nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $row = KnowledgeCard::query()->create($data);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, KnowledgeCard $knowledgeCard): JsonResponse
    {
        $data = $request->validate([
            'icon' => ['sometimes', 'string', 'max:32'],
            'title' => ['sometimes', 'string', 'max:255'],
            'summary' => ['sometimes', 'nullable', 'string'],
            'stat_1_value' => ['sometimes', 'nullable', 'string', 'max:64'],
            'stat_1_label' => ['sometimes', 'nullable', 'string', 'max:128'],
            'stat_2_value' => ['sometimes', 'nullable', 'string', 'max:64'],
            'stat_2_label' => ['sometimes', 'nullable', 'string', 'max:128'],
            'body' => ['sometimes', 'nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $knowledgeCard->fill($data);
        $knowledgeCard->save();

        return response()->json(['data' => $this->serialize($knowledgeCard->fresh())]);
    }

    public function destroy(KnowledgeCard $knowledgeCard): JsonResponse
    {
        $knowledgeCard->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(KnowledgeCard $k): array
    {
        return [
            'id' => $k->id,
            'section' => $k->section,
            'icon' => $k->icon,
            'title' => $k->title,
            'summary' => $k->summary,
            'stat_1_value' => $k->stat_1_value,
            'stat_1_label' => $k->stat_1_label,
            'stat_2_value' => $k->stat_2_value,
            'stat_2_label' => $k->stat_2_label,
            'body' => $k->body,
            'sort_order' => $k->sort_order,
        ];
    }
}
