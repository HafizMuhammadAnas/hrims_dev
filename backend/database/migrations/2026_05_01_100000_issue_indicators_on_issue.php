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
            $table->foreignId('issue_id')->nullable()->after('id')->constrained('issues')->cascadeOnDelete();
        });

        DB::statement('
            UPDATE issue_indicators ii
            INNER JOIN issue_articles ia ON ia.id = ii.issue_article_id
            SET ii.issue_id = ia.issue_id
        ');

        DB::table('issue_indicators')->whereNull('issue_id')->delete();

        Schema::table('issue_indicators', function (Blueprint $table) {
            $table->dropForeign(['issue_article_id']);
            $table->dropColumn('issue_article_id');
        });
    }

    public function down(): void
    {
        // Restore from backup if needed.
    }
};
