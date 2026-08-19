<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('hr_requests', 'reporting_framework')) {
                $table->string('reporting_framework', 64)->nullable()->index()->after('other_issue_text');
            }
        });

        if (Schema::hasColumn('hr_requests', 'reporting_framework')) {
            DB::table('hr_requests')
                ->where('request_type', 'other_issue')
                ->whereNull('reporting_framework')
                ->update(['reporting_framework' => 'other_issue']);

            DB::table('hr_requests')
                ->whereNotNull('issue_id')
                ->whereNull('reporting_framework')
                ->update(['reporting_framework' => 'treaty_body_obligatory']);
        }
    }

    public function down(): void
    {
        Schema::table('hr_requests', function (Blueprint $table) {
            if (Schema::hasColumn('hr_requests', 'reporting_framework')) {
                $table->dropIndex(['reporting_framework']);
                $table->dropColumn('reporting_framework');
            }
        });
    }
};
