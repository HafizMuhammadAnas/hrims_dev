<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('issue_indicators', function (Blueprint $table) {
            if (! Schema::hasColumn('issue_indicators', 'collects_by_year')) {
                $table->boolean('collects_by_year')->default(false)->after('has_qualitative');
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('issue_indicators', 'collects_by_year')) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->dropColumn('collects_by_year');
            });
        }
    }
};
