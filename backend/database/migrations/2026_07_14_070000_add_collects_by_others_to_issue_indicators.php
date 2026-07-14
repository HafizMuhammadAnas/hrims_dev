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
            if (! Schema::hasColumn('issue_indicators', 'collects_by_others')) {
                $table->boolean('collects_by_others')->default(false)->after('collects_by_religion');
            }
        });

        // Backfill: quantitative year-based indicators already collect Gender/Age/Disability/Religion.
        if (Schema::hasColumn('issue_indicators', 'collects_by_others')) {
            DB::table('issue_indicators')
                ->where('has_quantitative', true)
                ->where('collects_by_year', true)
                ->update(['collects_by_others' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('issue_indicators', function (Blueprint $table) {
            if (Schema::hasColumn('issue_indicators', 'collects_by_others')) {
                $table->dropColumn('collects_by_others');
            }
        });
    }
};
