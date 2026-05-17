<?php

namespace App\Http\Resources;

use App\Models\HrRequestClarification;
use App\Models\HrRequestClarificationAttachment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin HrRequestClarification */
class HrRequestClarificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'hr_request_id' => $this->hr_request_id,
            'region_id' => $this->region_id,
            'status' => $this->status,
            'region_message' => $this->region_message,
            'federal_response' => $this->federal_response,
            'region_submitted_at' => $this->region_submitted_at?->toIso8601String(),
            'federal_responded_at' => $this->federal_responded_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'region_name' => $this->whenLoaded('region', fn () => $this->region?->name),
            'region' => $this->whenLoaded('region', fn () => $this->region ? [
                'id' => $this->region->id,
                'name' => $this->region->name,
                'slug' => $this->region->slug,
            ] : null),
            'requested_by_name' => $this->whenLoaded('requestedBy', fn () => $this->requestedBy?->name),
            'responded_by_name' => $this->whenLoaded('respondedBy', fn () => $this->respondedBy?->name),
            'hr_request' => $this->whenLoaded('hrRequest', fn () => $this->hrRequest
                ? (new HrRequestResource($this->hrRequest))->toArray($request)
                : null),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(
                fn (HrRequestClarificationAttachment $a) => [
                    'id' => $a->id,
                    'side' => $a->side,
                    'original_name' => $a->original_name,
                    'mime' => $a->mime,
                    'size' => $a->size,
                    'url' => $this->attachmentUrl($a),
                ],
            )->values()->all()),
        ];
    }

    private function attachmentUrl(HrRequestClarificationAttachment $a): string
    {
        if ($a->disk === 'public') {
            return Storage::disk('public')->url($a->path);
        }

        return url('/api/v1/hr-request-clarifications/'.$a->hr_request_clarification_id.'/attachments/'.$a->id.'/file');
    }
}
