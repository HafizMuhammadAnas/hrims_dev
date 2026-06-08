<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\HrRequestResource;
use App\Models\Convention;
use App\Models\Department;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\HrRequestAttachment;
use App\Models\HrRequestIndicatorResponse;
use App\Models\Issue;
use App\Models\IssueIndicator;
use App\Models\Region;
use App\Support\HrimsAccess;
use App\Support\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class HrRequestController extends Controller
{
    /**
     * Conventions available when creating/editing HR requests (all catalog rows).
     * Unlike the knowledge hub list, this is not limited to `is_active` so regional/federal
     * workflows can reference every convention that may have mapped issues.
     */
    public function formConventions(Request $request): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = Convention::query();
        if (Schema::hasColumn('conventions', 'sort_order')) {
            $q->orderBy('sort_order');
        }
        $rows = $q->orderBy('name')->get(['id', 'code', 'name']);

        return response()->json([
            'data' => $rows->map(fn (Convention $c) => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
            ]),
        ]);
    }

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
            ->with([
                'category',
                'articles',
                'indicators.yearGenderCells.collectionYear:id,label,sort_order',
                'indicators.yearGenderCells.collectionGender:id,name,sort_order',
            ])
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
            ->whereHas('regions', fn ($q) => $q->where('slug', 'ict'))
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
            $query->orderByDesc('created_at')->orderByDesc('id')->get()
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

    /**
     * Stream an HR request attachment for viewers who may open the file (images, PDFs, etc.).
     * New uploads use the `public` disk and are also exposed via `url` on the resource; legacy rows use `local`.
     */
    public function downloadHrRequestAttachment(Request $request, string $hrRequest, HrRequestAttachment $attachment): JsonResponse|\Symfony\Component\HttpFoundation\Response
    {
        $model = HrRequest::query()->find($hrRequest);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if ((string) $attachment->hr_request_id !== (string) $model->id) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if (! HrimsAccess::userMayViewHrRequest($request->user(), $model)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        if ($attachment->path === null || $attachment->path === '' || ! Storage::disk($attachment->disk)->exists($attachment->path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return Storage::disk($attachment->disk)->response(
            $attachment->path,
            $attachment->original_name,
            [
                'Content-Type' => $attachment->mime ?: 'application/octet-stream',
                'Content-Disposition' => 'inline; filename="'.addcslashes($attachment->original_name, '"\\').'"',
            ]
        );
    }

    public function destroyAttachment(Request $request, string $hrRequest, HrRequestAttachment $attachment): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = HrRequest::query()->find($hrRequest);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if ((string) $attachment->hr_request_id !== (string) $model->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $regionIds = HrimsAccess::scopedRegionIds($request->user());
        if ($regionIds !== null && ! $this->requestTouchesAllowedRegions($model, $regionIds)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($attachment->path && Storage::disk($attachment->disk)->exists($attachment->path)) {
            Storage::disk($attachment->disk)->delete($attachment->path);
        }
        $attachment->delete();

        return response()->json(['message' => 'Attachment removed']);
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
        $previousStatus = $model->status;

        if ($previousStatus === 'active') {
            return response()->json([
                'message' => 'Active requests cannot be edited. Only draft requests can be updated.',
            ], 422);
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
            'status' => ['sometimes', Rule::in(['draft', 'active'])],
            'details' => ['sometimes', 'nullable', 'string'],
            /** JSON array (multipart) or array (JSON body); decoded in controller. Omit to leave indicators unchanged. */
            'indicator_responses' => ['sometimes', 'nullable'],
            'attachments' => ['nullable'],
            'attachments.*' => ['file', 'max:15360'],
        ], [
            'title.max' => 'Title may not exceed 500 characters.',
            'region_id.exists' => 'Select a valid region.',
            'date.date' => 'Due date must be a valid date.',
            'status.in' => 'Status must be draft or active.',
        ]);

        if (! HrimsAccess::seesAllRegions($request->user())) {
            unset($data['region_id']);
        }

        if (array_key_exists('indicator_responses', $data) && $data['indicator_responses'] === null) {
            unset($data['indicator_responses']);
        } elseif (array_key_exists('indicator_responses', $data)) {
            $data['indicator_responses'] = $this->decodeIndicatorResponses($data['indicator_responses']);
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
                $deptIds = array_values(array_unique(array_map('intval', $data['department_ids'])));
                if ($deptIds !== []) {
                    $effectiveRegionIds = array_key_exists('region_ids', $data)
                        ? $data['region_ids']
                        : $model->regions()->pluck('id')->all();
                    $this->assertIctRegionAmongRequestRegions($effectiveRegionIds);
                }
                $this->validateFederalDepartments($data['department_ids']);
                $model->departments()->sync($data['department_ids']);
            }

            $model->save();

            if (array_key_exists('indicator_responses', $data) && $model->issue_id) {
                $issue = Issue::query()->findOrFail($model->issue_id);
                $this->syncIndicatorResponses($model, $issue, $data['indicator_responses']);
            }

            if ($request->hasFile('attachments')) {
                foreach ((array) $request->file('attachments') as $file) {
                    if (! $file || ! $file->isValid()) {
                        continue;
                    }
                    $path = $file->store('hr-requests/'.$model->id, 'public');
                    HrRequestAttachment::query()->create([
                        'hr_request_id' => $model->id,
                        'disk' => 'public',
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                        'mime' => $file->getClientMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }
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

        $this->syncDepartmentTasksAndNotifyAfterSave($model, $request, $previousStatus, $data);

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

        if ($model->status !== 'draft') {
            return response()->json([
                'message' => 'Only draft requests can be deleted. Active requests cannot be removed.',
            ], 422);
        }

        foreach ($model->attachments as $att) {
            if ($att->path && Storage::disk($att->disk)->exists($att->path)) {
                Storage::disk($att->disk)->delete($att->path);
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
            'status' => ['required', Rule::in(['draft', 'active'])],
            'details' => ['nullable', 'string'],
            'attachment_file_name' => ['nullable', 'string', 'max:255'],
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

        $conventionId = Convention::query()->where('code', $data['conv'])->value('id');
        if ($conventionId) {
            $row->convention_id = $conventionId;
            $row->save();
        }

        $row = $row->load(['region', 'regions', 'convention', 'issue', 'departments']);
        if ($row->status === 'active') {
            app(NotificationService::class)->notifyHrRequestCreated($row, $request->user());
        }

        return new HrRequestResource($row);
    }

    private function storeFromIssueForm(Request $request): HrRequestResource|JsonResponse
    {
        $rules = [
            'title' => ['required', 'string', 'max:500'],
            'convention_id' => ['required', 'integer', 'exists:conventions,id'],
            'issue_id' => ['required', 'integer', 'exists:issues,id'],
            'date' => ['required', 'date'],
            'status' => ['required', Rule::in(['draft', 'active'])],
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
            $this->assertIctRegionAmongRequestRegions($regionIds);
            $this->validateFederalDepartments($departmentIds);
        }
        if ($this->regionIdsAreIctOnly($regionIds) && $departmentIds === []) {
            throw ValidationException::withMessages([
                'department_ids' => ['Assign at least one national-line department when routing this request only to ICT.'],
            ]);
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
                    $path = $file->store('hr-requests/'.$row->id, 'public');
                    HrRequestAttachment::query()->create([
                        'hr_request_id' => $row->id,
                        'disk' => 'public',
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

        if ($row->status === 'active') {
            if ($departmentIds !== []) {
                $this->autoCreateDepartmentTasks($row->fresh(['regions']), $departmentIds, $request);
            }
            app(NotificationService::class)->notifyHrRequestCreated($row, $request->user());
        }

        return new HrRequestResource($row);
    }

    /**
     * @param  array<string, mixed>  $updateData
     */
    private function syncDepartmentTasksAndNotifyAfterSave(
        HrRequest $model,
        Request $request,
        string $previousStatus,
        array $updateData,
    ): void {
        $publishedNow = $previousStatus === 'draft' && $model->status === 'active';

        if ($publishedNow) {
            $deptIds = $model->departments()->pluck('id')->map(fn ($id) => (int) $id)->all();
            if ($deptIds === [] && array_key_exists('department_ids', $updateData)) {
                $deptIds = array_values(array_unique(array_map('intval', $updateData['department_ids'])));
            }
            if ($deptIds !== []) {
                $this->autoCreateDepartmentTasks($model->load(['regions']), $deptIds, $request);
            }
            app(NotificationService::class)->notifyHrRequestUpdated($model, $request->user(), $previousStatus);

            return;
        }

        if ($model->status === 'active' && array_key_exists('department_ids', $updateData)) {
            $deptIds = array_values(array_unique(array_map('intval', $updateData['department_ids'])));
            if ($deptIds !== []) {
                $this->autoCreateDepartmentTasks($model->load(['regions']), $deptIds, $request);
            }
        }

        app(NotificationService::class)->notifyHrRequestUpdated($model, $request->user(), $previousStatus);
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
            $indicatorRow = IssueIndicator::query()
                ->where('issue_id', $issue->id)
                ->whereKey($iid)
                ->first();
            if (! $indicatorRow) {
                throw ValidationException::withMessages([
                    'indicator_responses' => ['One or more indicators are not part of this issue.'],
                ]);
            }
            $flags = $issue->effectiveIndicatorFlags($indicatorRow);
            $allowsQ = $flags['has_quantitative'];
            $allowsL = $flags['has_qualitative'];

            $qv = $r['quantitative_value'] ?? null;
            $hasQv = $qv !== null && $qv !== '';
            if ($hasQv && ! $allowsQ) {
                throw ValidationException::withMessages([
                    'indicator_responses' => ['Quantitative values are not enabled for this indicator.'],
                ]);
            }
            $qt = $r['qualitative_text'] ?? null;
            $hasQt = $qt !== null && $qt !== '';
            if ($hasQt && ! $allowsL) {
                throw ValidationException::withMessages([
                    'indicator_responses' => ['Qualitative text is not enabled for this indicator.'],
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
    /**
     * @param  list<int|string>  $regionIds
     */
    private function assertIctRegionAmongRequestRegions(array $regionIds): void
    {
        $ictId = Region::query()->whereIn('slug', ['ict', 'federal'])->value('id');
        if (! $ictId) {
            return;
        }
        $ids = array_map('intval', $regionIds);
        if (! in_array((int) $ictId, $ids, true)) {
            throw ValidationException::withMessages([
                'department_ids' => ['Include the ICT region when linking ICT / national-line departments.'],
            ]);
        }
    }

    private function validateFederalDepartments(array $departmentIds): void
    {
        foreach ($departmentIds as $did) {
            $dept = Department::query()->find($did);
            if (! $dept || ! $dept->coversRegionSlug('ict')) {
                throw ValidationException::withMessages([
                    'department_ids' => ['Departments must be ICT / national-line departments.'],
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
        $i->loadMissing([
            'category',
            'articles',
            'indicators.yearGenderCells.collectionYear:id,label,sort_order',
            'indicators.yearGenderCells.collectionGender:id,name,sort_order',
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

    /**
     * Auto-create department tasks for selected departments.
     * Picks the task {@see DepartmentTask::$region_id} from the intersection of the request’s
     * regions and each department’s regions (preferring ICT when both match), so multi-region
     * requests still create ICT-line tasks when ICT is not the first saved region.
     *
     * @param  array<int>  $departmentIds
     */
    private function autoCreateDepartmentTasks(HrRequest $hrRequest, array $departmentIds, Request $request): void
    {
        if ($departmentIds === []) {
            return;
        }

        $hrRequest->loadMissing('regions');
        $requestRegionIds = $hrRequest->regions->pluck('id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        if ($requestRegionIds === []) {
            return;
        }

        $ictRegionId = $hrRequest->regions->first(fn (Region $r) => in_array($r->slug, ['ict', 'federal'], true))?->id;
        $ictRegionId = $ictRegionId !== null ? (int) $ictRegionId : null;

        foreach ($departmentIds as $deptId) {
            $department = Department::query()->with('regions')->find((int) $deptId);
            if (! $department) {
                continue;
            }

            $taskRegionId = $this->resolveTaskRegionIdForDepartmentAssignment($department, $requestRegionIds, $ictRegionId);
            if ($taskRegionId === null) {
                continue;
            }

            $taskExists = DepartmentTask::query()
                ->where('hr_request_id', $hrRequest->id)
                ->where('department_id', (int) $deptId)
                ->where('region_id', $taskRegionId)
                ->exists();

            if ($taskExists) {
                continue;
            }

            $task = DepartmentTask::query()->create([
                'id' => 'TSK-'.strtoupper(Str::random(10)),
                'hr_request_id' => $hrRequest->id,
                'region_id' => $taskRegionId,
                'department_id' => (int) $deptId,
                'status' => 'assigned',
                'assigned_date' => now()->toDateString(),
            ]);

            try {
                $task->load(['region', 'department']);
                app(NotificationService::class)->notifyDepartmentTaskAssigned($task, $request->user());
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }

    /**
     * @param  list<int>  $requestRegionIds
     */
    private function resolveTaskRegionIdForDepartmentAssignment(Department $department, array $requestRegionIds, ?int $preferredIctRegionId): ?int
    {
        $deptRegionIds = $department->regions->pluck('id')->map(fn ($id) => (int) $id)->all();
        $matches = [];
        foreach ($requestRegionIds as $rid) {
            $rid = (int) $rid;
            if (in_array($rid, $deptRegionIds, true)) {
                $matches[] = $rid;
            }
        }
        if ($matches === []) {
            return null;
        }
        if ($preferredIctRegionId !== null && in_array($preferredIctRegionId, $matches, true)) {
            return $preferredIctRegionId;
        }

        return $matches[0];
    }

    /**
     * @param  list<int|string>  $regionIds
     */
    private function regionIdsAreIctOnly(array $regionIds): bool
    {
        $ids = array_values(array_unique(array_map('intval', $regionIds)));
        if ($ids === []) {
            return false;
        }
        $rows = Region::query()->whereIn('id', $ids)->get(['slug']);
        if ($rows->count() !== count($ids)) {
            return false;
        }
        foreach ($rows as $r) {
            if (! in_array((string) $r->slug, ['ict', 'federal'], true)) {
                return false;
            }
        }

        return true;
    }
}

