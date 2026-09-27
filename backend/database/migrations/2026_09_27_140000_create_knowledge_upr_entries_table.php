<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('knowledge_upr_entries', function (Blueprint $table) {
            $table->id();
            $table->string('kind', 32); // supported | noted | others
            $table->string('title')->nullable();
            $table->foreignId('upr_cycle_id')->nullable()->constrained('upr_cycles')->nullOnDelete();
            $table->longText('introduction')->nullable();
            $table->json('repositories')->nullable();
            $table->json('analysis_files')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['kind', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_upr_entries');
    }
};
