<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('governance_default_charts')) {
            return;
        }

        Schema::table('governance_default_charts', function (Blueprint $table) {
            if (! Schema::hasColumn('governance_default_charts', 'series_c_key')) {
                $table->string('series_c_key', 64)->nullable()->after('series_b_indicator_id');
            }
            if (! Schema::hasColumn('governance_default_charts', 'series_c_label')) {
                $table->string('series_c_label', 255)->nullable()->after('series_c_key');
            }
            if (! Schema::hasColumn('governance_default_charts', 'series_c_indicator_id')) {
                $table->unsignedBigInteger('series_c_indicator_id')->nullable()->after('series_c_label');
                $table->foreign('series_c_indicator_id')
                    ->references('id')
                    ->on('issue_indicators')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('governance_default_charts')) {
            return;
        }

        Schema::table('governance_default_charts', function (Blueprint $table) {
            if (Schema::hasColumn('governance_default_charts', 'series_c_indicator_id')) {
                $table->dropForeign(['series_c_indicator_id']);
                $table->dropColumn('series_c_indicator_id');
            }
            if (Schema::hasColumn('governance_default_charts', 'series_c_label')) {
                $table->dropColumn('series_c_label');
            }
            if (Schema::hasColumn('governance_default_charts', 'series_c_key')) {
                $table->dropColumn('series_c_key');
            }
        });
    }
};
