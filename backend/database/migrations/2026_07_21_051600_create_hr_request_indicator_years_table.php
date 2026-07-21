<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hr_request_indicator_years')) {
            return;
        }

        Schema::create('hr_request_indicator_years', function (Blueprint $table) {
            $table->id();
            $table->string('hr_request_id');
            $table->unsignedBigInteger('issue_indicator_id');
            $table->unsignedBigInteger('collection_year_id');
            $table->string('kind', 32); // quantitative | qualitative
            $table->timestamps();

            $table->foreign('hr_request_id')
                ->references('id')
                ->on('hr_requests')
                ->cascadeOnDelete();
            $table->foreign('issue_indicator_id')
                ->references('id')
                ->on('issue_indicators')
                ->cascadeOnDelete();
            $table->foreign('collection_year_id')
                ->references('id')
                ->on('collection_years')
                ->cascadeOnDelete();

            $table->unique(
                ['hr_request_id', 'issue_indicator_id', 'collection_year_id', 'kind'],
                'hr_req_ind_year_kind_unique'
            );
            $table->index(['hr_request_id', 'issue_indicator_id'], 'hr_req_ind_years_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_request_indicator_years');
    }
};
