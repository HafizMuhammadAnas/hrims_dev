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
        if (Schema::hasColumn('issue_indicators', 'is_active')) {
            return;
        }

        Schema::table('issue_indicators', function (Blueprint $table) {
            $table->boolean('is_active')->default(true);
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('issue_indicators')) {
            return;
        }
        if (! Schema::hasColumn('issue_indicators', 'is_active')) {
            return;
        }

        Schema::table('issue_indicators', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
