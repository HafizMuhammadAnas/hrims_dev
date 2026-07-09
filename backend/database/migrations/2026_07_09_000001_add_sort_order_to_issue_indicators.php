<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('issue_indicators', function (Blueprint $table) {
            $table->unsignedInteger('sort_order')->default(0)->after('collects_by_religion');
        });

        $rows = DB::table('issue_indicators')
            ->orderBy('issue_id')
            ->orderBy('id')
            ->get(['id', 'issue_id']);

        $rankByIssue = [];
        foreach ($rows as $row) {
            $issueId = (int) $row->issue_id;
            $rankByIssue[$issueId] = ($rankByIssue[$issueId] ?? -1) + 1;
            DB::table('issue_indicators')
                ->where('id', $row->id)
                ->update(['sort_order' => $rankByIssue[$issueId]]);
        }
    }

    public function down(): void
    {
        Schema::table('issue_indicators', function (Blueprint $table) {
            $table->dropColumn('sort_order');
        });
    }
};
