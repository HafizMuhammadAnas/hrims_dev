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
            $table->unsignedBigInteger('issue_article_id')->nullable()->after('id');
        });

        DB::statement('
            UPDATE issue_indicators ii
            INNER JOIN issue_articles ia ON ia.issue_id = ii.issue_id
            INNER JOIN (
                SELECT issue_id, MIN(id) AS min_ia_id
                FROM issue_articles
                GROUP BY issue_id
            ) first_ia ON first_ia.issue_id = ia.issue_id AND ia.id = first_ia.min_ia_id
            SET ii.issue_article_id = ia.id
        ');

        DB::table('issue_indicators')->whereNull('issue_article_id')->delete();

        Schema::table('issue_indicators', function (Blueprint $table) {
            $table->dropForeign(['issue_id']);
            $table->dropColumn(['issue_id', 'has_quantitative', 'has_qualitative']);
        });

        Schema::table('issue_indicators', function (Blueprint $table) {
            $table->foreign('issue_article_id')->references('id')->on('issue_articles')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        // Rollback would require restoring issue_id and per-indicator flags; use a DB backup to reverse.
    }
};
