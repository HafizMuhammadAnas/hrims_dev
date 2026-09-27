<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('upr_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upr_type_id')->constrained('upr_types')->cascadeOnDelete();
            $table->foreignId('upr_cycle_id')->constrained('upr_cycles')->cascadeOnDelete();
            $table->foreignId('upr_category_id')->constrained('upr_categories')->cascadeOnDelete();
            $table->boolean('is_dummy')->default(false);
            $table->boolean('has_quantitative')->default(false);
            $table->boolean('has_qualitative')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('upr_entry_recommendation', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upr_entry_id')->constrained('upr_entries')->cascadeOnDelete();
            $table->foreignId('upr_recommendation_entry_id')->constrained('upr_recommendation_entries')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(
                ['upr_entry_id', 'upr_recommendation_entry_id'],
                'upr_entry_rec_unique',
            );
        });

        Schema::create('upr_entry_indicators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upr_entry_id')->constrained('upr_entries')->cascadeOnDelete();
            $table->text('indicator_text');
            $table->boolean('has_quantitative')->default(false);
            $table->boolean('has_qualitative')->default(false);
            $table->boolean('collects_by_gender')->default(false);
            $table->boolean('collects_by_age')->default(false);
            $table->boolean('collects_by_location')->default(false);
            $table->boolean('collects_by_disability')->default(false);
            $table->boolean('collects_by_religion')->default(false);
            $table->boolean('collects_by_consolidated')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('upr_entry_indicators');
        Schema::dropIfExists('upr_entry_recommendation');
        Schema::dropIfExists('upr_entries');
    }
};
