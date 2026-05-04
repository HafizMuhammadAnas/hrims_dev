<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('hr_requests', 'convention_id')) {
            Schema::table('hr_requests', function (Blueprint $table) {
                $table->foreignId('convention_id')->nullable()->after('conv')->constrained('conventions')->nullOnDelete();
            });
        }
        if (! Schema::hasColumn('hr_requests', 'issue_id')) {
            Schema::table('hr_requests', function (Blueprint $table) {
                $table->foreignId('issue_id')->nullable()->after('convention_id')->constrained('issues')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('hr_request_region')) {
            Schema::create('hr_request_region', function (Blueprint $table) {
                $table->string('hr_request_id', 64);
                $table->foreignId('region_id')->constrained('regions')->cascadeOnDelete();
                $table->primary(['hr_request_id', 'region_id']);
                $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
            });

            DB::table('hr_request_region')->insertUsing(
                ['hr_request_id', 'region_id'],
                DB::table('hr_requests')->select('id', 'region_id')->whereNotNull('region_id')
            );
        }

        if (! Schema::hasTable('hr_request_department')) {
            Schema::create('hr_request_department', function (Blueprint $table) {
                $table->string('hr_request_id', 64);
                $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
                $table->primary(['hr_request_id', 'department_id']);
                $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('hr_request_attachments')) {
            Schema::create('hr_request_attachments', function (Blueprint $table) {
                $table->id();
                $table->string('hr_request_id', 64);
                $table->string('disk', 32)->default('local');
                $table->string('path', 512);
                $table->string('original_name', 255);
                $table->string('mime', 128)->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->timestamps();
                $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('hr_request_indicator_responses')) {
            Schema::create('hr_request_indicator_responses', function (Blueprint $table) {
                $table->id();
                $table->string('hr_request_id', 64);
                $table->foreignId('issue_indicator_id')->constrained('issue_indicators')->cascadeOnDelete();
                $table->decimal('quantitative_value', 18, 6)->nullable();
                $table->text('qualitative_text')->nullable();
                $table->timestamps();
                $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
                // MySQL max identifier length is 64; Laravel's auto name exceeds that.
                $table->unique(['hr_request_id', 'issue_indicator_id'], 'uniq_hr_req_ind_resp');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_request_indicator_responses');
        Schema::dropIfExists('hr_request_attachments');
        Schema::dropIfExists('hr_request_department');
        Schema::dropIfExists('hr_request_region');

        Schema::table('hr_requests', function (Blueprint $table) {
            $table->dropForeign(['convention_id']);
            $table->dropForeign(['issue_id']);
            $table->dropColumn(['convention_id', 'issue_id']);
        });
    }
};
