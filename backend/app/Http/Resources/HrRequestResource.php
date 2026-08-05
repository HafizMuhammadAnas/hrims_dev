<?php

namespace App\Http\Resources;

use App\Models\HrRequest;
use App\Models\HrRequestAttachment;
use App\Models\HrRequestIndicatorYear;
use App\Models\Issue;
use App\Models\IssueIndicator;
use App\Support\RequestIndicatorYears;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin HrRequest */
class HrRequestResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'conv' => $this->conv,
            'convention_id' => $this->convention_id,
            'issue_id' => $this->issue_id,
            'request_type' => $this->request_type,
            'other_issue_text' => $this->other_issue_text,
            'reporting_framework' => $this->reporting_framework,
            'date' => $this->due_date?->format('Y-m-d') ?? '',
            'status' => $this->status,
            'details' => $this->details,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
            'attachment_file_name' => $this->attachment_file_name,
            'category_id' => $this->category_id,
            'subcategory_id' => $this->subcategory_id,
            'indicator_id' => $this->indicator_id,
            'recommendation_id' => $this->recommendation_id,
            'sdg' => $this->sdg,
            'sdg_indicator' => $this->sdg_indicator,
            'upr' => $this->upr,
            'upr_indicator' => $this->upr_indicator,
            'issue_cards' => $this->issue_cards,
            'region_id' => $this->region_id,
            'region' => $this->whenLoaded('region', fn () => [
                'id' => $this->region->id,
                'name' => $this->region->name,
                'slug' => $this->region->slug,
            ]),
            'region_name' => $this->region?->name,
            'regions' => $this->whenLoaded('regions', fn () => $this->regions->map(fn ($r) => [
                'id' => $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
            ])->values()->all()),
            'departments' => $this->whenLoaded('departments', fn () => $this->departments->map(fn ($d) => [
                'id' => $d->id,
                'code' => $d->code,
                'name' => $d->name,
            ])->values()->all()),
            'convention' => $this->whenLoaded('convention', fn () => $this->convention ? [
                'id' => $this->convention->id,
                'code' => $this->convention->code,
                'name' => $this->convention->name,
            ] : null),
            'issue' => $this->whenLoaded('issue', function () {
                if (! $this->issue instanceof Issue) {
                    return null;
                }
                if ($this->issue->relationLoaded('indicators')) {
                    return $this->serializeIssue($this->issue);
                }

                return [
                    'id' => $this->issue->id,
                    'entry_kind' => $this->issue->entry_kind === 'recommendation' ? 'recommendation' : 'issue',
                    'issue_title' => $this->issue->issue_title,
                    'description' => $this->issue->description,
                    'has_quantitative' => (bool) $this->issue->has_quantitative,
                    'has_qualitative' => (bool) $this->issue->has_qualitative,
                    'category' => $this->issue->relationLoaded('category') && $this->issue->category
                        ? ['id' => $this->issue->category->id, 'name' => $this->issue->category->name]
                        : null,
                    'articles' => [],
                    'indicators' => [],
                ];
            }),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn (HrRequestAttachment $a) => [
                'id' => $a->id,
                'original_name' => $a->original_name,
                'mime' => $a->mime,
                'size' => $a->size,
                'url' => $this->attachmentViewUrl($a),
            ])->values()->all()),
            'indicator_responses' => $this->whenLoaded('indicatorResponses', function () {
                $this->resource->loadMissing('indicatorYears');
                $yearsByIndicator = $this->indicatorYears
                    ->groupBy(fn (HrRequestIndicatorYear $y) => (int) $y->issue_indicator_id);

                return $this->indicatorResponses->map(function ($r) use ($yearsByIndicator) {
                    $iid = (int) $r->issue_indicator_id;
                    $rows = $yearsByIndicator->get($iid, collect());
                    $quant = $rows
                        ->where('kind', HrRequestIndicatorYear::KIND_QUANTITATIVE)
                        ->pluck('collection_year_id')
                        ->map(fn ($id) => (int) $id)
                        ->values()
                        ->all();
                    $qual = $rows
                        ->where('kind', HrRequestIndicatorYear::KIND_QUALITATIVE)
                        ->pluck('collection_year_id')
                        ->map(fn ($id) => (int) $id)
                        ->values()
                        ->all();

                    return [
                        'issue_indicator_id' => $iid,
                        'quantitative_value' => $r->quantitative_value,
                        'qualitative_text' => $r->qualitative_text,
                        'quantitative_year_ids' => $quant,
                        'qualitative_year_ids' => $qual,
                    ];
                })->values()->all();
            }),
        ];
    }

    /**
     * Public files: `/storage/...` after `php artisan storage:link`. Legacy `local` disk: authenticated download URL.
     */
    private function attachmentViewUrl(HrRequestAttachment $a): ?string
    {
        if ($a->path === null || $a->path === '') {
            return null;
        }
        if ($a->disk === 'public') {
            return Storage::disk('public')->url($a->path);
        }

        return route('api.v1.hr-requests.attachments.file', [
            'hrRequest' => $this->resource->getKey(),
            'attachment' => $a->id,
        ], false);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeIssue(Issue $i): array
    {
        $i->loadMissing([
            'category',
            'articles',
            'indicators.yearGenderCells.collectionYear:id,label,sort_order',
            'indicators.yearGenderCells.collectionGender:id,name,sort_order',
            'indicators.collectionYearRows.collectionYear:id,label,sort_order',
        ]);
        $this->resource->loadMissing('indicatorYears');

        return [
            'id' => $i->id,
            'entry_kind' => $i->entry_kind === 'recommendation' ? 'recommendation' : 'issue',
            'issue_title' => $i->issue_title,
            'description' => $i->description,
            'has_quantitative' => (bool) $i->has_quantitative,
            'has_qualitative' => (bool) $i->has_qualitative,
            'category' => $i->category
                ? ['id' => $i->category->id, 'name' => $i->category->name]
                : null,
            'articles' => $i->articles->sortBy('id')->values()->map(fn ($a) => [
                'id' => $a->id,
                'article_name' => $a->article_name,
                'description' => $a->description,
                'relevant_paragraph' => $a->pivot->relevant_paragraph ?? null,
            ])->values()->all(),
            'indicators' => (function () use ($i) {
                $this->resource->loadMissing('indicatorResponses');
                $selectedIds = $this->resource->indicatorResponses
                    ->pluck('issue_indicator_id')
                    ->map(fn ($id) => (int) $id)
                    ->all();

                return $i->indicators
                    ->filter(function (IssueIndicator $ind) use ($selectedIds) {
                        return $ind->isActive() || in_array((int) $ind->id, $selectedIds, true);
                    })
                    ->map(function (IssueIndicator $ind) use ($i) {
                        $api = $ind->toHrApiArray($i);

                        return RequestIndicatorYears::applyToIndicatorApi($api, $ind, $this->resource);
                    })
                    ->values()
                    ->all();
            })(),
        ];
    }
}
