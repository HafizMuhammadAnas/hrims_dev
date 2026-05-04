<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\HrRequestResource;
use App\Models\Convention;
use App\Models\Department;
use App\Models\HrRequest;
use App\Models\HrRequestAttachment;
use App\Models\HrRequestIndicatorResponse;
use App\Models\Issue;
use App\Models\IssueIndicator;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class HrRequestController extends Controller
{
    public function formIssues(Request $request): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'convention_id' => ['required', 'integer', 'exists:conventions,id'],
        ]);

        $issues = Issue::query()
            ->where('convention_id', $data['convention_id'])
            ->with(['category', 'articles', 'indicators'])
            ->orderBy('issue_title')
            ->get();

        return response()->json([
            'data' => $issues->map(fn (Issue $i) => $this->serializeIssueForForm($i)),
        ]);
    }

    public function formFederalDepartments(Request $request): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $rows = Department::query()
            ->whereHas('regions', fn ($q) => $q->where('slug', 'federal'))
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return response()->json([
            'data' => $rows->map(fn (Department $d) => [
                'id' => $d->id,
                'code' => $d->code,
                'name' => $d->name,
            ]),
        ]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = HrRequest::query()->with([
            'region',
            'regions',
            'convention:id,code,name',
            'issue:id,issue_title',
            'departments:id,code,name',
        ]);
        HrimsAccess::applyHrRequestScope($query, $request->user());

        return HrRequestResource::collection(
            $query->orderByDesc('due_date')->get()
        );
    }

    public function show(Request $request, string $hrRequest): HrRequestResource|JsonResponse
    {
        $model = HrRequest::query()
            ->with([
                'region',
                'regions',
                'convention',
                'issue.category',
                'issue.articles',
                'issue.indicators',
                'departments',
                'attachments',
                'indicatorResponses',
            ])
            ->find($hrRequest);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if (! HrimsAccess::userMayViewHrRequest($request->user(), $model)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return new HrRequestResource($model);
    }

    public function store(Request $request): HrRequestResource|JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($this->isLegacyStore($request)) {
            return $this->storeLegacy($request);
        }

        return $this->storeFromIssueForm($request);
    }

    public function update(Request $request, string $hrRequest): HrRequestResource|JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = HrRequest::query()->find($hrRequest);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $regionIds = HrimsAccess::scopedRegionIds($request->user());
        if ($regionIds !== null && ! $this->requestTouchesAllowedRegions($model, $regionIds)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:500'],
            'conv' => ['sometimes', 'string', 'max:64'],
            'convention_id' => ['sometimes', 'integer', 'exists:conventions,id'],
            'issue_id' => ['sometimes', 'integer', 'exists:issues,id'],
            'region_id' => ['sometimes', 'nullable', 'exists:regions,id'],
            'region_ids' => ['sometimes', 'array'],
            'region_ids.*' => ['integer', 'exists:regions,id'],
            'department_ids' => ['sometimes', 'array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'date' => ['sometimes', 'date'],
            'status' => ['sometimes', Rule::in(['pending', 'in-progress', 'completed', 'overdue'])],
            'details' => ['sometimes', 'nullable', 'string'],
            'indicator_responses' => ['sometimes', 'array'],
            'indicator_responses.*.issue_indicator_id' => ['required', 'integer', 'exists:issue_indicators,id'],
            'indicator_responses.*.quantitative_value' => ['nullable', 'numeric'],
            'indicator_responses.*.qualitative_text' => ['nullable', 'string'],
        ], [
            'title.max' => 'Title may not exceed 500 characters.',
            'region_id.exists' => 'Select a valid region.',
            'date.date' => 'Due date must be a valid date.',
            'status.in' => 'Status must be pending, in-progress, completed, or overdue.',
        ]);

        if (! HrimsAccess::seesAllRegions($request->user())) {
            unset($data['region_id']);
        }

        DB::transaction(function () use ($model, $data, $request) {
            if (isset($data['date'])) {
                $model->due_date = $data['date'];
            }
            unset($data['date']);

            if (array_key_exists('convention_id', $data) || array_key_exists('issue_id', $data)) {
                $conventionId = $data['convention_id'] ?? $model->convention_id;
                $issueId = $data['issue_id'] ?? $model->issue_id;
                if ($conventionId && $issueId) {
                    $issue = Issue::query()
                        ->whereKey($issueId)
                        ->where('convention_id', $conventionId)
                        ->first();
                    if (! $issue) {
                        throw ValidationException::withMessages([
                            'issue_id' => ['Issue must belong to the selected convention.'],
                        ]);
                    }
                }
            }

            $scalar = collect($data)->only(['title', 'conv', 'convention_id', 'issue_id', 'status', 'details', 'region_id'])->all();
            if ($scalar !== []) {
                $model->fill($scalar);
            }

            if (array_key_exists('conv', $data) && $model->convention_id) {
                $code = Convention::query()->whereKey($model->convention_id)->value('code');
                if ($code) {
                    $model->conv = $code;
                }
            }

            if (array_key_exists('region_ids', $data)) {
                $this->applyRegionIdsForUser($request->user(), $data['region_ids']);
                $model->regions()->sync($data['region_ids']);
                $model->region_id = $data['region_ids'][0] ?? null;
            }

            if (array_key_exists('department_ids', $data)) {
                $this->validateFederalDepartments($data['department_ids']);
                $model->departments()->sync($data['department_ids']);
            }

            $model->save();

            if (array_key_exists('indicator_responses', $data) && $model->issue_id) {
                $issue = Issue::query()->findOrFail($model->issue_id);
                $this->syncIndicatorResponses($model, $issue, $data['indicator_responses']);
            }
        });

        $model->load([
            'region',
            'regions',
            'convention',
            'issue.category',
            'issue.articles',
            'issue.indicators',
            'departments',
            'attachments',
            'indicatorResponses',
        ]);

        return new HrRequestResource($model);
    }

    public function destroy(Request $request, string $hrRequest): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = HrRequest::query()->find($hrRequest);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $regionIds = HrimsAccess::scopedRegionIds($request->user());
        if ($regionIds !== null && ! $this->requestTouchesAllowedRegions($model, $regionIds)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        foreach ($model->attachments as $att) {
            if ($att->disk === 'local' && $att->path && Storage::disk('local')->exists($att->path)) {
                Storage::disk('local')->delete($att->path);
            }
        }

        $model->delete();

        return response()->json(['message' => 'Deleted']);
    }

    private function isLegacyStore(Request $request): bool
    {
        return $request->isJson() && $request->has('id');
    }

    private function storeLegacy(Request $request): HrRequestResource|JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'string', 'max:64', 'unique:hr_requests,id'],
            'title' => ['required', 'string', 'max:500'],
            'conv' => ['required', 'string', 'max:64'],
            'region_id' => ['nullable', 'exists:regions,id'],
            'date' => ['required', 'date'],
            'status' => ['required', Rule::in(['pending', 'in-progress', 'completed', 'overdue'])],
            'details' => ['nullable', 'string'],
            'attachment_file_name' => ['nullable', 'string', 'max:255'],
            'federal_group_id' => ['nullable', 'exists:federal_groups,id'],
            'recommendation_id' => ['nullable', 'string'],
            'sdg' => ['nullable', 'string'],
            'sdg_indicator' => ['nullable', 'string'],
            'upr' => ['nullable', 'string'],
            'upr_indicator' => ['nullable', 'string'],
            'issue_cards' => ['nullable', 'array'],
        ], [
            'id.required' => 'Request ID is required.',
            'id.unique' => 'This request ID is already in use.',
            'title.required' => 'Title is required.',
            'conv.required' => 'Convention is required.',
            'region_id.exists' => 'Select a valid region.',
            'date.required' => 'Due date is required.',
            'status.required' => 'Status is required.',
            'federal_group_id.exists' => 'Select a valid federal group.',
        ]);

        if (! HrimsAccess::seesAllRegions($request->user())) {
            $homeRegionId = $request->user()->region_id;
            if ($homeRegionId === null) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $incoming = $data['region_id'] ?? null;
            if ($incoming !== null && (int) $incoming !== (int) $homeRegionId) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $data['region_id'] = (int) $homeRegionId;
        }

        $row = HrRequest::query()->create([
            'id' => $data['id'],
            'title' => $data['title'],
            'conv' => $data['conv'],
            'region_id' => $data['region_id'] ?? null,
            'due_date' => $data['date'],
            'status' => $data['status'],
            'details' => $data['details'] ?? null,
            'attachment_file_name' => $data['attachment_file_name'] ?? null,
            'federal_group_id' => $data['federal_group_id'] ?? null,
            'recommendation_id' => $data['recommendation_id'] ?? null,
            'sdg' => $data['sdg'] ?? null,
            'sdg_indicator' => $data['sdg_indicator'] ?? null,
            'upr' => $data['upr'] ?? null,
            'upr_indicator' => $data['upr_indicator'] ?? null,
            'issue_cards' => $data['issue_cards'] ?? null,
        ]);

        if (! empty($data['region_id'])) {
            $row->regions()->sync([(int) $data['region_id']]);
        }

        if (! empty($data['federal_group_id'])) {
            $row->federalGroups()->sync([$data['federal_group_id']]);
        }

        $conventionId = Convention::query()->where('code', $data['conv'])->value('id');
        if ($conventionId) {
            $row->convention_id = $conventionId;
            $row->save();
        }

        return new HrRequestResource($row->load(['region', 'regions', 'convention', 'issue', 'departments']));
    }

    private function storeFromIssueForm(Request $request): HrRequestResource|JsonResponse
    {
        $rules = [
            'title' => ['required', 'string', 'max:500'],
            'convention_id' => ['required', 'integer', 'exists:conventions,id'],
            'issue_id' => ['required', 'integer', 'exists:issues,id'],
            'date' => ['required', 'date'],
            'status' => ['required', Rule::in(['pending', 'in-progress', 'completed', 'overdue'])],
            'details' => ['nullable', 'string'],
            'region_ids' => ['nullable', 'array'],
            'region_ids.*' => ['integer', 'exists:regions,id'],
            'department_ids' => ['nullable', 'array'],
            'department_ids.*' => ['integer', 'exists:departments,id'],
            'indicator_responses' => ['nullable'],
            'attachments' => ['nullable'],
            'attachments.*' => ['file', 'max:15360'],
        ];

        $data = $request->validate($rules, [
            'title.required' => 'Title is required.',
            'convention_id.required' => 'Convention is required.',
            'issue_id.required' => 'Issue is required.',
            'date.required' => 'Due date is required.',
            'status.required' => 'Status is required.',
        ]);

        $issue = Issue::query()
            ->whereKey($data['issue_id'])
            ->where('convention_id', $data['convention_id'])
            ->first();
        if (! $issue) {
            return response()->json(['message' => 'Issue must belong to the selected convention.'], 422);
        }

        $indicatorPayload = $this->decodeIndicatorResponses($request->input('indicator_responses'));

        $regionIds = $data['region_ids'] ?? [];
        $this->applyRegionIdsForUser($request->user(), $regionIds);
        $data['region_ids'] = $regionIds;

        $departmentIds = array_values(array_unique(array_map('intval', $data['department_ids'] ?? [])));
        if ($departmentIds !== []) {
            $this->validateFederalDepartments($departmentIds);
        }

        $row = DB::transaction(function () use ($request, $data, $issue, $indicatorPayload, $departmentIds) {
            $id = $this->nextRequestId();
            $code = Convention::query()->whereKey($data['convention_id'])->value('code') ?? '';

            $row = HrRequest::query()->create([
                'id' => $id,
                'title' => $data['title'],
                'conv' => $code,
                'convention_id' => $data['convention_id'],
                'issue_id' => $data['issue_id'],
                'region_id' => $data['region_ids'][0] ?? null,
                'due_date' => $data['date'],
                'status' => $data['status'],
                'details' => $data['details'] ?? null,
            ]);

            $row->regions()->sync($data['region_ids']);

            if ($departmentIds !== []) {
                $row->departments()->sync($departmentIds);
            }

            if ($indicatorPayload !== []) {
                $this->syncIndicatorResponses($row, $issue, $indicatorPayload);
            }

            if ($request->hasFile('attachments')) {
                foreach ((array) $request->file('attachments') as $file) {
                    if (! $file || ! $file->isValid()) {
                        continue;
                    }
                    $path = $file->store('hr-requests/'.$row->id, 'local');
                    HrRequestAttachment::query()->create([
                        'hr_request_id' => $row->id,
                        'disk' => 'local',
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                        'mime' => $file->getClientMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }
            }

            return $row->fresh([
                'region',
                'regions',
                'convention',
                'issue.category',
                'issue.articles',
                'issue.indicators',
                'departments',
                'attachments',
                'indicatorResponses',
            ]);
        });

        return new HrRequestResource($row);
    }

    /**
     * @param  list<int>|null  $scopedRegionIds
     */
    private function requestTouchesAllowedRegions(HrRequest $model, array $scopedRegionIds): bool
    {
        foreach ($scopedRegionIds as $rid) {
            if ((int) $model->region_id === (int) $rid) {
                return true;
            }
            if ($model->regions()->where('regions.id', $rid)->exists()) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<array{issue_indicator_id: int, quantitative_value?: float|null, qualitative_text?: string|null}>
     */
    private function decodeIndicatorResponses(mixed $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }
        if (is_array($raw)) {
            $decoded = $raw;
        } else {
            if (! is_string($raw)) {
                return [];
            }
            $decoded = json_decode($raw, true);
        }
        if (! is_array($decoded)) {
            throw ValidationException::withMessages([
                'indicator_responses' => ['Indicator responses must be a JSON array.'],
            ]);
        }

        return $decoded;
    }

    /**
     * @param  list<array<string, mixed>>  $responses
     */
    private function syncIndicatorResponses(HrRequest $row, Issue $issue, array $responses): void
    {
        $allowed = $issue->indicators()->pluck('id')->map(fn ($id) => (int) $id)->all();
        HrRequestIndicatorResponse::query()->where('hr_request_id', $row->id)->delete();
        foreach ($responses as $r) {
            $iid = (int) ($r['issue_indicator_id'] ?? 0);
            if (! in_array($iid, $allowed, true)) {
                throw ValidationException::withMessages([
                    'indicator_responses' => ['One or more indicators are not part of this issue.'],
                ]);
            }
            $qv = $r['quantitative_value'] ?? null;
            $hasQv = $qv !== null && $qv !== '';
            if ($hasQv && ! $issue->has_quantitative) {
                throw ValidationException::withMessages([
                    'indicator_responses' => ['Quantitative values are not enabled for this issue.'],
                ]);
            }
            $qt = $r['qualitative_text'] ?? null;
            $hasQt = $qt !== null && $qt !== '';
            if ($hasQt && ! $issue->has_qualitative) {
                throw ValidationException::withMessages([
                    'indicator_responses' => ['Qualitative text is not enabled for this issue.'],
                ]);
            }
            HrRequestIndicatorResponse::query()->create([
                'hr_request_id' => $row->id,
                'issue_indicator_id' => $iid,
                'quantitative_value' => $hasQv ? (float) $qv : null,
                'qualitative_text' => $hasQt ? (string) $qt : null,
            ]);
        }
    }

    /**
     * @param  list<int>  $departmentIds
     */
    private function validateFederalDepartments(array $departmentIds): void
    {
        foreach ($departmentIds as $did) {
            $dept = Department::query()->find($did);
            if (! $dept || ! $dept->coversRegionSlug('federal')) {
                throw ValidationException::withMessages([
                    'department_ids' => ['Departments must be federal-line departments.'],
                ]);
            }
        }
    }

    private function applyRegionIdsForUser(\App\Models\User $user, array &$regionIds): void
    {
        $regionIds = array_values(array_unique(array_map('intval', $regionIds)));

        if (HrimsAccess::seesAllRegions($user)) {
            return;
        }

        $home = (int) $user->region_id;
        if ($regionIds === []) {
            $regionIds = [$home];

            return;
        }

        foreach ($regionIds as $id) {
            if ($id !== $home) {
                throw ValidationException::withMessages([
                    'region_ids' => ['You may only assign requests to your own region.'],
                ]);
            }
        }
    }

    private function nextRequestId(): string
    {
        return DB::transaction(function () {
            $year = (int) now()->format('Y');
            $prefix = 'REQ-'.$year.'-';
            $rows = HrRequest::query()
                ->where('id', 'like', $prefix.'%')
                ->lockForUpdate()
                ->pluck('id');
            $max = 0;
            foreach ($rows as $id) {
                if (preg_match('/^REQ-(\d{4})-(\d+)$/', $id, $m)) {
                    if ((int) $m[1] === $year) {
                        $max = max($max, (int) $m[2]);
                    }
                }
            }

            return $prefix.str_pad((string) ($max + 1), 4, '0', STR_PAD_LEFT);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeIssueForForm(Issue $i): array
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
            'indicators' => $i->indicators->map(fn (IssueIndicator $ind) => [
                'id' => $ind->id,
                'indicator_text' => $ind->indicator_text,
                'disaggregation' => $ind->disaggregation,
            ])->values()->all(),
        ];
    }
}
