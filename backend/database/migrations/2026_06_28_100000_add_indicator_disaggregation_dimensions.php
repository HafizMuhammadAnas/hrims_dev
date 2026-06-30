<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('collection_religions')) {
            Schema::create('collection_religions', function (Blueprint $table) {
                $table->id();
                $table->string('name', 255);
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();
                $table->unique('name');
            });
        }

        Schema::table('issue_indicators', function (Blueprint $table) {
            if (! Schema::hasColumn('issue_indicators', 'collects_by_age')) {
                $table->boolean('collects_by_age')->default(false)->after('collects_by_gender');
            }
            if (! Schema::hasColumn('issue_indicators', 'collects_by_location')) {
                $table->boolean('collects_by_location')->default(false)->after('collects_by_age');
            }
            if (! Schema::hasColumn('issue_indicators', 'collects_by_disability')) {
                $table->boolean('collects_by_disability')->default(false)->after('collects_by_location');
            }
            if (! Schema::hasColumn('issue_indicators', 'collects_by_religion')) {
                $table->boolean('collects_by_religion')->default(false)->after('collects_by_disability');
            }
        });

        if (! Schema::hasTable('issue_indicator_year_religion')) {
            Schema::create('issue_indicator_year_religion', function (Blueprint $table) {
                $table->foreignId('issue_indicator_id')->constrained('issue_indicators')->cascadeOnDelete();
                $table->foreignId('collection_year_id')->constrained('collection_years')->cascadeOnDelete();
                $table->foreignId('collection_religion_id')->constrained('collection_religions')->cascadeOnDelete();
                $table->timestamps();
                $table->primary(
                    ['issue_indicator_id', 'collection_year_id', 'collection_religion_id'],
                    'issue_indicator_year_religion_primary',
                );
            });
        }

        if (DB::table('collection_religions')->count() === 0) {
            $now = now();
            $names = [
                'None',
                'Ahmadiyya',
                'Bahais',
                'Buddhist',
                'Christians',
                'Hindus',
                'Jews',
                'Muslims',
                'Non-believers',
                'Parsi',
                'Sikhs',
                'Zikri',
                'Others',
            ];
            foreach ($names as $index => $name) {
                DB::table('collection_religions')->insert([
                    'name' => $name,
                    'sort_order' => $index + 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('issue_indicator_year_religion');

        Schema::table('issue_indicators', function (Blueprint $table) {
            foreach (['collects_by_religion', 'collects_by_disability', 'collects_by_location', 'collects_by_age'] as $col) {
                if (Schema::hasColumn('issue_indicators', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::dropIfExists('collection_religions');
    }
};
