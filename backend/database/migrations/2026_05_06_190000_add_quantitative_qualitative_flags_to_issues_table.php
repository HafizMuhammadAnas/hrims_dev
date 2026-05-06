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

        Schema::table('issues', function (Blueprint $table) {
            if (! Schema::hasColumn('issues', 'has_quantitative')) {
                $table->boolean('has_quantitative')->default(false)->after(
                    Schema::hasColumn('issues', 'description') ? 'description' : 'issue_title'
                );
            }
            if (! Schema::hasColumn('issues', 'has_qualitative')) {
                $table->boolean('has_qualitative')->default(false)->after('has_quantitative');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('issues')) {
            return;
        }

        Schema::table('issues', function (Blueprint $table) {
            if (Schema::hasColumn('issues', 'has_qualitative')) {
                $table->dropColumn('has_qualitative');
            }
            if (Schema::hasColumn('issues', 'has_quantitative')) {
                $table->dropColumn('has_quantitative');
            }
        });
    }
};
