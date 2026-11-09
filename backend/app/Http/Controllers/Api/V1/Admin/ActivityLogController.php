<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'action' => ['sometimes', 'nullable', 'string', Rule::in(['login', 'logout', 'download'])],
            'q' => ['sometimes', 'nullable', 'string', 'max:255'],
            'from' => ['sometimes', 'nullable', 'date'],
            'to' => ['sometimes', 'nullable', 'date'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $perPage = (int) ($data['per_page'] ?? 25);

        $query = ActivityLog::query()->orderByDesc('id');

        if (! empty($data['action'])) {
            $query->where('action', $data['action']);
        }

        if (! empty($data['q'])) {
            $q = trim((string) $data['q']);
            $query->where(function ($inner) use ($q) {
                $inner->where('username', 'like', "%{$q}%")
                    ->orWhere('user_name', 'like', "%{$q}%")
                    ->orWhere('file_name', 'like', "%{$q}%");
            });
        }

        if (! empty($data['from'])) {
            $query->whereDate('created_at', '>=', $data['from']);
        }

        if (! empty($data['to'])) {
            $query->whereDate('created_at', '<=', $data['to']);
        }

        $page = $query->paginate($perPage);

        return response()->json([
            'data' => collect($page->items())->map(fn (ActivityLog $row) => [
                'id' => $row->id,
                'user_id' => $row->user_id,
                'username' => $row->username,
                'user_name' => $row->user_name,
                'action' => $row->action,
                'file_name' => $row->file_name,
                'file_type' => $row->file_type,
                'source' => $row->source,
                'ip_address' => $row->ip_address,
                'created_at' => optional($row->created_at)?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }
}
