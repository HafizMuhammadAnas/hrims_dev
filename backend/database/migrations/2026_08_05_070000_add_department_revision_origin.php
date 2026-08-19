<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('department_tasks') && ! Schema::hasColumn('department_tasks', 'pending_revision_origin')) {
            Schema::table('department_tasks', function (Blueprint $table) {
                $table->string('pending_revision_origin', 32)->nullable()->after('regional_review_comments');
            });
        }

        if (Schema::hasTable('department_task_revisions') && ! Schema::hasColumn('department_task_revisions', 'revision_origin')) {
            Schema::table('department_task_revisions', function (Blueprint $table) {
                $table->string('revision_origin', 32)->nullable()->after('regional_review_comments');
                $table->index('revision_origin');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('department_tasks') && Schema::hasColumn('department_tasks', 'pending_revision_origin')) {
            Schema::table('department_tasks', function (Blueprint $table) {
                $table->dropColumn('pending_revision_origin');
            });
        }

        if (Schema::hasTable('department_task_revisions') && Schema::hasColumn('department_task_revisions', 'revision_origin')) {
            Schema::table('department_task_revisions', function (Blueprint $table) {
                $table->dropIndex(['revision_origin']);
                $table->dropColumn('revision_origin');
            });
        }
    }
};
