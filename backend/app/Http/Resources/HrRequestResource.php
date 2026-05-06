<?php

namespace App\Http\Resources;

use App\Models\HrRequest;
use App\Models\Issue;
use App\Models\IssueIndicator;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
            'date' => $this->due_date?->format('Y-m-d') ?? '',
            'status' => $this->status,
            'details' => $this->details,
            'attachment_file_name' => $this->attachment_file_name,
            'federal_group_id' => $this->federal_group_id,
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
            'issue' => $this->whenLoaded('issue', fn () => $this->issue instanceof Issue ? $this->serializeIssue($this->issue) : null),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn ($a) => [
                'id' => $a->id,
                'original_name' => $a->original_name,
                'mime' => $a->mime,
                'size' => $a->size,
            ])->values()->all()),
            'indicator_responses' => $this->whenLoaded('indicatorResponses', fn () => $this->indicatorResponses->map(fn ($r) => [
                'issue_indicator_id' => $r->issue_indicator_id,
                'quantitative_value' => $r->quantitative_value,
                'qualitative_text' => $r->qualitative_text,
            ])->values()->all()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeIssue(Issue $i): array
    {
        $i->loadMissing(['category', 'articles', 'indicators']);

        return [
            'id' => $i->id,
            'issue_title' => $i->issue_title,
            'has_quantitative' => (bool) $i->has_quantitative,
            'has_qualitative' => (bool) $i->has_qualitative,
            'category' => $i->category
                ? ['id' => $i->category->id, 'name' => $i->category->name]
                : null,
            'articles' => $i->articles->sortBy('id')->values()->map(fn ($a) => [
                'id' => $a->id,
                'article_name' => $a->article_name,
                'relevant_paragraph' => $a->pivot->relevant_paragraph ?? null,
            ])->values()->all(),
            'indicators' => $i->indicators->map(function (IssueIndicator $ind) use ($i) {
                $flags = $i->effectiveIndicatorFlags($ind);

                return [
                    'id' => $ind->id,
                    'indicator_text' => $ind->indicator_text,
                    'disaggregation' => $ind->disaggregation,
                    'has_quantitative' => $flags['has_quantitative'],
                    'has_qualitative' => $flags['has_qualitative'],
                ];
            })->values()->all(),
        ];
    }
}
