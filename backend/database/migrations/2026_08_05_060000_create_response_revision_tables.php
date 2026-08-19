<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('regional_response_revisions')) {
            Schema::create('regional_response_revisions', function (Blueprint $table) {
                $table->id();
                $table->string('regional_response_id');
                $table->unsignedInteger('revision_no');
                $table->string('title', 500)->nullable();
                $table->longText('content')->nullable();
                $table->string('review_status', 32)->nullable();
                $table->text('comments')->nullable();
                $table->foreignId('submitted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->foreign('regional_response_id')
                    ->references('id')
                    ->on('regional_responses')
                    ->cascadeOnDelete();
                $table->unique(['regional_response_id', 'revision_no'], 'reg_resp_rev_unique');
                $table->index('regional_response_id');
            });
        }

        if (! Schema::hasTable('department_task_revisions')) {
            Schema::create('department_task_revisions', function (Blueprint $table) {
                $table->id();
                $table->string('department_task_id');
                $table->unsignedInteger('revision_no');
                $table->longText('response_data')->nullable();
                $table->string('attachment_url', 2048)->nullable();
                $table->string('regional_review_status', 32)->nullable();
                $table->text('regional_review_comments')->nullable();
                $table->foreignId('submitted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->foreign('department_task_id')
                    ->references('id')
                    ->on('department_tasks')
                    ->cascadeOnDelete();
                $table->unique(['department_task_id', 'revision_no'], 'dept_task_rev_unique');
                $table->index('department_task_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('department_task_revisions');
        Schema::dropIfExists('regional_response_revisions');
    }
};
