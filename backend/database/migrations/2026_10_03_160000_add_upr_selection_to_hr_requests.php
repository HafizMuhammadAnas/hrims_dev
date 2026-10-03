<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_requests')) {
            return;
        }

        Schema::table('hr_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('hr_requests', 'upr_selection')) {
                $table->json('upr_selection')->nullable()->after('upr_indicator');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('hr_requests')) {
            return;
        }

        Schema::table('hr_requests', function (Blueprint $table) {
            if (Schema::hasColumn('hr_requests', 'upr_selection')) {
                $table->dropColumn('upr_selection');
            }
        });
    }
};
