<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->string('code', 64)->nullable()->unique()->after('id');
        });

        Schema::create('federal_groups', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('title');
            $table->string('conv', 64);
            $table->date('initiated_on');
            $table->string('status', 32);
            $table->timestamps();
        });

        Schema::create('hr_requests', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('title');
            $table->string('conv', 64);
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->date('due_date');
            $table->string('status', 32);
            $table->text('details')->nullable();
            $table->string('attachment_file_name')->nullable();
            $table->string('federal_group_id', 32)->nullable()->constrained('federal_groups')->nullOnDelete();
            $table->string('category_id')->nullable();
            $table->string('subcategory_id')->nullable();
            $table->string('indicator_id')->nullable();
            $table->string('recommendation_id')->nullable();
            $table->string('sdg')->nullable();
            $table->string('sdg_indicator')->nullable();
            $table->string('upr')->nullable();
            $table->string('upr_indicator')->nullable();
            $table->json('issue_cards')->nullable();
            $table->timestamps();
        });

        Schema::create('federal_group_hr_request', function (Blueprint $table) {
            $table->string('federal_group_id', 32);
            $table->string('hr_request_id', 64);
            $table->primary(['federal_group_id', 'hr_request_id']);
            $table->foreign('federal_group_id')->references('id')->on('federal_groups')->cascadeOnDelete();
            $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
        });

        Schema::create('regional_responses', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('hr_request_id', 64);
            $table->string('federal_group_id', 32)->nullable();
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->string('title');
            $table->date('submission_date');
            $table->string('review_status', 32);
            $table->text('comments')->nullable();
            $table->longText('content');
            $table->timestamps();

            $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
            $table->foreign('federal_group_id')->references('id')->on('federal_groups')->nullOnDelete();
        });

        Schema::create('compiled_records', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('federal_group_id', 32)->nullable();
            $table->string('title');
            $table->json('region_names');
            $table->date('compilation_date')->nullable();
            $table->string('submitted_to')->nullable();
            $table->date('submission_date')->nullable();
            $table->string('status', 32);
            $table->string('attachment')->nullable();
            $table->text('summary')->nullable();
            $table->timestamps();

            $table->foreign('federal_group_id')->references('id')->on('federal_groups')->nullOnDelete();
        });

        Schema::create('department_tasks', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('hr_request_id', 64);
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->string('status', 32);
            $table->date('assigned_date');
            $table->date('submission_date')->nullable();
            $table->text('response_data')->nullable();
            $table->string('attachment_url')->nullable();
            $table->string('category_id')->nullable();
            $table->string('subcategory_id')->nullable();
            $table->string('indicator_id')->nullable();
            $table->timestamps();

            $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
        });

        Schema::create('violation_entries', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('entry_number', 64)->unique();
            $table->string('title');
            $table->date('event_date');
            $table->string('event_time')->nullable();
            $table->string('event_year', 8);
            $table->foreignId('region_id')->nullable()->constrained('regions')->nullOnDelete();
            $table->string('district')->nullable();
            $table->string('violation_category');
            $table->string('violation_sub_category')->nullable();
            $table->string('violation_indicator')->nullable();
            $table->string('monitoring_status', 64);
            $table->longText('description');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('violation_entries');
        Schema::dropIfExists('department_tasks');
        Schema::dropIfExists('compiled_records');
        Schema::dropIfExists('regional_responses');
        Schema::dropIfExists('federal_group_hr_request');
        Schema::dropIfExists('hr_requests');
        Schema::dropIfExists('federal_groups');

        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('code');
        });
    }
};
