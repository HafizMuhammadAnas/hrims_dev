<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('issues')) {
            return;
        }

        if (Schema::hasColumn('issues', 'description')) {
            return;
        }

        Schema::table('issues', function (Blueprint $table) {
            $table->text('description')->nullable()->after('issue_title');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('issues') || ! Schema::hasColumn('issues', 'description')) {
            return;
        }

        Schema::table('issues', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
