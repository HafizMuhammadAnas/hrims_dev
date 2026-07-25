<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompiledRecord;
use App\Models\DepartmentTask;
use App\Models\RegionalResponse;
use App\Models\Region;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CompiledRecordController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if (! HrimsAccess::isNationalWorkflowOperator($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'hr_request_id' => ['required', 'string', 'exists:hr_requests,id'],
            'title' => ['required', 'string', 'max:500'],
            'region_names' => ['required', 'array', 'min:1'],
            'region_names.*' => ['string', 'max:128'],
            'summary' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['draft', 'submitted'])],
            'submitted_to' => ['nullable', 'string', 'max:255'],
        ]);

        $hrRequest = \App\Models\HrRequest::query()->find($data['hr_request_id']);
        if (! $hrRequest || ! HrimsAccess::userMayViewHrRequest($request->user(), $hrRequest)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $row = CompiledRecord::query()->create([
            'id' => 'COMP-'.strtoupper(Str::random(10)),
            'hr_request_id' => $data['hr_request_id'],
            'title' => $data['title'],
            'region_names' => $data['region_names'],
            'compilation_date' => now()->toDateString(),
            'submitted_to' => $data['submitted_to'] ?? ($data['status'] === 'submitted' ? 'Ministry of Human Rights' : null),
            'submission_date' => $data['status'] === 'submitted' ? now()->toDateString() : null,
            'status' => $data['status'],
            'attachment' => $data['status'] === 'submitted' ? 'compiled-report.pdf' : null,
            'summary' => $data['summary'] ?? null,
        ]);

        return response()->json([
            'data' => $this->serializeCompiledRecord($row),
        ], 201);
    }

    public function update(Request $request, string $compiledRecord): JsonResponse
    {
        if (! HrimsAccess::isNationalWorkflowOperator($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = CompiledRecord::query()->with('hrRequest')->find($compiledRecord);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if ($model->hrRequest && ! HrimsAccess::userMayViewHrRequest($request->user(), $model->hrRequest)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($model->status === 'submitted') {
            return response()->json(['message' => 'This record is already submitted and cannot be changed.'], 422);
        }

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['draft', 'submitted'])],
            'summary' => ['sometimes', 'nullable', 'string'],
            'title' => ['sometimes', 'string', 'max:500'],
            'submitted_to' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        if (array_key_exists('title', $data)) {
            $model->title = $data['title'];
        }
        if (array_key_exists('summary', $data)) {
            $model->summary = $data['summary'];
        }

        $nextStatus = $data['status'] ?? null;
        if ($nextStatus === 'submitted') {
            $model->status = 'submitted';
            $model->submission_date = now()->toDateString();
            $model->submitted_to = $data['submitted_to'] ?? $model->submitted_to ?? 'Ministry of Human Rights';
            $model->attachment = 'compiled-report.pdf';
        }

        $model->save();

        $model->refresh();

        return response()->json([
            'data' => $this->serializeCompiledRecord($model),
        ]);
    }

    /**
     * Preview which region names would compile for an HR request: accepted regional responses,
     * plus ICT / national-line when every submitted departmental task for that request is accepted.
     */
    public function preview(Request $request): JsonResponse
    {
        if (! HrimsAccess::isNationalWorkflowOperator($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'hr_request_id' => ['required', 'string', 'exists:hr_requests,id'],
        ]);

        $hrRequest = \App\Models\HrRequest::query()->find($data['hr_request_id']);
        if (! $hrRequest || ! HrimsAccess::userMayViewHrRequest($request->user(), $hrRequest)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $responses = RegionalResponse::query()
            ->with('region')
            ->where('hr_request_id', $data['hr_request_id'])
            ->where('review_status', 'accepted')
            ->get();

        $names = $responses->map(fn (RegionalResponse $r) => $r->region?->name)->filter()->unique()->values();
        $responseCount = $responses->count();

        $ictRegion = Region::query()->whereIn('slug', ['ict', 'federal'])->orderByRaw("CASE WHEN slug = 'ict' THEN 0 ELSE 1 END")->first();
        if ($ictRegion) {
            $ictTasks = DepartmentTask::query()
                ->where('hr_request_id', $data['hr_request_id'])
                ->where('region_id', $ictRegion->id)
                ->where(function ($q) {
                    $q->whereNotNull('submission_date')->orWhere('status', 'submitted');
                })
                ->get(['id', 'regional_review_status']);

            $ictSubmitted = $ictTasks->count();
            $ictAccepted = $ictTasks->where('regional_review_status', 'accepted')->count();
            if ($ictSubmitted > 0 && $ictAccepted === $ictSubmitted) {
                $nm = $ictRegion->name;
                if ($nm !== null && $nm !== '' && ! $names->contains($nm)) {
                    $names->push($nm);
                }
                $responseCount += $ictAccepted;
            }
        }

        return response()->json([
            'data' => [
                'region_names' => $names->values()->all(),
                'response_count' => $responseCount,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = CompiledRecord::query()->with('hrRequest');

        if (HrimsAccess::isConventionAdmin($request->user())) {
            $cid = HrimsAccess::conventionId($request->user());
            if ($cid === null) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereHas('hrRequest', fn ($q) => $q->where('convention_id', $cid));
            }
        } elseif (! HrimsAccess::seesAllRegions($request->user())) {
            $name = $request->user()->region?->name;
            if ($name) {
                $query->whereJsonContains('region_names', $name);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $rows = $query->orderByDesc('compilation_date')->orderByDesc('id')->get();

        return response()->json([
            'data' => $rows->map(fn (CompiledRecord $c) => $this->serializeCompiledRecord($c)),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCompiledRecord(CompiledRecord $c): array
    {
        return [
            'id' => $c->id,
            'req_id' => $c->hr_request_id,
            'title' => $c->title,
            'region_names' => $c->region_names,
            'compilation_date' => $c->compilation_date?->format('Y-m-d'),
            'submitted_to' => $c->submitted_to,
            'submission_date' => $c->submission_date?->format('Y-m-d'),
            'status' => $c->status,
            'attachment' => $c->attachment,
            'summary' => $c->summary,
        ];
    }
}
