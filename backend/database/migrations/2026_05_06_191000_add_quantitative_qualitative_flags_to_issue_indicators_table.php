<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('issue_indicators')) {
            return;
        }

        $afterCol = Schema::hasColumn('issue_indicators', 'disaggregation')
            ? 'disaggregation'
            : (Schema::hasColumn('issue_indicators', 'indicator_text') ? 'indicator_text' : null);

        Schema::table('issue_indicators', function (Blueprint $table) use ($afterCol) {
            if (! Schema::hasColumn('issue_indicators', 'has_quantitative')) {
                $col = $table->boolean('has_quantitative')->default(false);
                if ($afterCol) {
                    $col->after($afterCol);
                }
            }
            if (! Schema::hasColumn('issue_indicators', 'has_qualitative')) {
                $table->boolean('has_qualitative')->default(false)->after('has_quantitative');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('issue_indicators')) {
            return;
        }

        Schema::table('issue_indicators', function (Blueprint $table) {
            if (Schema::hasColumn('issue_indicators', 'has_qualitative')) {
                $table->dropColumn('has_qualitative');
            }
            if (Schema::hasColumn('issue_indicators', 'has_quantitative')) {
                $table->dropColumn('has_quantitative');
            }
        });
    }
};
