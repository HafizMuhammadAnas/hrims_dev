<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('collection_years', function (Blueprint $table) {
            $table->id();
            $table->string('label', 32);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique('label');
        });

        Schema::create('collection_genders', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_genders');
        Schema::dropIfExists('collection_years');
    }
};
