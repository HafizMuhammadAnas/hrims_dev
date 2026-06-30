<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['issue_categories', 'articles', 'collection_years', 'collection_genders', 'collection_religions'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->boolean('is_active')->default(true);
            });
        }
    }

    public function down(): void
    {
        foreach (['issue_categories', 'articles', 'collection_years', 'collection_genders', 'collection_religions'] as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn('is_active');
            });
        }
    }
};
