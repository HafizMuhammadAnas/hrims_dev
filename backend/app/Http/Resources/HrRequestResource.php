<?php

namespace App\Http\Resources;

use App\Models\HrRequest;
use App\Models\HrRequestAttachment;
use App\Models\Issue;
use App\Models\IssueIndicator;
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
            'date' => $this->due_date?->format('Y-m-d') ?? '',
            'status' => $this->status,
            'details' => $this->details,
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
            'issue' => $this->whenLoaded('issue', fn () => $this->issue instanceof Issue ? $this->serializeIssue($this->issue) : null),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn (HrRequestAttachment $a) => [
                'id' => $a->id,
                'original_name' => $a->original_name,
                'mime' => $a->mime,
                'size' => $a->size,
                'url' => $this->attachmentViewUrl($a),
            ])->values()->all()),
            'indicator_responses' => $this->whenLoaded('indicatorResponses', fn () => $this->indicatorResponses->map(fn ($r) => [
                'issue_indicator_id' => $r->issue_indicator_id,
                'quantitative_value' => $r->quantitative_value,
                'qualitative_text' => $r->qualitative_text,
            ])->values()->all()),
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
            'indicators' => $i->indicators
                ->map(fn (IssueIndicator $ind) => $ind->toHrApiArray($i))
                ->values()
                ->all(),
        ];
    }
}
