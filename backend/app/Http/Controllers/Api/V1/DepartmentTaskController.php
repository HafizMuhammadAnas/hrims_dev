<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\IssueIndicator;
use App\Support\HrimsAccess;
use App\Support\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Http\UploadedFile;

class DepartmentTaskController extends Controller
{
    private const DEPARTMENT_INDICATOR_FORMAT = 'department_indicator_v1';

    /**
     * @return array<string, mixed>
     */
    private function serializeTask(DepartmentTask $t, bool $redact): array
    {
        $t->loadMissing(['region', 'department']);

        return [
            'id' => $t->id,
            'req_id' => $t->hr_request_id,
            'region_id' => $t->region_id,
            'region_name' => $t->region?->name,
            'department_id' => $t->department?->code ?? (string) $t->department_id,
            'department_name' => $t->department?->name,
            'status' => $t->status,
            'regional_review_status' => $t->regional_review_status,
            'regional_review_comments' => $t->regional_review_comments,
            'assigned_date' => $t->assigned_date->format('Y-m-d'),
            'assignment_instructions' => $redact ? null : $t->assignment_instructions,
            'submission_date' => $t->submission_date?->format('Y-m-d'),
            'response_data' => $redact ? null : $t->response_data,
            'attachment_url' => $redact ? null : $t->attachment_url,
        ];
    }

    public function store(Request $request): JsonResponse
    {
        if (! HrimsAccess::canManageHrRequests($request->user())) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'hr_request_id' => ['required', 'string', 'exists:hr_requests,id'],
            'department_id' => ['required', 'integer', 'exists:departments,id'],
            'assignment_instructions' => ['nullable', 'string', 'max:20000'],
        ]);

        $hrRequest = HrRequest::query()->find($data['hr_request_id']);
        if (! $hrRequest || $hrRequest->region_id === null) {
            return response()->json(['message' => 'Request has no region assignment'], 422);
        }

        $regionIds = HrimsAccess::scopedRegionIds($request->user());
        if ($regionIds !== null && ! in_array((int) $hrRequest->region_id, $regionIds, true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $department = Department::query()->with('regions')->find($data['department_id']);
        $reqRegionId = (int) $hrRequest->region_id;
        if (! $department || ! $department->regions->pluck('id')->contains($reqRegionId)) {
            return response()->json(['message' => 'Department must be linked to the same region as the request.'], 422);
        }

        $dup = DepartmentTask::query()
            ->where('hr_request_id', $hrRequest->id)
            ->where('department_id', $data['department_id'])
            ->where('region_id', $hrRequest->region_id)
            ->exists();
        if ($dup) {
            return response()->json(['message' => 'This department is already assigned to the request'], 422);
        }

        $instructions = isset($data['assignment_instructions']) ? trim((string) $data['assignment_instructions']) : '';
        $task = DepartmentTask::query()->create([
            'id' => 'TSK-'.strtoupper(Str::random(10)),
            'hr_request_id' => $hrRequest->id,
            'region_id' => $hrRequest->region_id,
            'department_id' => $data['department_id'],
            'status' => 'assigned',
            'assigned_date' => now()->toDateString(),
            'assignment_instructions' => $instructions !== '' ? $instructions : null,
        ]);

        if ($hrRequest->status === 'draft') {
            $hrRequest->update(['status' => 'active']);
            app(NotificationService::class)->notifyHrRequestUpdated($hrRequest->fresh(['regions', 'departments']), $request->user(), 'draft');
        }

        $task->load(['region', 'department']);
        app(NotificationService::class)->notifyDepartmentTaskAssigned($task, $request->user());
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

    private function departmentTaskUsesIndicatorBundles(?HrRequest $hrRequest): bool
    {
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
        $data = $request->validate([
            'response_data' => ['nullable', 'string', 'max:200000'],
            'attachment' => ['nullable', 'file', 'max:15360'],
        ]);

        $text = trim($data['response_data'] ?? '');
        if ($text === '' && ! $request->hasFile('attachment')) {
            return response()->json(['message' => 'Provide a written response and/or an attachment.'], 422);
        }

        $attachmentUrl = $departmentTask->attachment_url;
        if ($request->hasFile('attachment')) {
            $file = $request->file('attachment');
            if ($file && $file->isValid()) {
                $path = $file->store('department-tasks/'.$departmentTask->id, 'public');
                $attachmentUrl = Storage::disk('public')->url($path);
            }
        }

        $departmentTask->update([
            'response_data' => $text !== '' ? $text : $departmentTask->response_data,
            'attachment_url' => $attachmentUrl,
            'submission_date' => now()->toDateString(),
            'status' => 'submitted',
            'regional_review_status' => null,
            'regional_review_comments' => null,
        ]);

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($departmentTask->fresh(['region', 'department']), $redact),
        ]);
    }

    private function submitIndicatorBundleDepartmentTaskResponse(Request $request, DepartmentTask $departmentTask): JsonResponse
    {
        $hrRequest = $departmentTask->hrRequest;
        $issue = $hrRequest?->issue;
        if (! $issue) {
            return response()->json(['message' => 'Request has no issue for indicator responses.'], 422);
        }
        $hrRequest->loadMissing('indicatorResponses');
        $issue->loadMissing('indicators');
        $selectedIds = $hrRequest->indicatorResponses->pluck('issue_indicator_id')->map(fn ($id) => (int) $id)->all();

        $validated = $request->validate([
            'indicator_bundles' => ['required', 'string', 'max:500000'],
            'quant_file' => ['nullable', 'array'],
            'quant_file.*' => ['nullable', 'file', 'max:15360'],
            'qual_file' => ['nullable', 'array'],
            'qual_file.*' => ['nullable', 'file', 'max:15360'],
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

        $outBy = [];

        $scopedIndicators = $issue->indicators->filter(function (IssueIndicator $indicator) use ($issue, $selectedIds) {
            $flags = $issue->effectiveIndicatorFlags($indicator);
            if (! $flags['has_quantitative'] && ! $flags['has_qualitative']) {
                return false;
            }
            if ($selectedIds !== []) {
                return in_array((int) $indicator->id, $selectedIds, true);
            }

            return true;
        });

        foreach ($scopedIndicators as $indicator) {
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

            if ($flags['has_quantitative']) {
                $qIn = $entry['quantitative'] ?? null;
                if (! is_array($qIn)) {
                    return response()->json(['message' => 'Indicator '.$indicator->id.': quantitative fields are required.'], 422);
                }
                $valRaw = $qIn['value'] ?? null;
                if ($valRaw === null || trim((string) $valRaw) === '') {
                    return response()->json(['message' => 'Indicator '.$indicator->id.': a number is required.'], 422);
                }
                if (! is_numeric($valRaw)) {
                    return response()->json(['message' => 'Indicator '.$indicator->id.': the number must be numeric.'], 422);
                }
                $comment = trim((string) ($qIn['comment'] ?? ''));
                $qFile = $this->pickKeyedUploadedFile($quantFiles, (int) $indicator->id);
                $qUrl = null;
                if ($qFile && $qFile->isValid()) {
                    $path = $qFile->store('department-tasks/'.$departmentTask->id.'/quant', 'public');
                    $qUrl = Storage::disk('public')->url($path);
                } else {
                    $prevQ = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['quantitative'] ?? null) : null;
                    $qUrl = is_array($prevQ) ? ($prevQ['attachment_url'] ?? null) : null;
                }
                $row['quantitative'] = [
                    'value' => (float) $valRaw,
                    'comment' => $comment !== '' ? $comment : null,
                    'attachment_url' => $qUrl,
                ];
            } else {
                $row['quantitative'] = null;
            }

            if ($flags['has_qualitative']) {
                $lIn = $entry['qualitative'] ?? null;
                if (! is_array($lIn)) {
                    return response()->json(['message' => 'Indicator '.$indicator->id.': qualitative fields are required.'], 422);
                }
                $lText = trim((string) ($lIn['text'] ?? ''));
                $lFile = $this->pickKeyedUploadedFile($qualFiles, (int) $indicator->id);
                $lUrl = null;
                if ($lFile && $lFile->isValid()) {
                    $path = $lFile->store('department-tasks/'.$departmentTask->id.'/qual', 'public');
                    $lUrl = Storage::disk('public')->url($path);
                } else {
                    $prevL = is_array($prevBy[$idKey] ?? null) ? ($prevBy[$idKey]['qualitative'] ?? null) : null;
                    $lUrl = is_array($prevL) ? ($prevL['attachment_url'] ?? null) : null;
                }
                if ($lText === '' && ($lUrl === null || $lUrl === '')) {
                    return response()->json(['message' => 'Indicator '.$indicator->id.': add a written response and/or attach a file.'], 422);
                }
                $row['qualitative'] = [
                    'text' => $lText !== '' ? $lText : null,
                    'attachment_url' => $lUrl,
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

        $departmentTask->update([
            'response_data' => json_encode($payload, JSON_UNESCAPED_SLASHES),
            'attachment_url' => null,
            'submission_date' => now()->toDateString(),
            'status' => 'submitted',
            'regional_review_status' => null,
            'regional_review_comments' => null,
        ]);

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($departmentTask->fresh(['region', 'department']), $redact),
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
        ]);

        $departmentTask->update([
            'regional_review_status' => $data['regional_review_status'],
            'regional_review_comments' => $data['regional_review_comments'] ?? null,
        ]);

        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($request->user());

        return response()->json([
            'data' => $this->serializeTask($departmentTask->fresh(['region', 'department']), $redact),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = DepartmentTask::query()->with(['region', 'department']);

        if (HrimsAccess::seesAllRegions($user)) {
            // no filter
        } elseif (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $query->where('department_id', $user->department_id);
            if ($user->region_id) {
                $query->where('region_id', $user->region_id);
            }
        } else {
            $regionIds = HrimsAccess::scopedRegionIds($user);
            if ($regionIds !== null) {
                $query->whereIn('region_id', $regionIds);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $rows = $query->orderByDesc('assigned_date')->get();
        $redact = HrimsAccess::redactDepartmentTaskPayloadFor($user);

        return response()->json([
            'data' => $rows->map(fn (DepartmentTask $t) => $this->serializeTask($t, $redact)),
        ]);
    }
}
