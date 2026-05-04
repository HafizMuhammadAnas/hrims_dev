<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\SdgNode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SdgNodeController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = SdgNode::query()->orderBy('goal_number')->orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => $rows->map(fn (SdgNode $n) => $this->serialize($n))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:sdg_nodes,id'],
            'node_type' => ['required', 'string', Rule::in(['goal', 'target', 'indicator'])],
            'code' => ['required', 'string', 'max:64'],
            'title' => ['required', 'string', 'max:500'],
            'knowledge_icon' => ['nullable', 'string', 'max:32'],
            'summary' => ['nullable', 'string'],
            'body' => ['nullable', 'string'],
            'stat_1_value' => ['nullable', 'string', 'max:64'],
            'stat_1_label' => ['nullable', 'string', 'max:128'],
            'stat_2_value' => ['nullable', 'string', 'max:64'],
            'stat_2_label' => ['nullable', 'string', 'max:128'],
            'goal_number' => ['nullable', 'integer', 'min:1', 'max:17'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if ($data['node_type'] === 'goal' && ! empty($data['parent_id'])) {
            return response()->json(['message' => 'SDG goals cannot have a parent node.'], 422);
        }

        $row = SdgNode::query()->create($data);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, SdgNode $sdgNode): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'integer', 'exists:sdg_nodes,id'],
            'node_type' => ['sometimes', 'string', Rule::in(['goal', 'target', 'indicator'])],
            'code' => ['sometimes', 'string', 'max:64'],
            'title' => ['sometimes', 'string', 'max:500'],
            'knowledge_icon' => ['sometimes', 'nullable', 'string', 'max:32'],
            'summary' => ['sometimes', 'nullable', 'string'],
            'body' => ['sometimes', 'nullable', 'string'],
            'stat_1_value' => ['sometimes', 'nullable', 'string', 'max:64'],
            'stat_1_label' => ['sometimes', 'nullable', 'string', 'max:128'],
            'stat_2_value' => ['sometimes', 'nullable', 'string', 'max:64'],
            'stat_2_label' => ['sometimes', 'nullable', 'string', 'max:128'],
            'goal_number' => ['nullable', 'integer', 'min:1', 'max:17'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('parent_id', $data) && (int) $data['parent_id'] === (int) $sdgNode->id) {
            return response()->json(['message' => 'Node cannot be its own parent.'], 422);
        }

        $sdgNode->fill($data);
        $sdgNode->save();

        return response()->json(['data' => $this->serialize($sdgNode->fresh())]);
    }

    public function destroy(SdgNode $sdgNode): JsonResponse
    {
        if ($sdgNode->children()->exists()) {
            return response()->json(['message' => 'Remove child SDG nodes first.'], 422);
        }
        $sdgNode->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(SdgNode $n): array
    {
        return [
            'id' => $n->id,
            'parent_id' => $n->parent_id,
            'node_type' => $n->node_type,
            'code' => $n->code,
            'title' => $n->title,
            'knowledge_icon' => $n->knowledge_icon,
            'summary' => $n->summary,
            'body' => $n->body,
            'stat_1_value' => $n->stat_1_value,
            'stat_1_label' => $n->stat_1_label,
            'stat_2_value' => $n->stat_2_value,
            'stat_2_label' => $n->stat_2_label,
            'goal_number' => $n->goal_number,
            'sort_order' => $n->sort_order,
        ];
    }
}
