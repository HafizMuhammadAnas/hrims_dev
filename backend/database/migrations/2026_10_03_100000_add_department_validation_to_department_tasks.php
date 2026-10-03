<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('department_tasks')) {
            return;
        }

        Schema::table('department_tasks', function (Blueprint $table) {
            if (! Schema::hasColumn('department_tasks', 'department_validation_status')) {
                $table->string('department_validation_status', 32)->nullable()->after('status');
            }
            if (! Schema::hasColumn('department_tasks', 'department_validation_comments')) {
                $table->text('department_validation_comments')->nullable()->after('department_validation_status');
            }
        });

        // Existing submitted tasks were already past department handoff — treat as validated.
        if (Schema::hasColumn('department_tasks', 'department_validation_status')) {
            DB::table('department_tasks')
                ->where('status', 'submitted')
                ->whereNull('department_validation_status')
                ->update(['department_validation_status' => 'accepted']);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('department_tasks')) {
            return;
        }

        Schema::table('department_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('department_tasks', 'department_validation_comments')) {
                $table->dropColumn('department_validation_comments');
            }
            if (Schema::hasColumn('department_tasks', 'department_validation_status')) {
                $table->dropColumn('department_validation_status');
            }
        });
    }
};
