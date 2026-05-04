<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Convention;
use App\Models\KnowledgeCard;
use App\Models\SdgNode;
use Illuminate\Http\JsonResponse;

class KnowledgeHubController extends Controller
{
    public function conventions(): JsonResponse
    {
        $rows = Convention::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows->map(fn (Convention $c) => $this->serializeConvention($c))]);
    }

    public function showConvention(Convention $convention): JsonResponse
    {
        if (! $convention->is_active) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $components = $convention->components()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => [
                ...$this->serializeConvention($convention),
                'components' => $components->map(fn ($x) => [
                    'id' => $x->id,
                    'type' => $x->type,
                    'code' => $x->code,
                    'title' => $x->title,
                    'body' => $x->body,
                    'sort_order' => $x->sort_order,
                ])->all(),
            ],
        ]);
    }

    public function sdgGoals(): JsonResponse
    {
        $rows = SdgNode::query()
            ->where('node_type', 'goal')
            ->orderBy('goal_number')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (SdgNode $n) => $this->serializeSdgGoal($n))]);
    }

    public function indicators(): JsonResponse
    {
        return $this->cardsForSection('indicators');
    }

    public function uprHighlights(): JsonResponse
    {
        return $this->cardsForSection('upr');
    }

    private function cardsForSection(string $section): JsonResponse
    {
        $rows = KnowledgeCard::query()
            ->where('section', $section)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows->map(fn (KnowledgeCard $k) => $this->serializeCard($k))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeConvention(Convention $c): array
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
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSdgGoal(SdgNode $n): array
    {
        return [
            'id' => $n->id,
            'code' => $n->code,
            'title' => $n->title,
            'goal_number' => $n->goal_number,
            'knowledge_icon' => $n->knowledge_icon,
            'summary' => $n->summary,
            'body' => $n->body,
            'stat_1_value' => $n->stat_1_value,
            'stat_1_label' => $n->stat_1_label,
            'stat_2_value' => $n->stat_2_value,
            'stat_2_label' => $n->stat_2_label,
            'sort_order' => $n->sort_order,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCard(KnowledgeCard $k): array
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
