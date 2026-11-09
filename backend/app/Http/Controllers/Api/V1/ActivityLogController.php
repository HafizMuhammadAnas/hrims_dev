<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ActivityLogController extends Controller
{
    /** Authenticated users report a client-side file download (PDF/Word/Excel exports). */
    public function storeDownload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file_name' => ['required', 'string', 'max:500'],
            'file_type' => ['nullable', 'string', Rule::in(['pdf', 'word', 'excel', 'other'])],
            'source' => ['nullable', 'string', 'max:120'],
        ]);

        $fileName = trim($data['file_name']);
        $fileType = $data['file_type'] ?? ActivityLogService::guessFileType($fileName);

        ActivityLogService::record(
            'download',
            $request->user(),
            $request,
            $fileName,
            $fileType,
            $data['source'] ?? 'client_export',
        );

        return response()->json(['message' => 'Logged']);
    }
}
