<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_region', function (Blueprint $table) {
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->foreignId('region_id')->constrained('regions')->cascadeOnDelete();
            $table->primary(['department_id', 'region_id']);
        });

        if (Schema::hasColumn('departments', 'region_slug')) {
            DB::statement('
                INSERT IGNORE INTO department_region (department_id, region_id)
                SELECT d.id, r.id
                FROM departments d
                INNER JOIN regions r ON r.slug = d.region_slug
                WHERE d.region_slug IS NOT NULL
            ');
        }

        Schema::dropIfExists('department_district');

        if (Schema::hasColumn('departments', 'region_slug')) {
            Schema::table('departments', function (Blueprint $table) {
                $table->dropIndex(['region_slug']);
            });
            Schema::table('departments', function (Blueprint $table) {
                $table->dropColumn('region_slug');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('department_region');

        if (! Schema::hasColumn('departments', 'region_slug')) {
            Schema::table('departments', function (Blueprint $table) {
                $table->enum('region_slug', [
                    'federal', 'punjab', 'sindh', 'balochistan', 'kpk', 'islamabad', 'gb', 'ajk',
                ])->nullable()->after('code');
                $table->index('region_slug');
            });
        }
    }
};
