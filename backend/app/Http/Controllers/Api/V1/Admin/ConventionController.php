<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Convention;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConventionController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Convention::query()->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['data' => $rows->map(fn (Convention $c) => $this->serialize($c))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:64', 'unique:conventions,code'],
            'name' => ['required', 'string', 'max:255'],
            'knowledge_icon' => ['nullable', 'string', 'max:32'],
            'knowledge_adopted' => ['nullable', 'string', 'max:64'],
            'knowledge_ratified' => ['nullable', 'string', 'max:64'],
            'knowledge_articles' => ['nullable', 'string', 'max:64'],
            'knowledge_implementation' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            'repositories' => ['nullable', 'array'],
            'optional_protocol_body' => ['nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('repositories', $data)) {
            $data['repositories'] = Convention::normalizeRepositories($data['repositories']);
        }

        $row = Convention::query()->create($data);

        return response()->json(['data' => $this->serialize($row)], 201);
    }

    public function update(Request $request, Convention $convention): JsonResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:64', Rule::unique('conventions', 'code')->ignore($convention->id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'knowledge_icon' => ['sometimes', 'nullable', 'string', 'max:32'],
            'knowledge_adopted' => ['sometimes', 'nullable', 'string', 'max:64'],
            'knowledge_ratified' => ['sometimes', 'nullable', 'string', 'max:64'],
            'knowledge_articles' => ['sometimes', 'nullable', 'string', 'max:64'],
            'knowledge_implementation' => ['sometimes', 'nullable', 'string', 'max:64'],
            'description' => ['sometimes', 'nullable', 'string'],
            'repositories' => ['sometimes', 'nullable', 'array'],
            'optional_protocol_body' => ['sometimes', 'nullable', 'string'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('repositories', $data)) {
            $data['repositories'] = Convention::normalizeRepositories($data['repositories']);
        }
        $convention->fill($data);
        $convention->save();

        return response()->json(['data' => $this->serialize($convention->fresh())]);
    }

    public function destroy(Convention $convention): JsonResponse
    {
        $convention->delete();

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Upload PDF/DOC/DOCX files for convention repository cycles (metadata saved with the convention JSON).
     */
    public function uploadRepositoryFiles(Request $request): JsonResponse
    {
        $request->validate([
            'convention_id' => ['nullable', 'integer', 'exists:conventions,id'],
            'files' => ['required'],
            'files.*' => ['file', 'max:51200'],
        ]);

        $uploaded = $request->file('files');
        if ($uploaded === null) {
            $all = $request->allFiles();
            $uploaded = $all['files'] ?? null;
        }
        if ($uploaded === null) {
            return response()->json(['message' => 'No files were uploaded.'], 422);
        }
        $fileList = is_array($uploaded) ? array_values($uploaded) : [$uploaded];

        $allowed = ['pdf', 'doc', 'docx'];
        $folder = 'convention-repositories';
        if ($request->filled('convention_id')) {
            $folder .= '/'.$request->integer('convention_id');
        }

        $documents = [];
        foreach ($fileList as $file) {
            if ($file === null || ! $file->isValid()) {
                continue;
            }
            $ext = strtolower((string) $file->getClientOriginalExtension());
            if (! in_array($ext, $allowed, true)) {
                return response()->json([
                    'message' => 'Only PDF, DOC, and DOCX files are allowed. Rejected: '.$file->getClientOriginalName(),
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
                'href' => self::repositoryFileDownloadUrl($path),
                'type_label' => self::repositoryTypeLabel($ext),
                'icon' => self::repositoryIcon($ext),
                'file_name' => $original,
                'path' => $path,
            ];
        }

        if ($documents === []) {
            return response()->json(['message' => 'No valid files were uploaded.'], 422);
        }

        return response()->json(['data' => $documents], 201);
    }

    /**
     * Delete a stored repository file from disk (metadata removal is done by the editor on save).
     */
    public function deleteRepositoryFile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path' => ['nullable', 'string', 'max:500'],
            'token' => ['nullable', 'string', 'max:1000'],
        ]);

        $path = null;
        if (! empty($data['path'])) {
            $candidate = str_replace('\\', '/', (string) $data['path']);
            if (str_starts_with($candidate, 'convention-repositories/') && ! str_contains($candidate, '..')) {
                $path = $candidate;
            }
        } elseif (! empty($data['token'])) {
            $path = self::decodeRepositoryFileToken((string) $data['token']);
        }

        if ($path === null) {
            return response()->json(['message' => 'Invalid file path.'], 422);
        }

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Stream a previously uploaded repository file (authenticated users — Knowledge Hub downloads).
     */
    public function downloadRepositoryFile(string $token): StreamedResponse|JsonResponse
    {
        $path = self::decodeRepositoryFileToken($token);
        if ($path === null || ! Storage::disk('public')->exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $downloadName = basename($path);

        return Storage::disk('public')->response($path, $downloadName, [
            'Content-Disposition' => 'inline; filename="'.$downloadName.'"',
        ]);
    }

    public static function repositoryFileDownloadUrl(string $storagePath): string
    {
        return '/api/v1/repository-files/'.self::encodeRepositoryFileToken($storagePath);
    }

    public static function encodeRepositoryFileToken(string $storagePath): string
    {
        return rtrim(strtr(base64_encode($storagePath), '+/', '-_'), '=');
    }

    public static function decodeRepositoryFileToken(string $token): ?string
    {
        $padded = strtr($token, '-_', '+/');
        $remainder = strlen($padded) % 4;
        if ($remainder > 0) {
            $padded .= str_repeat('=', 4 - $remainder);
        }
        $decoded = base64_decode($padded, true);
        if (! is_string($decoded) || $decoded === '') {
            return null;
        }
        $normalized = str_replace('\\', '/', $decoded);
        if (! str_starts_with($normalized, 'convention-repositories/')) {
            return null;
        }
        if (str_contains($normalized, '..')) {
            return null;
        }

        return $normalized;
    }

    private static function repositoryTypeLabel(string $ext): string
    {
        return match ($ext) {
            'pdf' => 'PDF document',
            'doc', 'docx' => 'Word document',
            default => 'Document',
        };
    }

    private static function repositoryIcon(string $ext): string
    {
        return match ($ext) {
            'pdf' => '📄',
            'doc', 'docx' => '📝',
            default => '📎',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(Convention $c): array
    {
        return [
            'id' => $c->id,
            'code' => $c->code,
            'name' => $c->name,
            'knowledge_icon' => $c->knowledge_icon,
            'knowledge_adopted' => $c->knowledge_adopted,
            'knowledge_ratified' => $c->knowledge_ratified,
            'knowledge_articles' => $c->knowledge_articles,
            'knowledge_implementation' => $c->knowledge_implementation,
            'description' => $c->description,
            'repositories' => $c->normalizedRepositories(),
            'optional_protocol_body' => $c->optional_protocol_body,
            'sort_order' => $c->sort_order,
            'is_active' => $c->is_active,
        ];
    }
}
