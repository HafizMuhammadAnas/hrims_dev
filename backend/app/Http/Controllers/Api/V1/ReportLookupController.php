<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Convention;
use App\Models\IssueCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;

class ReportLookupController extends Controller
{
    public function conventions(): JsonResponse
    {
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

    public function issueCategories(): JsonResponse
    {
        $q = IssueCategory::query()->orderBy('name');
        if (Schema::hasColumn('issue_categories', 'is_active')) {
            $q->where('is_active', true);
        }
        $rows = $q->get(['id', 'name']);

        return response()->json([
            'data' => $rows->map(fn (IssueCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
            ]),
        ]);
    }
}
