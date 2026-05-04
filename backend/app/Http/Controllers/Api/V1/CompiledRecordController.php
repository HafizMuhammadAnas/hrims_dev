<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompiledRecord;
use App\Models\RegionalResponse;
use App\Support\HrimsAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CompiledRecordController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin') && ! $request->user()->hasRole('federal_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'federal_group_id' => ['required', 'string', 'exists:federal_groups,id'],
            'title' => ['required', 'string', 'max:500'],
            'region_names' => ['required', 'array', 'min:1'],
            'region_names.*' => ['string', 'max:128'],
            'summary' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['draft', 'submitted'])],
            'submitted_to' => ['nullable', 'string', 'max:255'],
        ]);

        $row = CompiledRecord::query()->create([
            'id' => 'COMP-'.strtoupper(Str::random(10)),
            'federal_group_id' => $data['federal_group_id'],
            'title' => $data['title'],
            'region_names' => $data['region_names'],
            'compilation_date' => now()->toDateString(),
            'submitted_to' => $data['submitted_to'] ?? ($data['status'] === 'submitted' ? 'Ministry of Human Rights' : null),
            'submission_date' => $data['status'] === 'submitted' ? now()->toDateString() : null,
            'status' => $data['status'],
            'attachment' => $data['status'] === 'submitted' ? 'compiled-report.pdf' : null,
            'summary' => $data['summary'] ?? null,
        ]);

        return response()->json([
            'data' => [
                'id' => $row->id,
                'federal_id' => $row->federal_group_id,
                'title' => $row->title,
                'region_names' => $row->region_names,
                'compilation_date' => $row->compilation_date?->format('Y-m-d'),
                'submitted_to' => $row->submitted_to,
                'submission_date' => $row->submission_date?->format('Y-m-d'),
                'status' => $row->status,
                'attachment' => $row->attachment,
                'summary' => $row->summary,
            ],
        ], 201);
    }

    /**
     * Preview which region names would compile for a federal group (accepted responses only).
     */
    public function preview(Request $request): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin') && ! $request->user()->hasRole('federal_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'federal_group_id' => ['required', 'string', 'exists:federal_groups,id'],
        ]);

        $responses = RegionalResponse::query()
            ->with('region')
            ->where('federal_group_id', $data['federal_group_id'])
            ->where('review_status', 'accepted')
            ->get();

        $names = $responses->map(fn (RegionalResponse $r) => $r->region?->name)->filter()->unique()->values()->all();

        return response()->json([
            'data' => [
                'region_names' => $names,
                'response_count' => $responses->count(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = CompiledRecord::query();

        if (! HrimsAccess::seesAllRegions($request->user())) {
            $name = $request->user()->region?->name;
            if ($name) {
                $query->whereJsonContains('region_names', $name);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $rows = $query->orderByDesc('compilation_date')->get();

        return response()->json([
            'data' => $rows->map(fn (CompiledRecord $c) => [
                'id' => $c->id,
                'federal_id' => $c->federal_group_id,
                'title' => $c->title,
                'region_names' => $c->region_names,
                'compilation_date' => $c->compilation_date?->format('Y-m-d'),
                'submitted_to' => $c->submitted_to,
                'submission_date' => $c->submission_date?->format('Y-m-d'),
                'status' => $c->status,
                'attachment' => $c->attachment,
                'summary' => $c->summary,
            ]),
        ]);
    }
}
