<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('issue_articles', function (Blueprint $table) {
            $table->text('relevant_paragraph')->nullable()->after('article_id');
        });

        if (Schema::hasColumn('issues', 'description')) {
            $issues = DB::table('issues')->select('id', 'description')->whereNotNull('description')->get();
            foreach ($issues as $row) {
                if ($row->description === null || $row->description === '') {
                    continue;
                }
                DB::table('issue_articles')
                    ->where('issue_id', $row->id)
                    ->update(['relevant_paragraph' => $row->description]);
            }

            Schema::table('issues', function (Blueprint $table) {
                $table->dropColumn('description');
            });
        }
    }

    public function down(): void
    {
        Schema::table('issues', function (Blueprint $table) {
            $table->text('description')->nullable()->after('issue_title');
        });

        $pairs = DB::table('issue_articles')
            ->select('issue_id', 'relevant_paragraph')
            ->whereNotNull('relevant_paragraph')
            ->orderBy('id')
            ->get()
            ->groupBy('issue_id');

        foreach ($pairs as $issueId => $rows) {
            $text = $rows->first()->relevant_paragraph ?? null;
            if ($text !== null && $text !== '') {
                DB::table('issues')->where('id', $issueId)->update(['description' => $text]);
            }
        }

        Schema::table('issue_articles', function (Blueprint $table) {
            $table->dropColumn('relevant_paragraph');
        });
    }
};
