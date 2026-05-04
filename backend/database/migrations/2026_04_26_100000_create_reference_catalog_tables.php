<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('region_id')->constrained('regions')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug', 128)->nullable();
            $table->timestamps();

            $table->unique(['region_id', 'slug']);
        });

        Schema::create('conventions', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('convention_components', function (Blueprint $table) {
            $table->id();
            $table->foreignId('convention_id')->constrained('conventions')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('convention_components')->nullOnDelete();
            $table->string('type', 64);
            $table->string('code', 128);
            $table->string('title');
            $table->text('body')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['convention_id', 'parent_id']);
        });

        Schema::create('sdg_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('sdg_nodes')->nullOnDelete();
            $table->string('node_type', 32);
            $table->string('code', 64);
            $table->string('title');
            $table->unsignedTinyInteger('goal_number')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['parent_id', 'node_type']);
        });

        Schema::create('upr_recommendations', function (Blueprint $table) {
            $table->id();
            $table->string('session_label', 128);
            $table->string('code', 64);
            $table->string('title');
            $table->text('body')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('issue_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('title');
            $table->string('category', 128)->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('issue_convention_component', function (Blueprint $table) {
            $table->foreignId('issue_definition_id')->constrained('issue_definitions')->cascadeOnDelete();
            $table->foreignId('convention_component_id')->constrained('convention_components')->cascadeOnDelete();
            $table->primary(['issue_definition_id', 'convention_component_id'], 'issue_conv_comp_pk');
        });

        Schema::create('issue_sdg_node', function (Blueprint $table) {
            $table->foreignId('issue_definition_id')->constrained('issue_definitions')->cascadeOnDelete();
            $table->foreignId('sdg_node_id')->constrained('sdg_nodes')->cascadeOnDelete();
            $table->primary(['issue_definition_id', 'sdg_node_id'], 'issue_sdg_pk');
        });

        Schema::create('issue_upr_recommendation', function (Blueprint $table) {
            $table->foreignId('issue_definition_id')->constrained('issue_definitions')->cascadeOnDelete();
            $table->foreignId('upr_recommendation_id')->constrained('upr_recommendations')->cascadeOnDelete();
            $table->primary(['issue_definition_id', 'upr_recommendation_id'], 'issue_upr_pk');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('issue_upr_recommendation');
        Schema::dropIfExists('issue_sdg_node');
        Schema::dropIfExists('issue_convention_component');
        Schema::dropIfExists('issue_definitions');
        Schema::dropIfExists('upr_recommendations');
        Schema::dropIfExists('sdg_nodes');
        Schema::dropIfExists('convention_components');
        Schema::dropIfExists('conventions');
        Schema::dropIfExists('districts');
    }
};
