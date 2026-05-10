<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            if (! Schema::hasColumn('department_tasks', 'assignment_instructions')) {
                $table->text('assignment_instructions')->nullable()->after('assigned_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('department_tasks', 'assignment_instructions')) {
                $table->dropColumn('assignment_instructions');
            }
        });
    }
};
