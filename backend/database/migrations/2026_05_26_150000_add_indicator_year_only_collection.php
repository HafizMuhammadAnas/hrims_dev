<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('issue_indicators', 'collects_by_gender')) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->boolean('collects_by_gender')->default(false)->after('collects_by_year');
            });
        }

        if (! Schema::hasTable('issue_indicator_years')) {
            Schema::create('issue_indicator_years', function (Blueprint $table) {
                $table->foreignId('issue_indicator_id')->constrained('issue_indicators')->cascadeOnDelete();
                $table->foreignId('collection_year_id')->constrained('collection_years')->cascadeOnDelete();
                $table->timestamps();
                $table->primary(['issue_indicator_id', 'collection_year_id'], 'issue_indicator_years_primary');
            });
        }

        if (Schema::hasTable('issue_indicator_year_gender')) {
            $indicatorIds = DB::table('issue_indicator_year_gender')
                ->distinct()
                ->pluck('issue_indicator_id');
            if ($indicatorIds->isNotEmpty()) {
                DB::table('issue_indicators')
                    ->whereIn('id', $indicatorIds)
                    ->update(['collects_by_gender' => true]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('issue_indicator_years');

        if (Schema::hasColumn('issue_indicators', 'collects_by_gender')) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->dropColumn('collects_by_gender');
            });
        }
    }
};
