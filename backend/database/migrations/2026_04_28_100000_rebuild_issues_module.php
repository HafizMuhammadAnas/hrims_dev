<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('issue_upr_recommendation');
        Schema::dropIfExists('issue_sdg_node');
        Schema::dropIfExists('issue_convention_component');
        Schema::dropIfExists('issue_definitions');

        Schema::create('issue_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);
            $table->timestamps();
        });

        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('article_name', 255);
            $table->timestamps();
        });

        Schema::create('issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('convention_id')->constrained('conventions')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('issue_categories')->cascadeOnDelete();
            $table->string('issue_title', 500);
            $table->text('description')->nullable();
            $table->boolean('has_quantitative')->default(false);
            $table->boolean('has_qualitative')->default(false);
            $table->timestamps();
        });

        Schema::create('issue_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('issue_id')->constrained('issues')->cascadeOnDelete();
            $table->foreignId('article_id')->constrained('articles')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['issue_id', 'article_id']);
        });

        Schema::create('issue_indicators', function (Blueprint $table) {
            $table->id();
            $table->foreignId('issue_id')->constrained('issues')->cascadeOnDelete();
            $table->text('indicator_text');
            $table->text('disaggregation')->nullable();
            $table->boolean('has_quantitative')->default(false);
            $table->boolean('has_qualitative')->default(false);
            $table->timestamps();
        });

        $now = now();
        foreach (['A', 'B', 'C'] as $name) {
            DB::table('issue_categories')->insert([
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach (range(1, 12) as $n) {
            DB::table('articles')->insert([
                'article_name' => 'Article '.$n,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('issue_indicators');
        Schema::dropIfExists('issue_articles');
        Schema::dropIfExists('issues');
        Schema::dropIfExists('articles');
        Schema::dropIfExists('issue_categories');

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
};
