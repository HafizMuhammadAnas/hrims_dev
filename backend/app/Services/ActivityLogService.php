<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;

class ActivityLogService
{
    public static function record(
        string $action,
        ?User $user = null,
        ?Request $request = null,
        ?string $fileName = null,
        ?string $fileType = null,
        ?string $source = null,
    ): void {
        $request ??= request();

        ActivityLog::query()->create([
            'user_id' => $user?->id,
            'username' => $user?->username,
            'user_name' => $user?->name,
            'action' => $action,
            'file_name' => $fileName !== null && $fileName !== '' ? mb_substr($fileName, 0, 500) : null,
            'file_type' => $fileType !== null && $fileType !== '' ? mb_substr($fileType, 0, 32) : null,
            'source' => $source !== null && $source !== '' ? mb_substr($source, 0, 120) : null,
            'ip_address' => $request instanceof Request ? $request->ip() : null,
            'user_agent' => $request instanceof Request
                ? mb_substr((string) $request->userAgent(), 0, 2000)
                : null,
        ]);
    }

    public static function guessFileType(?string $fileName): string
    {
        $ext = strtolower(pathinfo((string) $fileName, PATHINFO_EXTENSION));

        return match ($ext) {
            'pdf' => 'pdf',
            'doc', 'docx', 'rtf' => 'word',
            'xls', 'xlsx', 'csv' => 'excel',
            default => 'other',
        };
    }
}
