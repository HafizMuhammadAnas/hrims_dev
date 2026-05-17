<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_request_clarifications')) {
            Schema::create('hr_request_clarifications', function (Blueprint $table) {
            $table->id();
            $table->string('hr_request_id', 64);
            $table->foreignId('region_id')->constrained('regions')->cascadeOnDelete();
            $table->string('status', 32)->default('pending_federal');
            $table->text('region_message');
            $table->text('federal_response')->nullable();
            $table->foreignId('requested_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('responded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('region_submitted_at')->nullable();
            $table->timestamp('federal_responded_at')->nullable();
            $table->timestamps();

            $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
            $table->index(['hr_request_id', 'region_id', 'status']);
            });
        }

        if (! Schema::hasTable('hr_request_clarification_attachments')) {
            Schema::create('hr_request_clarification_attachments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hr_request_clarification_id');
            $table->foreign('hr_request_clarification_id', 'hr_req_clar_att_clar_fk')
                ->references('id')
                ->on('hr_request_clarifications')
                ->cascadeOnDelete();
            $table->string('side', 16);
            $table->string('disk', 32)->default('local');
            $table->string('path', 512);
            $table->string('original_name', 255);
            $table->string('mime', 128)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_request_clarification_attachments');
        Schema::dropIfExists('hr_request_clarifications');
    }
};
