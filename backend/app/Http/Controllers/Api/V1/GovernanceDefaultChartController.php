<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GovernanceDefaultChart;
use Illuminate\Http\JsonResponse;

class GovernanceDefaultChartController extends Controller
{
    /** Dashboard consumers: active default charts only. */
    public function index(): JsonResponse
    {
        $rows = GovernanceDefaultChart::query()
            ->with(['seriesAIndicator:id,indicator_text', 'seriesBIndicator:id,indicator_text'])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (GovernanceDefaultChart $row) => $this->serialize($row)),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(GovernanceDefaultChart $row): array
    {
        return [
            'id' => $row->id,
            'sort_order' => (int) $row->sort_order,
            'kind' => $row->kind,
            'title' => $row->title,
            'shape' => $row->shape,
            'series_a_key' => $row->series_a_key,
            'series_a_label' => $row->series_a_label,
            'series_a_indicator_id' => $row->series_a_indicator_id,
            'series_a_indicator_text' => $row->seriesAIndicator?->indicator_text,
            'series_b_key' => $row->series_b_key,
            'series_b_label' => $row->series_b_label,
            'series_b_indicator_id' => $row->series_b_indicator_id,
            'series_b_indicator_text' => $row->seriesBIndicator?->indicator_text,
            'is_active' => (bool) $row->is_active,
        ];
    }
}
