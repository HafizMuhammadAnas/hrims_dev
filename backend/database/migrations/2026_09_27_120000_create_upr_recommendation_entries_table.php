<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('upr_recommendation_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upr_cycle_id')->constrained('upr_cycles')->cascadeOnDelete();
            $table->foreignId('upr_category_id')->constrained('upr_categories')->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['upr_category_id', 'name'], 'upr_rec_entries_category_name_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('upr_recommendation_entries');
    }
};
