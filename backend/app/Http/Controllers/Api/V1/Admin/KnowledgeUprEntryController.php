<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\KnowledgeUprEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class KnowledgeUprEntryController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = KnowledgeUprEntry::query()
            ->with(['cycle:id,name,upr_type_id'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (KnowledgeUprEntry $row) => $this->serialize($row)),
        ]);
    }

    public function show(KnowledgeUprEntry $knowledgeUprEntry): JsonResponse
    {
        $knowledgeUprEntry->load(['cycle:id,name,upr_type_id']);

        return response()->json(['data' => $this->serialize($knowledgeUprEntry)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, false);
        $row = KnowledgeUprEntry::query()->create($data);
        $row->load(['cycle:id,name,upr_type_id']);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, KnowledgeUprEntry $knowledgeUprEntry): JsonResponse
    {
        $data = $this->validatePayload($request, true);
        $knowledgeUprEntry->fill($data);
        $knowledgeUprEntry->save();
        $knowledgeUprEntry->load(['cycle:id,name,upr_type_id']);

        return response()->json(['data' => $this->serialize($knowledgeUprEntry->fresh(['cycle:id,name,upr_type_id']))]);
    }

    public function destroy(KnowledgeUprEntry $knowledgeUprEntry): JsonResponse
    {
        $knowledgeUprEntry->delete();

        return response()->json(['message' => 'Deleted']);
    }

    public function uploadFiles(Request $request): JsonResponse
    {
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

        $allowed = $purpose === 'analysis'
            ? ['html', 'htm']
            : ['pdf', 'doc', 'docx'];

        $folder = 'knowledge-upr-repositories';
        if ($request->filled('knowledge_upr_entry_id')) {
            $folder .= '/'.$request->integer('knowledge_upr_entry_id');
        }
        $folder .= '/'.$purpose;

        $documents = [];
        foreach ($fileList as $file) {
            if ($file === null || ! $file->isValid()) {
                continue;
            }
            $ext = strtolower((string) $file->getClientOriginalExtension());
            if (! in_array($ext, $allowed, true)) {
                return response()->json([
                    'message' => $purpose === 'analysis'
                        ? 'Only HTML files are allowed for Analysis. Rejected: '.$file->getClientOriginalName()
                        : 'Only PDF, DOC, and DOCX files are allowed. Rejected: '.$file->getClientOriginalName(),
                ], 422);
            }
            $original = $file->getClientOriginalName();
            $path = $file->store($folder, 'public');
            if (! is_string($path) || $path === '') {
                return response()->json(['message' => 'Could not store uploaded file.'], 500);
            }
            $documents[] = [
                'id' => (string) Str::uuid(),
                'title' => pathinfo($original, PATHINFO_FILENAME) ?: $original,
                'href' => ConventionController::repositoryFileDownloadUrl($path),
                'type_label' => $this->typeLabel($ext),
                'icon' => $this->icon($ext),
                'file_name' => $original,
                'path' => $path,
            ];
        }

        if ($documents === []) {
            return response()->json(['message' => 'No valid files were uploaded.'], 422);
        }

        return response()->json(['data' => $documents], 201);
    }

    public function deleteFile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['nullable', 'string', 'max:500'],
            'token' => ['nullable', 'string', 'max:1000'],
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

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, bool $partial): array
    {
        $req = $partial ? 'sometimes' : 'required';

        $data = $request->validate([
            'kind' => [$req, 'string', Rule::in([
                KnowledgeUprEntry::KIND_SUPPORTED,
                KnowledgeUprEntry::KIND_NOTED,
                KnowledgeUprEntry::KIND_OTHERS,
            ])],
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'upr_cycle_id' => [$partial ? 'sometimes' : 'required', 'nullable', 'integer', 'exists:upr_cycles,id'],
            'introduction' => ['sometimes', 'nullable', 'string'],
            'repositories' => ['sometimes', 'nullable', 'array'],
            'analysis_files' => ['sometimes', 'nullable', 'array'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

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
            'title' => $row->title,
            'display_title' => $row->displayTitle(),
            'upr_cycle_id' => $row->upr_cycle_id !== null ? (int) $row->upr_cycle_id : null,
            'cycle' => $row->relationLoaded('cycle') && $row->cycle ? [
                'id' => $row->cycle->id,
                'name' => $row->cycle->name,
                'upr_type_id' => $row->cycle->upr_type_id !== null ? (int) $row->cycle->upr_type_id : null,
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
