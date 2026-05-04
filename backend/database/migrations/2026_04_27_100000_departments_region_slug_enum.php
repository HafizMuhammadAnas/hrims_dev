<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Region slugs aligned with regions.slug (RegionSeeder). */
    private const SLUGS = ['federal', 'punjab', 'sindh', 'balochistan', 'kpk', 'islamabad', 'gb', 'ajk'];

    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->enum('region_slug', self::SLUGS)->nullable()->after('code');
        });

        DB::statement('
            UPDATE departments d
            INNER JOIN regions r ON d.region_id = r.id
            SET d.region_slug = r.slug
        ');

        // Heuristic when region_id was never set (legacy rows) but code implies scope.
        DB::table('departments')->whereNull('region_slug')->where('code', 'like', 'SEC-%')->update(['region_slug' => 'punjab']);
        DB::table('departments')->whereNull('region_slug')->where('code', 'like', 'FED-%')->update(['region_slug' => 'federal']);

        Schema::table('departments', function (Blueprint $table) {
            $table->dropForeign(['region_id']);
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('region_id');
        });

        Schema::table('departments', function (Blueprint $table) {
            $table->index('region_slug');
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->foreignId('region_id')->nullable()->after('code')->constrained('regions')->nullOnDelete();
        });

        DB::statement('
            UPDATE departments d
            INNER JOIN regions r ON d.region_slug = r.slug
            SET d.region_id = r.id
        ');

        Schema::table('departments', function (Blueprint $table) {
            $table->dropIndex(['region_slug']);
            $table->dropColumn('region_slug');
        });
    }
};
