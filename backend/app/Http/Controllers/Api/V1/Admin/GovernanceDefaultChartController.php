<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\GovernanceDefaultChart;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GovernanceDefaultChartController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = GovernanceDefaultChart::query()
            ->with(['seriesAIndicator:id,indicator_text', 'seriesBIndicator:id,indicator_text'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (GovernanceDefaultChart $row) => $this->serialize($row)),
        ]);
    }

    /** Replace the full default-chart configuration. */
    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'charts' => ['required', 'array', 'max:40'],
            'charts.*.kind' => ['required', 'string', Rule::in(['trend', 'comparison', 'dimension_totals'])],
            'charts.*.title' => ['required', 'string', 'max:500'],
            'charts.*.shape' => ['required', 'string', Rule::in(['line', 'bar', 'area', 'step', 'pie', 'composed'])],
            'charts.*.series_a_key' => ['nullable', 'string', 'max:64'],
            'charts.*.series_a_label' => ['required', 'string', 'max:255'],
            'charts.*.series_a_indicator_id' => ['nullable', 'integer', 'exists:issue_indicators,id'],
            'charts.*.series_b_key' => ['nullable', 'string', 'max:64'],
            'charts.*.series_b_label' => ['nullable', 'string', 'max:255'],
            'charts.*.series_b_indicator_id' => ['nullable', 'integer', 'exists:issue_indicators,id'],
            'charts.*.is_active' => ['sometimes', 'boolean'],
        ]);

        foreach ($data['charts'] as $i => $chart) {
            if (($chart['kind'] ?? '') === 'comparison') {
                if (empty($chart['series_b_label'])) {
                    return response()->json([
                        'message' => 'Comparison charts require a second series label.',
                        'errors' => ["charts.$i.series_b_label" => ['Required for comparison charts.']],
                    ], 422);
                }
            }
        }

        DB::transaction(function () use ($data) {
            GovernanceDefaultChart::query()->delete();

            foreach (array_values($data['charts']) as $index => $chart) {
                $kind = $chart['kind'];
                $isComparison = $kind === 'comparison';
                GovernanceDefaultChart::query()->create([
                    'sort_order' => $index,
                    'kind' => $kind,
                    'title' => $chart['title'],
                    'shape' => $chart['shape'],
                    'series_a_key' => $chart['series_a_key'] ?? ($isComparison ? 'series_a' : ($kind === 'dimension_totals' ? 'dimensions' : 'total')),
                    'series_a_label' => $chart['series_a_label'],
                    'series_a_indicator_id' => $chart['series_a_indicator_id'] ?? null,
                    'series_b_key' => $isComparison ? ($chart['series_b_key'] ?? 'series_b') : null,
                    'series_b_label' => $isComparison ? ($chart['series_b_label'] ?? null) : null,
                    'series_b_indicator_id' => $isComparison ? ($chart['series_b_indicator_id'] ?? null) : null,
                    'is_active' => array_key_exists('is_active', $chart) ? (bool) $chart['is_active'] : true,
                ]);
            }
        });

        $rows = GovernanceDefaultChart::query()
            ->with(['seriesAIndicator:id,indicator_text', 'seriesBIndicator:id,indicator_text'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (GovernanceDefaultChart $row) => $this->serialize($row))->values(),
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
