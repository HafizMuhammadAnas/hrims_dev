<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('issue_indicator_year_gender')) {
            Schema::create('issue_indicator_year_gender', function (Blueprint $table) {
                $table->foreignId('issue_indicator_id')->constrained('issue_indicators')->cascadeOnDelete();
                $table->foreignId('collection_year_id')->constrained('collection_years')->cascadeOnDelete();
                $table->foreignId('collection_gender_id')->constrained('collection_genders')->cascadeOnDelete();
                $table->timestamps();
                $table->primary(
                    ['issue_indicator_id', 'collection_year_id', 'collection_gender_id'],
                    'issue_indicator_year_gender_primary',
                );
            });
        }

        if (! Schema::hasTable('issue_indicator_collection_year')) {
            return;
        }

        $indicatorIds = DB::table('issue_indicator_collection_year')
            ->distinct()
            ->pluck('issue_indicator_id');

        foreach ($indicatorIds as $indicatorId) {
            $yearIds = DB::table('issue_indicator_collection_year')
                ->where('issue_indicator_id', $indicatorId)
                ->pluck('collection_year_id');
            $genderIds = DB::table('issue_indicator_collection_gender')
                ->where('issue_indicator_id', $indicatorId)
                ->pluck('collection_gender_id');

            if ($genderIds->isEmpty()) {
                continue;
            }

            $now = now();
            foreach ($yearIds as $yearId) {
                foreach ($genderIds as $genderId) {
                    DB::table('issue_indicator_year_gender')->insertOrIgnore([
                        'issue_indicator_id' => $indicatorId,
                        'collection_year_id' => $yearId,
                        'collection_gender_id' => $genderId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }

        Schema::dropIfExists('issue_indicator_collection_gender');
        Schema::dropIfExists('issue_indicator_collection_year');

        if (Schema::hasColumn('issue_indicators', 'collects_by_gender')) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->dropColumn('collects_by_gender');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('issue_indicator_year_gender');

        if (! Schema::hasTable('issue_indicator_collection_year')) {
            Schema::create('issue_indicator_collection_year', function (Blueprint $table) {
                $table->foreignId('issue_indicator_id')->constrained('issue_indicators')->cascadeOnDelete();
                $table->foreignId('collection_year_id')->constrained('collection_years')->cascadeOnDelete();
                $table->primary(['issue_indicator_id', 'collection_year_id']);
            });
        }

        if (! Schema::hasTable('issue_indicator_collection_gender')) {
            Schema::create('issue_indicator_collection_gender', function (Blueprint $table) {
                $table->foreignId('issue_indicator_id')->constrained('issue_indicators')->cascadeOnDelete();
                $table->foreignId('collection_gender_id')->constrained('collection_genders')->cascadeOnDelete();
                $table->primary(['issue_indicator_id', 'collection_gender_id']);
            });
        }

        if (! Schema::hasColumn('issue_indicators', 'collects_by_gender')) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->boolean('collects_by_gender')->default(false)->after('collects_by_year');
            });
        }
    }
};
