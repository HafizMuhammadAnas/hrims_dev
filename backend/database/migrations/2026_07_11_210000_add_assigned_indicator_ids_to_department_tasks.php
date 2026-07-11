<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            if (! Schema::hasColumn('department_tasks', 'assigned_indicator_ids')) {
                $table->json('assigned_indicator_ids')->nullable()->after('assignment_instructions');
            }
        });
    }

    public function down(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('department_tasks', 'assigned_indicator_ids')) {
                $table->dropColumn('assigned_indicator_ids');
            }
        });
    }
};
