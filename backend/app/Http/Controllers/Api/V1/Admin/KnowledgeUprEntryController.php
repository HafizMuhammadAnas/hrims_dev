<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\KnowledgeUprEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class KnowledgeUprEntryController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = KnowledgeUprEntry::query()
            ->with(['cycle:id,name', 'type:id,name'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (KnowledgeUprEntry $row) => $this->serialize($row)),
        ]);
    }

    public function show(KnowledgeUprEntry $knowledgeUprEntry): JsonResponse
    {
        $knowledgeUprEntry->load(['cycle:id,name', 'type:id,name']);

        return response()->json(['data' => $this->serialize($knowledgeUprEntry)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, false);
        $row = KnowledgeUprEntry::query()->create($data);
        $row->load(['cycle:id,name', 'type:id,name']);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, KnowledgeUprEntry $knowledgeUprEntry): JsonResponse
    {
        $data = $this->validatePayload($request, true);
        $knowledgeUprEntry->fill($data);
        $knowledgeUprEntry->save();
        $knowledgeUprEntry->load(['cycle:id,name', 'type:id,name']);

        return response()->json(['data' => $this->serialize($knowledgeUprEntry->fresh(['cycle:id,name', 'type:id,name']))]);
    }

    public function destroy(KnowledgeUprEntry $knowledgeUprEntry): JsonResponse
    {
        $knowledgeUprEntry->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function uploadFiles(Request $request): JsonResponse
    {
        // JSON/base64 path: FortiGate often blocks multipart HTML (and some binary) uploads.
        if ($request->has('files_base64') || (is_array($request->input('files')) && ! $request->hasFile('files'))) {
            return $this->uploadFilesFromBase64($request);
        }

        $request->validate([
            'knowledge_upr_entry_id' => ['nullable', 'integer', 'exists:knowledge_upr_entries,id'],
            'purpose' => ['required', 'string', Rule::in(['repository', 'analysis'])],
            'files' => ['required'],
            'files.*' => ['file', 'max:51200'],
        ]);

        $purpose = (string) $request->input('purpose');
        $uploaded = $request->file('files');
        if ($uploaded === null) {
            $all = $request->allFiles();
            $uploaded = $all['files'] ?? null;
        }
        if ($uploaded === null) {
            return response()->json(['message' => 'No files were uploaded.'], 422);
        }
        $fileList = is_array($uploaded) ? array_values($uploaded) : [$uploaded];

        $allowed = $this->allowedExtensionsForPurpose($purpose);
        $folder = $this->storageFolder($request, $purpose);

        try {
            Storage::disk('public')->makeDirectory($folder);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Storage is not writable. On the server run: php artisan storage:link && chmod -R ug+rwx storage bootstrap/cache',
            ], 500);
        }

        $documents = [];
        foreach ($fileList as $file) {
            if ($file === null || ! $file->isValid()) {
                continue;
            }
            $original = $file->getClientOriginalName();
            $ext = $this->resolveExtension($original, (string) $file->getClientOriginalExtension());
            if (! in_array($ext, $allowed, true)) {
                return response()->json([
                    'message' => $this->rejectedExtensionMessage($purpose, $original),
                ], 422);
            }
            try {
                $path = $file->storeAs($folder, Str::uuid()->toString().'.'.$ext, 'public');
            } catch (\Throwable $e) {
                report($e);

                return response()->json([
                    'message' => 'Could not store uploaded file. Check storage/app/public permissions on the server.',
                ], 500);
            }
            if (! is_string($path) || $path === '') {
                return response()->json(['message' => 'Could not store uploaded file.'], 500);
            }
            $documents[] = $this->documentPayload($original, $ext, $path);
        }

        if ($documents === []) {
            return response()->json(['message' => 'No valid files were uploaded.'], 422);
        }

        return response()->json(['data' => $documents], 201);
    }

    /**
     * Accept JSON body with base64 file payloads (WAF-safe alternative to multipart).
     */
    private function uploadFilesFromBase64(Request $request): JsonResponse
    {
        $data = $request->validate([
            'knowledge_upr_entry_id' => ['nullable', 'integer', 'exists:knowledge_upr_entries,id'],
            'purpose' => ['required', 'string', Rule::in(['repository', 'analysis'])],
            'files_base64' => ['required', 'array', 'min:1'],
            'files_base64.*.name' => ['required', 'string', 'max:255'],
            'files_base64.*.content_base64' => ['required', 'string'],
        ]);

        $purpose = (string) $data['purpose'];
        $allowed = $this->allowedExtensionsForPurpose($purpose);
        $folder = $this->storageFolder($request, $purpose);

        try {
            Storage::disk('public')->makeDirectory($folder);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'Storage is not writable. On the server run: php artisan storage:link && chmod -R ug+rwx storage bootstrap/cache',
            ], 500);
        }

        $documents = [];
        foreach ($data['files_base64'] as $item) {
            $original = basename((string) $item['name']);
            $ext = $this->resolveExtension($original, strtolower((string) pathinfo($original, PATHINFO_EXTENSION)));
            if (! in_array($ext, $allowed, true)) {
                return response()->json([
                    'message' => $this->rejectedExtensionMessage($purpose, $original),
                ], 422);
            }

            $raw = (string) $item['content_base64'];
            if (str_contains($raw, ',')) {
                $raw = explode(',', $raw, 2)[1] ?? '';
            }
            $binary = base64_decode($raw, true);
            if ($binary === false || $binary === '') {
                return response()->json(['message' => 'Invalid file data for: '.$original], 422);
            }
            // ~50 MB decoded limit (matches multipart max:51200 KB).
            if (strlen($binary) > 51200 * 1024) {
                return response()->json(['message' => 'File too large: '.$original], 422);
            }

            $path = $folder.'/'.Str::uuid()->toString().'.'.$ext;
            try {
                $ok = Storage::disk('public')->put($path, $binary);
            } catch (\Throwable $e) {
                report($e);

                return response()->json([
                    'message' => 'Could not store uploaded file. Check storage/app/public permissions on the server.',
                ], 500);
            }
            if (! $ok) {
                return response()->json(['message' => 'Could not store uploaded file: '.$original], 500);
            }
            $documents[] = $this->documentPayload($original, $ext, $path);
        }

        return response()->json(['data' => $documents], 201);
    }

    /**
     * @return list<string>
     */
    private function allowedExtensionsForPurpose(string $purpose): array
    {
        return $purpose === 'analysis'
            ? ['html', 'htm']
            : ['pdf', 'doc', 'docx'];
    }

    private function storageFolder(Request $request, string $purpose): string
    {
        $folder = 'knowledge-upr-repositories';
        if ($request->filled('knowledge_upr_entry_id')) {
            $folder .= '/'.$request->integer('knowledge_upr_entry_id');
        }

        return $folder.'/'.$purpose;
    }

    private function resolveExtension(string $originalName, string $ext): string
    {
        $ext = strtolower(trim($ext));
        if ($ext !== '') {
            return $ext;
        }

        return strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
    }

    private function rejectedExtensionMessage(string $purpose, string $original): string
    {
        return $purpose === 'analysis'
            ? 'Only HTML files are allowed for Analysis. Rejected: '.$original
            : 'Only PDF, DOC, and DOCX files are allowed. Rejected: '.$original;
    }

    /**
     * @return array{id: string, title: string, href: string, type_label: string, icon: string, file_name: string, path: string}
     */
    private function documentPayload(string $original, string $ext, string $path): array
    {
        return [
            'id' => (string) Str::uuid(),
            'title' => pathinfo($original, PATHINFO_FILENAME) ?: $original,
            'href' => ConventionController::repositoryFileDownloadUrl($path),
            'type_label' => $this->typeLabel($ext),
            'icon' => $this->icon($ext),
            'file_name' => $original,
            'path' => $path,
        ];
    }

    public function deleteFile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['nullable', 'string', 'max:500'],
            'token' => ['nullable', 'string', 'max:1000'],
            'knowledge_upr_entry_id' => ['nullable', 'integer', 'exists:knowledge_upr_entries,id'],
            'document_id' => ['nullable', 'string', 'max:100'],
            'href' => ['nullable', 'string', 'max:2000'],
        ]);

        $path = null;
        if (! empty($data['path'])) {
            $candidate = str_replace('\\', '/', (string) $data['path']);
            if (str_starts_with($candidate, 'knowledge-upr-repositories/') && ! str_contains($candidate, '..')) {
                $path = $candidate;
            }
        } elseif (! empty($data['token'])) {
            $path = ConventionController::decodeRepositoryFileToken((string) $data['token']);
        }

        if ($path === null || ! str_starts_with($path, 'knowledge-upr-repositories/')) {
            return response()->json(['message' => 'Invalid file path.'], 422);
        }

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        // Keep Knowledge Hub in sync: drop the document from the saved entry JSON.
        if (! empty($data['knowledge_upr_entry_id'])) {
            $entry = KnowledgeUprEntry::query()->find((int) $data['knowledge_upr_entry_id']);
            if ($entry) {
                $entry->removeAttachedDocument(
                    path: $path,
                    documentId: isset($data['document_id']) ? (string) $data['document_id'] : null,
                    href: isset($data['href']) ? (string) $data['href'] : null,
                );
            }
        }

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, bool $partial): array
    {
        $data = $request->validate([
            'upr_type_id' => ['sometimes', 'nullable', 'integer', 'exists:upr_types,id'],
            'kind' => ['sometimes', 'nullable', 'string', 'max:64'],
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'upr_cycle_id' => [$partial ? 'sometimes' : 'required', 'nullable', 'integer', 'exists:upr_cycles,id'],
            'introduction' => ['sometimes', 'nullable', 'string'],
            'repositories' => ['sometimes', 'nullable', 'array'],
            'analysis_files' => ['sometimes', 'nullable', 'array'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // Knowledge Hub entries are cycle-based; type is optional/legacy.
        if (! $partial && ! array_key_exists('upr_type_id', $data)) {
            $data['upr_type_id'] = null;
        }
        if (! $partial && empty($data['kind'])) {
            $data['kind'] = 'upr';
        }

        if (array_key_exists('upr_type_id', $data) && $data['upr_type_id'] !== null) {
            $typeName = DB::table('upr_types')->where('id', (int) $data['upr_type_id'])->value('name');
            if (is_string($typeName) && $typeName !== '') {
                $data['kind'] = strtolower($typeName);
            }
        }

        if (array_key_exists('repositories', $data)) {
            $data['repositories'] = KnowledgeUprEntry::normalizeRepositories($data['repositories']);
        }
        if (array_key_exists('analysis_files', $data)) {
            $data['analysis_files'] = KnowledgeUprEntry::normalizeAnalysisFiles($data['analysis_files']);
        }
        if (array_key_exists('title', $data) && $data['title'] === '') {
            $data['title'] = null;
        }
        if (array_key_exists('introduction', $data) && $data['introduction'] === '') {
            $data['introduction'] = null;
        }

        return $data;
    }

    private function typeLabel(string $ext): string
    {
        return match ($ext) {
            'pdf' => 'PDF document',
            'doc', 'docx' => 'Word document',
            'html', 'htm' => 'HTML document',
            default => 'Document',
        };
    }

    private function icon(string $ext): string
    {
        return match ($ext) {
            'pdf' => '📄',
            'doc', 'docx' => '📝',
            'html', 'htm' => '🌐',
            default => '📎',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(KnowledgeUprEntry $row): array
    {
        return [
            'id' => $row->id,
            'kind' => $row->kind,
            'upr_type_id' => $row->upr_type_id !== null ? (int) $row->upr_type_id : null,
            'type' => $row->relationLoaded('type') && $row->type ? [
                'id' => $row->type->id,
                'name' => $row->type->name,
            ] : null,
            'title' => $row->title,
            'display_title' => $row->displayTitle(),
            'upr_cycle_id' => $row->upr_cycle_id !== null ? (int) $row->upr_cycle_id : null,
            'cycle' => $row->relationLoaded('cycle') && $row->cycle ? [
                'id' => $row->cycle->id,
                'name' => $row->cycle->name,
            ] : null,
            'introduction' => $row->introduction,
            'repositories' => KnowledgeUprEntry::normalizeRepositories($row->repositories),
            'repository_labels' => KnowledgeUprEntry::REPOSITORY_LABELS,
            'analysis_files' => KnowledgeUprEntry::normalizeAnalysisFiles($row->analysis_files),
            'sort_order' => (int) ($row->sort_order ?? 0),
            'is_active' => (bool) ($row->is_active ?? true),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }
}
