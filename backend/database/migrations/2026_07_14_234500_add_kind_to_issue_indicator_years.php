<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('issue_indicator_years', function (Blueprint $table) {
            $table->string('kind', 32)->default('qualitative')->after('collection_year_id');
            $table->index(['issue_indicator_id', 'kind']);
        });

        // Backfill: year-only quantitative indicators (no qual) → quantitative; otherwise leave as qualitative.
        // Disaggregated indicators historically used this table for qualitative years only (quant lived in gender cells).
        $indicators = DB::table('issue_indicators')->select('id', 'has_quantitative', 'has_qualitative', 'collects_by_gender', 'collects_by_age', 'collects_by_location', 'collects_by_disability', 'collects_by_religion', 'collects_by_others')->get();
        foreach ($indicators as $ind) {
            $disaggregated = (bool) $ind->collects_by_gender
                || (bool) $ind->collects_by_age
                || (bool) $ind->collects_by_location
                || (bool) $ind->collects_by_disability
                || (bool) $ind->collects_by_religion
                || (bool) $ind->collects_by_others;

            if ($disaggregated) {
                // Rows here are qualitative years (or legacy non-gender quant — rare). Prefer qualitative when has_qualitative.
                if (! (bool) $ind->has_qualitative && (bool) $ind->has_quantitative) {
                    DB::table('issue_indicator_years')
                        ->where('issue_indicator_id', $ind->id)
                        ->update(['kind' => 'quantitative']);
                }
                continue;
            }

            // Year-only
            if ((bool) $ind->has_quantitative && ! (bool) $ind->has_qualitative) {
                DB::table('issue_indicator_years')
                    ->where('issue_indicator_id', $ind->id)
                    ->update(['kind' => 'quantitative']);
            }
        }
    }

    public function down(): void
    {
        Schema::table('issue_indicator_years', function (Blueprint $table) {
            $table->dropIndex(['issue_indicator_id', 'kind']);
            $table->dropColumn('kind');
        });
    }
};
