<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('upr_recommendation_entries')) {
            return;
        }

        $indexes = collect(Schema::getIndexes('upr_recommendation_entries'));
        $hasIndex = fn (string $name) => $indexes->contains(
            fn (array $idx) => ($idx['name'] ?? '') === $name
        );

        // The composite unique may be the only index backing the category FK on MySQL.
        // Add a dedicated index first so the unique can be dropped safely.
        if (! $hasIndex('upr_rec_entries_category_id_index')) {
            Schema::table('upr_recommendation_entries', function (Blueprint $table) {
                $table->index('upr_category_id', 'upr_rec_entries_category_id_index');
            });
        }

        if ($hasIndex('upr_rec_entries_category_name_unique')) {
            Schema::table('upr_recommendation_entries', function (Blueprint $table) {
                $table->dropUnique('upr_rec_entries_category_name_unique');
            });
        }

        // TEXT unique indexes are not practical on MySQL; uniqueness stays enforced in the API.
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE upr_recommendation_entries MODIFY name TEXT NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('upr_recommendation_entries')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE upr_recommendation_entries MODIFY name VARCHAR(255) NOT NULL');
        }

        $indexes = collect(Schema::getIndexes('upr_recommendation_entries'));
        $hasIndex = fn (string $name) => $indexes->contains(
            fn (array $idx) => ($idx['name'] ?? '') === $name
        );

        if (! $hasIndex('upr_rec_entries_category_name_unique')) {
            Schema::table('upr_recommendation_entries', function (Blueprint $table) {
                $table->unique(['upr_category_id', 'name'], 'upr_rec_entries_category_name_unique');
            });
        }

        if ($hasIndex('upr_rec_entries_category_id_index')) {
            Schema::table('upr_recommendation_entries', function (Blueprint $table) {
                $table->dropIndex('upr_rec_entries_category_id_index');
            });
        }
    }
};
