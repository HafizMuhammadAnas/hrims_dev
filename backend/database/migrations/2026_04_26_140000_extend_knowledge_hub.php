<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conventions', function (Blueprint $table) {
            $table->string('knowledge_icon', 32)->nullable()->after('name');
            $table->string('knowledge_adopted', 64)->nullable();
            $table->string('knowledge_ratified', 64)->nullable();
            $table->string('knowledge_articles', 64)->nullable();
            $table->string('knowledge_implementation', 64)->nullable();
        });

        Schema::table('sdg_nodes', function (Blueprint $table) {
            $table->string('knowledge_icon', 32)->nullable()->after('title');
            $table->text('summary')->nullable();
            $table->longText('body')->nullable();
            $table->string('stat_1_value', 64)->nullable();
            $table->string('stat_1_label', 128)->nullable();
            $table->string('stat_2_value', 64)->nullable();
            $table->string('stat_2_label', 128)->nullable();
        });

        Schema::create('knowledge_cards', function (Blueprint $table) {
            $table->id();
            $table->string('section', 32);
            $table->string('icon', 32)->default('📌');
            $table->string('title');
            $table->text('summary')->nullable();
            $table->string('stat_1_value', 64)->nullable();
            $table->string('stat_1_label', 128)->nullable();
            $table->string('stat_2_value', 64)->nullable();
            $table->string('stat_2_label', 128)->nullable();
            $table->longText('body')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('section');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_cards');

        Schema::table('sdg_nodes', function (Blueprint $table) {
            $table->dropColumn([
                'knowledge_icon',
                'summary',
                'body',
                'stat_1_value',
                'stat_1_label',
                'stat_2_value',
                'stat_2_label',
            ]);
        });

        Schema::table('conventions', function (Blueprint $table) {
            $table->dropColumn([
                'knowledge_icon',
                'knowledge_adopted',
                'knowledge_ratified',
                'knowledge_articles',
                'knowledge_implementation',
            ]);
        });
    }
};
