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
            if (! Schema::hasColumn('department_tasks', 'due_date')) {
                $table->date('due_date')->nullable()->after('assigned_date');
            }
        });

        // Backfill from parent request due date so existing tasks stay usable.
        if (Schema::hasColumn('department_tasks', 'due_date') && Schema::hasTable('hr_requests')) {
            DB::statement(
                'UPDATE department_tasks dt
                 INNER JOIN hr_requests hr ON hr.id = dt.hr_request_id
                 SET dt.due_date = hr.due_date
                 WHERE dt.due_date IS NULL AND hr.due_date IS NOT NULL'
            );
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('department_tasks')) {
            return;
        }

        Schema::table('department_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('department_tasks', 'due_date')) {
                $table->dropColumn('due_date');
            }
        });
    }
};
