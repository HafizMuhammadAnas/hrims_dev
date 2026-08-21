<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DepartmentTask;
use App\Models\CollectionReligion;
use App\Models\District;
use App\Models\HrRequest;
use App\Models\HrRequestClarification;
use App\Models\Region;
use App\Models\IssueIndicator;
use App\Models\IssueIndicatorYear;
use App\Support\HrimsAccess;
use App\Support\NotificationService;
use App\Support\ResponseRevisionRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;

class DepartmentTaskController extends Controller
{
    private const DEPARTMENT_INDICATOR_FORMAT = 'department_indicator_v1';

    /**
     * @return array<string, mixed>
     */
    public static function serializeDepartmentTask(DepartmentTask $t, bool $redact): array
    {
        $t->loadMissing(['region', 'department']);

        return [
            'id' => $t->id,
            'req_id' => $t->hr_request_id,
            'region_id' => $t->region_id,
            'region_slug' => $t->region?->slug,
            'region_name' => $t->region?->name,
            'department_id' => $t->department?->code ?? (string) $t->department_id,
            'department_name' => $t->department?->name,
            'status' => $t->status,
            'regional_review_status' => $t->regional_review_status,
            'regional_review_comments' => $t->regional_review_comments,
            'assigned_date' => $t->assigned_date->format('Y-m-d'),
            'assignment_instructions' => $redact ? null : $t->assignment_instructions,
            'assigned_indicator_ids' => self::normalizeAssignedIndicatorIds($t->assigned_indicator_ids),
            'submission_date' => $t->submission_date?->format('Y-m-d'),
            'response_data' => $redact ? null : $t->response_data,
            'attachment_url' => $redact ? null : $t->attachment_url,
        ];
    }

    /**
     * @param  mixed  $raw
     * @return list<int>|null
     */
    private static function normalizeAssignedIndicatorIds(mixed $raw): ?array
    {
        if (! is_array($raw) || $raw === []) {
            return null;
        }

        $ids = array_values(array_unique(array_filter(array_map('intval', $raw), static fn (int $id) => $id > 0)));

        return $ids === [] ? null : $ids;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTask(DepartmentTask $t, bool $redact): array
    {
        return self::serializeDepartmentTask($t, $redact);
    }

    public function store(Request $request): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json([
                'message' => 'Only federal or regional administrators can assign department tasks.',
            ], 403);
        }

        $data = $request->validate([
            'hr_request_id' => ['required', 'string', 'exists:hr_requests,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'assignment_instructions' => ['nullable', 'string', 'max:20000'],
            'issue_indicator_ids' => ['sometimes', 'array'],
            'issue_indicator_ids.*' => ['integer', 'distinct', 'exists:issue_indicators,id'],
        ]);

        $hrRequest = HrRequest::query()->with(['regions', 'issue.indicators', 'indicatorResponses'])->find($data['hr_request_id']);
        if (! $hrRequest) {
            return response()->json(['message' => 'Request not found'], 404);
        }

        $allowedIndicatorIds = $this->allowedIssueIndicatorIdsForRequest($hrRequest);
        $assignedIndicatorIds = array_values(array_unique(array_map(
            'intval',
            is_array($data['issue_indicator_ids'] ?? null) ? $data['issue_indicator_ids'] : [],
        )));
        $assignedIndicatorIds = array_values(array_filter($assignedIndicatorIds, static fn (int $id) => $id > 0));

        if ($allowedIndicatorIds !== []) {
            if ($assignedIndicatorIds === []) {
                return response()->json([
                    'message' => 'Select at least one indicator for this department assignment.',
                ], 422);
            }
            foreach ($assignedIndicatorIds as $indicatorId) {
                if (! in_array($indicatorId, $allowedIndicatorIds, true)) {
                    return response()->json([
                        'message' => 'One or more indicators are not part of this request.',
                    ], 422);
                }
            }
        } else {
            $assignedIndicatorIds = [];
        }

        $requestRegionIds = $hrRequest->regions->pluck('id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        if ($requestRegionIds === [] && $hrRequest->region_id !== null) {
            $requestRegionIds = [(int) $hrRequest->region_id];
        }
        if ($requestRegionIds === []) {
            return response()->json(['message' => 'Request has no region assignment'], 422);
        }

        $department = Department::query()->with('regions')->find($data['department_id']);
        if (! $department) {
            return response()->json(['message' => 'Department not found'], 422);
        }

        $actorRegionId = $request->user()?->region_id !== null ? (int) $request->user()->region_id : null;
        $preferredIctId = $hrRequest->regions->first(fn (Region $r) => in_array($r->slug, ['ict', 'federal'], true))?->id;
        $preferredIctId = $preferredIctId !== null ? (int) $preferredIctId : null;

        $taskRegionId = null;
        if ($actorRegionId !== null && in_array($actorRegionId, $requestRegionIds, true)) {
            $deptRegionIds = $department->regions->pluck('id')->map(fn ($id) => (int) $id)->all();
            if (in_array($actorRegionId, $deptRegionIds, true)) {
                $taskRegionId = $actorRegionId;
            }
        }
        if ($taskRegionId === null) {
            $taskRegionId = $this->resolveTaskRegionIdForDepartmentAssignment($department, $requestRegionIds, $preferredIctId);
        }
        if ($taskRegionId === null) {
            return response()->json(['message' => 'Department must be linked to the same region as the request.'], 422);
        }

        $regionIds = HrimsAccess::scopedRegionIds($request->user());
        if ($regionIds !== null && ! in_array($taskRegionId, $regionIds, true)) {
            return response()->json([
                'message' => 'This HR request is not assigned to your region.',
            ], 403);
        }

        if ($hrRequest->status !== 'active') {
            return response()->json([
                'message' => 'This request is still a draft. Set status to Active in Request management before assigning departments.',
            ], 422);
        }

        $dup = DepartmentTask::query()
            ->where('hr_request_id', $hrRequest->id)
            ->where('department_id', $data['department_id'])
            ->where('region_id', $taskRegionId)
            ->exists();
        if ($dup) {
            return response()->json(['message' => 'This department is already assigned to the request'], 422);
        }

        $instructions = isset($data['assignment_instructions']) ? trim((string) $data['assignment_instructions']) : '';
        $payload = [
            'id' => 'TSK-'.strtoupper(Str::random(10)),
            'hr_request_id' => $hrRequest->id,
            'region_id' => $taskRegionId,
            'department_id' => $data['department_id'],
            'status' => 'assigned',
            'assigned_date' => now()->toDateString(),
        ];
        if (Schema::hasColumn('department_tasks', 'assignment_instructions')) {
            $payload['assignment_instructions'] = $instructions !== '' ? $instructions : null;
        }
        if (Schema::hasColumn('department_tasks', 'assigned_indicator_ids')) {
            $payload['assigned_indicator_ids'] = $assignedIndicatorIds !== [] ? $assignedIndicatorIds : null;
        }
        $task = DepartmentTask::query()->create($payload);

        $actorRegionId = $request->user()?->region_id;
        if ($actorRegionId) {
            HrRequestClarification::query()
                ->where('hr_request_id', $hrRequest->id)
                ->where('region_id', (int) $actorRegionId)
                ->whereIn('status', ['pending_federal', 'pending_region'])
                ->update(['status' => 'closed']);
        }

        $task->load(['region', 'department']);
        try {
            app(NotificationService::class)->notifyDepartmentTaskAssigned($task, $request->user());
        } catch (\Throwable $e) {
            // Task row is committed; do not fail assignment if notification persistence errors (see storage/logs).
            report($e);
        }

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($task, $redact),
        ], 201);
    }

    /**
     * @param  array<int|string, mixed>  $files
     */
    private function pickKeyedUploadedFile(array $files, int $indicatorId): ?UploadedFile
    {
        foreach ([$indicatorId, (string) $indicatorId] as $key) {
            if (! array_key_exists($key, $files)) {
                continue;
            }
            $f = $files[$key];
            if ($f instanceof UploadedFile) {
                return $f;
            }
        }

        return null;
    }

    private function deletePublicDiskFileByUrl(?string $url): void
    {
        if ($url === null || $url === '') {
            return;
        }
        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path)) {
            return;
        }
        $marker = '/storage/';
        $pos = strpos($path, $marker);
        if ($pos === false) {
            return;
        }
        $relative = substr($path, $pos + strlen($marker));
        if ($relative !== '' && Storage::disk('public')->exists($relative)) {
            Storage::disk('public')->delete($relative);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function parseStoredIndicatorPayload(?string $raw): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }
        $d = json_decode($raw, true);
        if (! is_array($d)) {
            return [];
        }
        if (($d['format'] ?? '') !== self::DEPARTMENT_INDICATOR_FORMAT) {
            return [];
        }

        return $d;
    }

    /**
     * @param  array<string, mixed>  $qIn
     */
    private function isMatrixDimensionEnabled(array $qIn, string $dimension): bool
    {
        $enabled = $qIn['matrix_row_enabled'] ?? null;
        if (
            $dimension === 'consolidated'
            && is_array($enabled)
            && ! array_key_exists('consolidated', $enabled)
            && array_key_exists('others', $enabled)
        ) {
            return (bool) $enabled['others'];
        }
        if (! is_array($enabled) || ! array_key_exists($dimension, $enabled)) {
            return true;
        }

        return (bool) $enabled[$dimension];
    }

    /**
     * @param  array<string, mixed>  $qIn
     * @return array<string, bool>|null
     */
    private function extractMatrixRowEnabled(array $qIn): ?array
    {
        $enabled = $qIn['matrix_row_enabled'] ?? null;
        if (! is_array($enabled)) {
            return null;
        }

        $out = [];
        foreach (['gender', 'age', 'disability', 'district', 'religion', 'consolidated'] as $dimension) {
            if (array_key_exists($dimension, $enabled) && $enabled[$dimension] === false) {
                $out[$dimension] = false;
            }
        }
        if (
            ! array_key_exists('consolidated', $out)
            && array_key_exists('others', $enabled)
            && $enabled['others'] === false
        ) {
            $out['consolidated'] = false;
        }

        return $out === [] ? null : $out;
    }

    /**
     * @param  mixed  $raw
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearGender(IssueIndicator $indicator, mixed $raw): array|JsonResponse
    {
        if (! is_array($raw)) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': year/gender values are required.',
            ], 422);
        }

        $indicator->loadMissing([
            'yearGenderCells.collectionYear',
            'yearGenderCells.collectionGender',
            'collectionYearRows.collectionYear',
        ]);
        $expected = [];
        if ((bool) $indicator->collects_by_gender) {
            foreach ($indicator->yearGenderCells as $cell) {
                $yearId = (int) $cell->collection_year_id;
                $genderId = (int) $cell->collection_gender_id;
                $expected[$yearId][$genderId] = true;
            }
        } else {
            foreach ($indicator->collectionYearRows as $row) {
                if (($row->kind ?? IssueIndicatorYear::KIND_QUALITATIVE) !== IssueIndicatorYear::KIND_QUANTITATIVE) {
                    continue;
                }
                $yearId = (int) $row->collection_year_id;
                $expected[$yearId][IssueIndicator::YEAR_ONLY_GENDER_ID] = true;
            }
        }

        if ($expected === []) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': no year collection mapping configured on the issue.',
            ], 422);
        }

        $out = [];
        foreach ($expected as $yearId => $genders) {
            $yearKey = (string) $yearId;
            $yearIn = $raw[$yearKey] ?? $raw[$yearId] ?? null;
            if (! is_array($yearIn)) {
                return response()->json([
                    'message' => 'Indicator '.$indicator->id.': missing values for year '.$yearId.'.',
                ], 422);
            }
            $out[$yearKey] = [];
            foreach (array_keys($genders) as $genderId) {
                $genderKey = (string) $genderId;
                $cellIn = $yearIn[$genderKey] ?? $yearIn[$genderId] ?? null;
                $valRaw = is_array($cellIn) ? ($cellIn['value'] ?? null) : $cellIn;
                if ($valRaw === null || trim((string) $valRaw) === '') {
                    $valRaw = '0';
                }
                if (! is_numeric($valRaw)) {
                    return response()->json([
                        'message' => 'Indicator '.$indicator->id.': all year/gender values must be numeric.',
                    ], 422);
                }
                $out[$yearKey][$genderKey] = ['value' => (float) $valRaw];
            }

            // Optional editable year total (when gender breakdown is unknown or as a checksum).
            $totalIn = $yearIn['total'] ?? null;
            $totalRaw = is_array($totalIn) ? ($totalIn['value'] ?? null) : $totalIn;
            if ($totalRaw !== null && trim((string) $totalRaw) !== '') {
                if (! is_numeric($totalRaw)) {
                    return response()->json([
                        'message' => 'Indicator '.$indicator->id.': year total must be numeric.',
                    ], 422);
                }
                $out[$yearKey]['total'] = ['value' => (float) $totalRaw];
            } else {
                $sum = 0.0;
                foreach ($out[$yearKey] as $cell) {
                    $sum += (float) ($cell['value'] ?? 0);
                }
                $out[$yearKey]['total'] = ['value' => $sum];
            }
        }

        return $out;
    }

    /**
     * @param  list<string>  $expectedKeys
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearFixedKeys(
        IssueIndicator $indicator,
        mixed $raw,
        array $expectedKeys,
        string $dimensionLabel,
    ): array|JsonResponse {
        $yearIds = $this->configuredCollectionYearIds($indicator);
        if ($yearIds === []) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': no year collection mapping configured on the issue.',
            ], 422);
        }

        if (! is_array($raw)) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': '.$dimensionLabel.' values are required.',
            ], 422);
        }

        $out = [];
        foreach ($yearIds as $yearId) {
            $yearKey = (string) $yearId;
            $yearIn = $raw[$yearKey] ?? $raw[$yearId] ?? null;
            if (! is_array($yearIn)) {
                return response()->json([
                    'message' => 'Indicator '.$indicator->id.': missing '.$dimensionLabel.' values for year '.$yearId.'.',
                ], 422);
            }
            $out[$yearKey] = [];
            foreach ($expectedKeys as $cellKey) {
                $cellIn = $yearIn[$cellKey] ?? null;
                $valRaw = is_array($cellIn) ? ($cellIn['value'] ?? null) : $cellIn;
                if ($valRaw === null || trim((string) $valRaw) === '') {
                    $valRaw = '0';
                }
                if (! is_numeric($valRaw)) {
                    return response()->json([
                        'message' => 'Indicator '.$indicator->id.': all '.$dimensionLabel.' values must be numeric.',
                    ], 422);
                }
                $out[$yearKey][$cellKey] = ['value' => (float) $valRaw];
            }

            // Optional editable year total (when breakdown is unknown or as a checksum).
            $totalIn = $yearIn['total'] ?? null;
            $totalRaw = is_array($totalIn) ? ($totalIn['value'] ?? null) : $totalIn;
            if ($totalRaw !== null && trim((string) $totalRaw) !== '') {
                if (! is_numeric($totalRaw)) {
                    return response()->json([
                        'message' => 'Indicator '.$indicator->id.': '.$dimensionLabel.' year total must be numeric.',
                    ], 422);
                }
                $out[$yearKey]['total'] = ['value' => (float) $totalRaw];
            } else {
                $sum = 0.0;
                foreach ($out[$yearKey] as $cell) {
                    $sum += (float) ($cell['value'] ?? 0);
                }
                $out[$yearKey]['total'] = ['value' => $sum];
            }
        }

        return $out;
    }

    /**
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearAge(IssueIndicator $indicator, mixed $raw): array|JsonResponse
    {
        return $this->normalizeQuantitativeByYearFixedKeys(
            $indicator,
            $raw,
            [IssueIndicator::AGE_UNDER_18, IssueIndicator::AGE_18_60, IssueIndicator::AGE_ABOVE_60],
            'age',
        );
    }

    /**
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearDisability(IssueIndicator $indicator, mixed $raw): array|JsonResponse
    {
        return $this->normalizeQuantitativeByYearFixedKeys(
            $indicator,
            $raw,
            IssueIndicator::DISABILITY_KEYS,
            'disability',
        );
    }

    /**
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearRegion(IssueIndicator $indicator, mixed $raw): array|JsonResponse
    {
        $regionIds = Region::query()->orderBy('name')->pluck('id')->map(fn ($id) => (string) $id)->all();
        if ($regionIds === []) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': no regions are configured in the system.',
            ], 422);
        }

        return $this->normalizeQuantitativeByYearFixedKeys($indicator, $raw, $regionIds, 'region');
    }

    /**
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearDistrict(IssueIndicator $indicator, mixed $raw, int $taskRegionId = 0): array|JsonResponse
    {
        $query = District::query()->orderBy('name');
        if ($taskRegionId > 0) {
            $query->where('region_id', $taskRegionId);
        }
        $districtIds = $query->pluck('id')->map(fn ($id) => (string) $id)->all();
        if ($districtIds === []) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': no districts are configured in the system.',
            ], 422);
        }

        return $this->normalizeQuantitativeByYearFixedKeys($indicator, $raw, $districtIds, 'district');
    }

    /**
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearReligion(IssueIndicator $indicator, mixed $raw): array|JsonResponse
    {
        $religionIds = CollectionReligion::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();
        if ($religionIds === []) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': no religions are configured in the system.',
            ], 422);
        }

        return $this->normalizeQuantitativeByYearFixedKeys($indicator, $raw, $religionIds, 'religion');
    }

    /**
     * Consolidated Data dimension: Total only per configured year (no breakdown columns).
     *
     * @return array<string, array<string, array{value: float}>>|JsonResponse
     */
    private function normalizeQuantitativeByYearConsolidated(IssueIndicator $indicator, mixed $raw): array|JsonResponse
    {
        $yearIds = $this->configuredCollectionYearIds($indicator);
        if ($yearIds === []) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': no year collection mapping configured on the issue.',
            ], 422);
        }

        if (! is_array($raw)) {
            return response()->json([
                'message' => 'Indicator '.$indicator->id.': consolidated data values are required.',
            ], 422);
        }

        $out = [];
        foreach ($yearIds as $yearId) {
            $yearKey = (string) $yearId;
            $yearIn = $raw[$yearKey] ?? $raw[$yearId] ?? null;
            if (! is_array($yearIn)) {
                return response()->json([
                    'message' => 'Indicator '.$indicator->id.': missing consolidated data values for year '.$yearId.'.',
                ], 422);
            }
            $totalIn = $yearIn['total'] ?? null;
            $totalRaw = is_array($totalIn) ? ($totalIn['value'] ?? null) : $totalIn;
            if ($totalRaw === null || trim((string) $totalRaw) === '') {
                $totalRaw = '0';
            }
            if (! is_numeric($totalRaw)) {
                return response()->json([
                    'message' => 'Indicator '.$indicator->id.': consolidated data year total must be numeric.',
                ], 422);
            }
            $out[$yearKey] = [
                'total' => ['value' => (float) $totalRaw],
            ];
        }

        return $out;
    }

    /**
     * @return list<int>
     */
    private function configuredCollectionYearIds(IssueIndicator $indicator): array
    {
        return $indicator->configuredCollectionYearIds();
    }

    /**
     * @return list<int>
     */
    private function allowedIssueIndicatorIdsForRequest(HrRequest $hrRequest): array
    {
        $hrRequest->loadMissing(['issue.indicators', 'indicatorResponses']);
        $issue = $hrRequest->issue;
        if (! $issue) {
            return [];
        }

        $selectedIds = $hrRequest->indicatorResponses->pluck('issue_indicator_id')->map(fn ($id) => (int) $id)->all();
        $ids = [];
        foreach ($issue->indicators as $ind) {
            $f = $issue->effectiveIndicatorFlags($ind);
            if (! $f['has_quantitative'] && ! $f['has_qualitative']) {
                continue;
            }
            if ($selectedIds !== [] && ! in_array((int) $ind->id, $selectedIds, true)) {
                continue;
            }
            $ids[] = (int) $ind->id;
        }

        return $ids;
    }

    private function departmentTaskUsesIndicatorBundles(?HrRequest $hrRequest): bool
    {
        if ($hrRequest?->request_type === 'other_issue') {
            return false;
        }
        if (! $hrRequest || ! $hrRequest->issue) {
            return false;
        }
        $hrRequest->loadMissing(['issue.indicators', 'indicatorResponses']);
        $issue = $hrRequest->issue;
        if ($issue->indicators->isEmpty()) {
            return false;
        }

        $selectedIds = $hrRequest->indicatorResponses->pluck('issue_indicator_id')->map(fn ($id) => (int) $id)->all();

        return $issue->indicators->contains(function (IssueIndicator $ind) use ($issue, $selectedIds) {
            $f = $issue->effectiveIndicatorFlags($ind);
            if (! $f['has_quantitative'] && ! $f['has_qualitative']) {
                return false;
            }
            if ($selectedIds !== []) {
                return in_array((int) $ind->id, $selectedIds, true);
            }

            return true;
        });
    }

    private function submitLegacyDepartmentTaskResponse(Request $request, DepartmentTask $departmentTask): JsonResponse
    {
        $wasResubmit = $departmentTask->status === 'submitted'
            && $departmentTask->regional_review_status === 'needs-modification';

        $data = $request->validate([
            'response_data' => ['nullable', 'string', 'max:200000'],
            'attachment' => ['nullable', 'file', 'max:15360'],
            'remove_attachment' => ['sometimes', 'boolean'],
        ]);

        $text = trim($data['response_data'] ?? '');
        $prevText = trim((string) ($departmentTask->response_data ?? ''));
        $prevAttach = trim((string) ($departmentTask->attachment_url ?? ''));
        $removeAttachment = $request->boolean('remove_attachment');

        if ($text === '' && ! $request->hasFile('attachment')) {
            $willKeepAttachment = $prevAttach !== '' && ! $removeAttachment;
            if ($prevText === '' && ! $willKeepAttachment) {
                return response()->json(['message' => 'Provide a written response and/or an attachment.'], 422);
            }
        }

        $attachmentUrl = $departmentTask->attachment_url;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            if ($file && $file->isValid()) {
                if ($attachmentUrl) {
                    $this->deletePublicDiskFileByUrl($attachmentUrl);
                }
                $path = $file->store('department-tasks/'.$departmentTask->id, 'public');
                $attachmentUrl = Storage::disk('public')->url($path);
            }
        } elseif ($removeAttachment) {
            if ($attachmentUrl) {
                $this->deletePublicDiskFileByUrl($attachmentUrl);
            }
            $attachmentUrl = null;
        }

        if ($wasResubmit) {
            app(ResponseRevisionRecorder::class)->snapshotDepartmentTask($departmentTask, $request->user());
        }

        $this->persistDepartmentTask($departmentTask, [
            'response_data' => $text !== '' ? $text : $departmentTask->response_data,
            'attachment_url' => $attachmentUrl,
            'submission_date' => now()->toDateString(),
            'status' => 'submitted',
            'regional_review_status' => null,
            'regional_review_comments' => null,
            'pending_revision_origin' => null,
        ]);

        $fresh = $departmentTask->fresh(['region', 'department', 'hrRequest']);
        app(NotificationService::class)->notifyDepartmentTaskSubmitted($fresh, $request->user(), $wasResubmit);

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($fresh, $redact),
        ]);
    }

    private function submitIndicatorBundleDepartmentTaskResponse(Request $request, DepartmentTask $departmentTask): JsonResponse
    {
        $wasResubmit = $departmentTask->status === 'submitted'
            && $departmentTask->regional_review_status === 'needs-modification';

        $hrRequest = $departmentTask->hrRequest;
        $issue = $hrRequest?->issue;
        if (! $issue) {
            return response()->json(['message' => 'Request has no issue for indicator responses.'], 422);
        }
        $hrRequest->loadMissing(['indicatorResponses', 'indicatorYears']);
        $issue->loadMissing([
            'indicators.yearGenderCells.collectionYear',
            'indicators.yearGenderCells.collectionGender',
            'indicators.collectionYearRows.collectionYear',
        ]);
        $selectedIds = $hrRequest->indicatorResponses->pluck('issue_indicator_id')->map(fn ($id) => (int) $id)->all();

        $validated = $request->validate([
            'indicator_bundles' => ['required', 'string', 'max:500000'],
            'quant_file' => ['nullable', 'array'],
            'quant_file.*' => ['nullable', 'file', 'max:15360'],
            'qual_file' => ['nullable', 'array'],
            'qual_file.*' => ['nullable', 'file', 'max:15360'],
            'strip_quant' => ['sometimes', 'array'],
            'strip_quant.*' => ['integer'],
            'strip_qual' => ['sometimes', 'array'],
            'strip_qual.*' => ['integer'],
        ]);

        $decoded = json_decode($validated['indicator_bundles'], true);
        if (! is_array($decoded) || ! isset($decoded['by_indicator']) || ! is_array($decoded['by_indicator'])) {
            return response()->json(['message' => 'indicator_bundles must be JSON with a by_indicator object.'], 422);
        }
        $submitted = $decoded['by_indicator'];

        $prevPayload = $this->parseStoredIndicatorPayload($departmentTask->response_data);
        $prevBy = $prevPayload['by_indicator'] ?? [];

        $quantFilesRaw = $request->file('quant_file', []);
        $qualFilesRaw = $request->file('qual_file', []);
        $quantFiles = is_array($quantFilesRaw) ? $quantFilesRaw : [];
        $qualFiles = is_array($qualFilesRaw) ? $qualFilesRaw : [];

        $stripQuantIds = array_values(array_unique(array_map('intval', (array) $request->input('strip_quant', []))));
        $stripQualIds = array_values(array_unique(array_map('intval', (array) $request->input('strip_qual', []))));

        $outBy = [];

        $assignedOnTask = self::normalizeAssignedIndicatorIds($departmentTask->assigned_indicator_ids);

        $scopedIndicators = $issue->indicators->filter(function (IssueIndicator $indicator) use ($issue, $selectedIds, $assignedOnTask) {
            $flags = $issue->effectiveIndicatorFlags($indicator);
            if (! $flags['has_quantitative'] && ! $flags['has_qualitative']) {
                return false;
            }
            if ($selectedIds !== []) {
                if (! in_array((int) $indicator->id, $selectedIds, true)) {
                    return false;
                }
            }
            // Honor per-department assignment from regional distribution.
            if ($assignedOnTask !== null) {
                return in_array((int) $indicator->id, $assignedOnTask, true);
            }

            return true;
        });

        foreach ($scopedIndicators as $indicator) {
            \App\Support\RequestIndicatorYears::hydrateIndicatorRelations($indicator, $hrRequest);
            $flags = $issue->effectiveIndicatorFlags($indicator);
            $idKey = (string) $indicator->id;
            $entry = $submitted[$idKey] ?? $submitted[$indicator->id] ?? null;
            if (! is_array($entry)) {
                return response()->json(['message' => 'Missing response bundle for indicator '.$indicator->id.'.'], 422);
            }

            $labelRaw = isset($entry['indicator_label']) ? trim((string) $entry['indicator_label']) : '';
            $row = [
                'indicator_label' => $labelRaw !== '' ? $labelRaw : null,
            ];

            $collectsYearGender = (bool) $indicator->collects_by_year && $flags['has_quantitative'];
            if ($flags['has_quantitative']) {
                $qIn = $entry['quantitative'] ?? null;
                if (! is_array($qIn)) {
                    $msg = $collectsYearGender
                        ? 'Indicator '.$indicator->id.': quantitative breakdown by year (matrix tables) is required.'
                        : 'Indicator '.$indicator->id.': quantitative fields are required.';

                    return response()->json(['message' => $msg], 422);
                }
                $comment = trim((string) ($qIn['comment'] ?? ''));
                if ($comment === '') {
                    return response()->json([
                        'message' => 'Indicator '.$indicator->id.': a narrative related to the indicator is required.',
                    ], 422);
                }
                $qFile = $this->pickKeyedUploadedFile($quantFiles, (int) $indicator->id);
                $qUrl = null;
                if ($qFile && $qFile->isValid()) {
                    $prevQ = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['quantitative'] ?? null) : null;
                    $prevQUrl = is_array($prevQ) ? ($prevQ['attachment_url'] ?? null) : null;
                    if (is_string($prevQUrl) && $prevQUrl !== '') {
                        $this->deletePublicDiskFileByUrl($prevQUrl);
                    }
                    $path = $qFile->store('department-tasks/'.$departmentTask->id.'/quant', 'public');
                    $qUrl = Storage::disk('public')->url($path);
                } elseif (in_array((int) $indicator->id, $stripQuantIds, true)) {
                    $prevQ = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['quantitative'] ?? null) : null;
                    $prevQUrl = is_array($prevQ) ? ($prevQ['attachment_url'] ?? null) : null;
                    if (is_string($prevQUrl) && $prevQUrl !== '') {
                        $this->deletePublicDiskFileByUrl($prevQUrl);
                    }
                    $qUrl = null;
                } else {
                    $prevQ = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['quantitative'] ?? null) : null;
                    $qUrl = is_array($prevQ) ? ($prevQ['attachment_url'] ?? null) : null;
                }

                if ($collectsYearGender) {
                    $quantitative = [
                        'comment' => $comment !== '' ? $comment : null,
                        'attachment_url' => $qUrl,
                    ];
                    $matrixRowEnabled = $this->extractMatrixRowEnabled($qIn);
                    if ($matrixRowEnabled !== null) {
                        $quantitative['matrix_row_enabled'] = $matrixRowEnabled;
                    }

                    if (
                        ($indicator->isYearOnlyCollection() || (bool) $indicator->collects_by_gender)
                        && $this->isMatrixDimensionEnabled($qIn, 'gender')
                    ) {
                        $normalized = $this->normalizeQuantitativeByYearGender($indicator, $qIn['by_year_gender'] ?? null);
                        if ($normalized instanceof JsonResponse) {
                            return $normalized;
                        }
                        $quantitative['by_year_gender'] = $normalized;
                    }

                    if ((bool) $indicator->collects_by_age && $this->isMatrixDimensionEnabled($qIn, 'age')) {
                        $normalized = $this->normalizeQuantitativeByYearAge($indicator, $qIn['by_year_age'] ?? null);
                        if ($normalized instanceof JsonResponse) {
                            return $normalized;
                        }
                        $quantitative['by_year_age'] = $normalized;
                    }

                    if ((bool) $indicator->collects_by_disability && $this->isMatrixDimensionEnabled($qIn, 'disability')) {
                        $normalized = $this->normalizeQuantitativeByYearDisability($indicator, $qIn['by_year_disability'] ?? null);
                        if ($normalized instanceof JsonResponse) {
                            return $normalized;
                        }
                        $quantitative['by_year_disability'] = $normalized;
                    }

                    if ((bool) $indicator->collects_by_location && $this->isMatrixDimensionEnabled($qIn, 'district')) {
                        $normalizedDistrict = $this->normalizeQuantitativeByYearDistrict(
                            $indicator,
                            $qIn['by_year_district'] ?? null,
                            (int) $departmentTask->region_id,
                        );
                        if ($normalizedDistrict instanceof JsonResponse) {
                            return $normalizedDistrict;
                        }
                        $quantitative['by_year_district'] = $normalizedDistrict;
                    }

                    if ((bool) $indicator->collects_by_religion && $this->isMatrixDimensionEnabled($qIn, 'religion')) {
                        $normalized = $this->normalizeQuantitativeByYearReligion($indicator, $qIn['by_year_religion'] ?? null);
                        if ($normalized instanceof JsonResponse) {
                            return $normalized;
                        }
                        $quantitative['by_year_religion'] = $normalized;
                    }

                    if (
                        (bool) $indicator->collects_by_consolidated
                        && $this->isMatrixDimensionEnabled($qIn, 'consolidated')
                    ) {
                        $normalized = $this->normalizeQuantitativeByYearConsolidated(
                            $indicator,
                            $qIn['by_year_consolidated'] ?? $qIn['by_year_others'] ?? null,
                        );
                        if ($normalized instanceof JsonResponse) {
                            return $normalized;
                        }
                        $quantitative['by_year_consolidated'] = $normalized;
                    }

                    $row['quantitative'] = $quantitative;
                } else {
                    $valRaw = $qIn['value'] ?? null;
                    if ($valRaw === null || trim((string) $valRaw) === '') {
                        return response()->json(['message' => 'Indicator '.$indicator->id.': a number is required.'], 422);
                    }
                    if (! is_numeric($valRaw)) {
                        return response()->json(['message' => 'Indicator '.$indicator->id.': the number must be numeric.'], 422);
                    }
                    $row['quantitative'] = [
                        'value' => (float) $valRaw,
                        'comment' => $comment !== '' ? $comment : null,
                        'attachment_url' => $qUrl,
                    ];
                }
            } else {
                $row['quantitative'] = null;
            }

            if ($flags['has_qualitative']) {
                $lIn = $entry['qualitative'] ?? null;
                if (! is_array($lIn)) {
                    return response()->json(['message' => 'Indicator '.$indicator->id.': qualitative fields are required.'], 422);
                }

                $qualYearIds = $indicator->qualitativeCollectionYearIds();
                $byYearIn = is_array($lIn['by_year'] ?? null) ? $lIn['by_year'] : null;
                $byYearOut = [];
                if ($qualYearIds !== []) {
                    if (! is_array($byYearIn)) {
                        // Legacy single-text submit → apply to every qualitative year.
                        $legacyText = trim((string) ($lIn['text'] ?? ''));
                        if ($legacyText === '') {
                            return response()->json([
                                'message' => 'Indicator '.$indicator->id.': qualitative text is required for each selected year.',
                            ], 422);
                        }
                        foreach ($qualYearIds as $yearId) {
                            $byYearOut[(string) $yearId] = ['text' => $legacyText];
                        }
                    } else {
                        foreach ($qualYearIds as $yearId) {
                            $yearKey = (string) $yearId;
                            $yearEntry = $byYearIn[$yearKey] ?? $byYearIn[$yearId] ?? null;
                            $yearText = is_array($yearEntry)
                                ? trim((string) ($yearEntry['text'] ?? ''))
                                : trim((string) ($yearEntry ?? ''));
                            if ($yearText === '') {
                                return response()->json([
                                    'message' => 'Indicator '.$indicator->id.': qualitative text is required for year '.$yearId.'.',
                                ], 422);
                            }
                            $byYearOut[$yearKey] = ['text' => $yearText];
                        }
                    }
                }

                $lText = trim((string) ($lIn['text'] ?? ''));
                if ($lText === '' && $byYearOut !== []) {
                    $lText = collect($byYearOut)->pluck('text')->filter()->implode("\n\n");
                }

                $lFile = $this->pickKeyedUploadedFile($qualFiles, (int) $indicator->id);
                $lUrl = null;
                if ($lFile && $lFile->isValid()) {
                    $prevL = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['qualitative'] ?? null) : null;
                    $prevLUrl = is_array($prevL) ? ($prevL['attachment_url'] ?? null) : null;
                    if (is_string($prevLUrl) && $prevLUrl !== '') {
                        $this->deletePublicDiskFileByUrl($prevLUrl);
                    }
                    $path = $lFile->store('department-tasks/'.$departmentTask->id.'/qual', 'public');
                    $lUrl = Storage::disk('public')->url($path);
                } elseif (in_array((int) $indicator->id, $stripQualIds, true)) {
                    $prevL = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['qualitative'] ?? null) : null;
                    $prevLUrl = is_array($prevL) ? ($prevL['attachment_url'] ?? null) : null;
                    if (is_string($prevLUrl) && $prevLUrl !== '') {
                        $this->deletePublicDiskFileByUrl($prevLUrl);
                    }
                    $lUrl = null;
                } else {
                    $prevL = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['qualitative'] ?? null) : null;
                    $lUrl = is_array($prevL) ? ($prevL['attachment_url'] ?? null) : null;
                }
                if ($byYearOut === [] && $lText === '' && ($lUrl === null || $lUrl === '')) {
                    return response()->json(['message' => 'Indicator '.$indicator->id.': add a written response and/or attach a file.'], 422);
                }
                $row['qualitative'] = [
                    'text' => $lText !== '' ? $lText : null,
                    'attachment_url' => $lUrl,
                    'by_year' => $byYearOut !== [] ? $byYearOut : null,
                ];
            } else {
                $row['qualitative'] = null;
            }

            $outBy[$idKey] = $row;
        }

        if ($outBy === []) {
            return response()->json(['message' => 'No indicators on this issue require departmental input.'], 422);
        }

        $payload = [
            'format' => self::DEPARTMENT_INDICATOR_FORMAT,
            'by_indicator' => $outBy,
        ];

        $challengesRaw = $decoded['challenges'] ?? null;
        if (is_string($challengesRaw)) {
            $challenges = trim($challengesRaw);
            if ($challenges !== '') {
                $payload['challenges'] = $challenges;
            }
        }

        if ($wasResubmit) {
            app(ResponseRevisionRecorder::class)->snapshotDepartmentTask($departmentTask, $request->user());
        }

        $this->persistDepartmentTask($departmentTask, [
            'response_data' => json_encode($payload, JSON_UNESCAPED_SLASHES),
            'attachment_url' => null,
            'submission_date' => now()->toDateString(),
            'status' => 'submitted',
            'regional_review_status' => null,
            'regional_review_comments' => null,
            'pending_revision_origin' => null,
        ]);

        $fresh = $departmentTask->fresh(['region', 'department', 'hrRequest']);
        app(NotificationService::class)->notifyDepartmentTaskSubmitted($fresh, $request->user(), $wasResubmit);

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($fresh, $redact),
        ]);
    }

    public function submitResponse(Request $request, DepartmentTask $departmentTask): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('department_admin') && ! $user->hasRole('viewer')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($user->department_id === null || (int) $user->department_id !== (int) $departmentTask->department_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($user->region_id !== null && (int) $user->region_id !== (int) $departmentTask->region_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $maySubmit =
            $departmentTask->status === 'assigned'
            || (
                $departmentTask->status === 'submitted'
                && $departmentTask->regional_review_status === 'needs-modification'
            );
        if (! $maySubmit) {
            return response()->json(['message' => 'This task cannot accept a submission in its current state.'], 422);
        }

        $departmentTask->load(['hrRequest.issue.indicators', 'hrRequest.indicatorResponses']);

        if ($this->departmentTaskUsesIndicatorBundles($departmentTask->hrRequest)) {
            return $this->submitIndicatorBundleDepartmentTaskResponse($request, $departmentTask);
        }

        return $this->submitLegacyDepartmentTaskResponse($request, $departmentTask);
    }

    public function updateReview(Request $request, DepartmentTask $departmentTask): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('regional_admin') && ! $user->hasRole('federal_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($user->hasRole('regional_admin')) {
            if ($user->region_id === null || (int) $user->region_id !== (int) $departmentTask->region_id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $hasResponse = $departmentTask->submission_date !== null || $departmentTask->status === 'submitted';
        if (! $hasResponse) {
            return response()->json(['message' => 'This task has no departmental response yet.'], 422);
        }

        $data = $request->validate([
            'regional_review_status' => ['required', 'in:accepted,needs-modification'],
            'regional_review_comments' => ['nullable', 'string', 'max:20000'],
            'revision_origin' => ['nullable', 'in:federal_follow_up,regional'],
        ]);

        $pendingOrigin = null;
        if ($data['regional_review_status'] === 'needs-modification') {
            $pendingOrigin = $data['revision_origin']
                ?? app(ResponseRevisionRecorder::class)->inferOriginFromRegionalResponse($departmentTask);
        }

        $this->persistDepartmentTask($departmentTask, [
            'regional_review_status' => $data['regional_review_status'],
            'regional_review_comments' => $data['regional_review_comments'] ?? null,
            'pending_revision_origin' => $pendingOrigin,
        ]);

        $fresh = $departmentTask->fresh(['region', 'department', 'hrRequest']);
        if ($data['regional_review_status'] === 'needs-modification') {
            app(NotificationService::class)->notifyDepartmentTaskNeedsModification($fresh, $request->user());
        }

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($fresh, $redact),
        ]);
    }

    public function revisions(Request $request, DepartmentTask $departmentTask): JsonResponse
    {
        $user = $request->user();
        if (! $this->userMayViewDepartmentTask($user, $departmentTask)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($user);
        $federalAudience = $request->query('audience') === 'federal'
            || $request->boolean('federal_only');

        // Federal portal must not see region-only department revision rounds.
        if ($federalAudience && ! (HrimsAccess::isSuperAdmin($user) || $user->hasRole('federal_admin'))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = $departmentTask->revisions()->with('submittedBy:id,name,username');
        if ($federalAudience) {
            $query->where('revision_origin', ResponseRevisionRecorder::ORIGIN_FEDERAL_FOLLOW_UP);
        }

        $revisions = $query
            ->orderByDesc('revision_no')
            ->get()
            ->map(function ($rev) use ($redact) {
                return [
                    'id' => $rev->id,
                    'revision_no' => $rev->revision_no,
                    'response_data' => $redact ? null : $rev->response_data,
                    'attachment_url' => $redact ? null : $rev->attachment_url,
                    'regional_review_status' => $rev->regional_review_status,
                    'regional_review_comments' => $rev->regional_review_comments,
                    'revision_origin' => $rev->revision_origin,
                    'submitted_by_name' => $rev->submittedBy?->name ?: $rev->submittedBy?->username,
                    'created_at' => optional($rev->created_at)?->toIso8601String(),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'data' => [
                'current' => [
                    'response_data' => $redact ? null : $departmentTask->response_data,
                    'attachment_url' => $redact ? null : $departmentTask->attachment_url,
                    'regional_review_status' => $departmentTask->regional_review_status,
                    'regional_review_comments' => $departmentTask->regional_review_comments,
                    'updated_at' => optional($departmentTask->updated_at)?->toIso8601String(),
                ],
                'revisions' => $revisions,
            ],
        ]);
    }

    private function userMayViewDepartmentTask($user, DepartmentTask $departmentTask): bool
    {
        if (! $user) {
            return false;
        }
        if (HrimsAccess::isSuperAdmin($user) || $user->hasRole('federal_admin')) {
            return true;
        }
        if ($user->hasRole('regional_admin') && $user->region_id !== null) {
            return (int) $user->region_id === (int) $departmentTask->region_id;
        }
        if (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            if ((int) $user->department_id !== (int) $departmentTask->department_id) {
                return false;
            }
            if ($user->region_id !== null && (int) $user->region_id !== (int) $departmentTask->region_id) {
                return false;
            }

            return true;
        }

        return false;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = DepartmentTask::query()->with(['region', 'department']);

        // Governance / national dashboards: federal sees all regions (same as super admin).
        $nationalScope = $request->boolean('national')
            || $request->query('scope') === 'all'
            || $request->query('scope') === 'national';

        // Super admin sees all tasks
        if (HrimsAccess::isSuperAdmin($user)) {
            // no filter
        }
        // Federal admin: ICT/Federal line by default; all regions when national scope requested
        elseif ($user->hasRole('federal_admin')) {
            if (! $nationalScope) {
                $query->whereHas('region', fn ($q) => $q->whereIn('slug', ['ict', 'federal']));
            }
        }
        // Department admin/viewer see only their department tasks
        elseif (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $query->where('department_id', $user->department_id);
            if ($user->region_id) {
                $query->where('region_id', $user->region_id);
            }
        }
        // Regional admin sees tasks for their region only
        else {
            $regionIds = HrimsAccess::scopedRegionIds($user);
            if ($regionIds !== null) {
                $query->whereIn('region_id', $regionIds);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $rows = $query->orderByDesc('assigned_date')->orderByDesc('id')->get();
        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($user);

        return response()->json([
            'data' => $rows->map(fn (DepartmentTask $t) => $this->serializeTask($t, $redact)),
        ]);
    }

    /**
     * Skip columns that exist in code but have not been migrated on this database.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function persistDepartmentTask(DepartmentTask $departmentTask, array $attributes): void
    {
        if (
            array_key_exists('pending_revision_origin', $attributes)
            && ! Schema::hasColumn('department_tasks', 'pending_revision_origin')
        ) {
            unset($attributes['pending_revision_origin']);
        }

        $departmentTask->update($attributes);
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
}
