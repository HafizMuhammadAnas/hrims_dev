<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('upr_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 64)->nullable();
            $table->string('description', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('name');
        });

        Schema::create('upr_cycles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 64)->nullable();
            $table->string('session_label', 128)->nullable();
            $table->string('description', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique('name');
        });

        Schema::create('upr_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('upr_cycle_id')->nullable()->constrained('upr_cycles')->nullOnDelete();
            $table->string('name');
            $table->string('code', 64)->nullable();
            $table->string('description', 500)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['upr_cycle_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('upr_categories');
        Schema::dropIfExists('upr_cycles');
        Schema::dropIfExists('upr_types');
    }
};
