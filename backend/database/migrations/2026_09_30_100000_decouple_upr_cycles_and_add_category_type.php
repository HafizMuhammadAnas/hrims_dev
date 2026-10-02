<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Categories: add upr_type_id and backfill.
        if (! Schema::hasColumn('upr_categories', 'upr_type_id')) {
            Schema::table('upr_categories', function (Blueprint $table) {
                $table->unsignedBigInteger('upr_type_id')->nullable()->after('upr_cycle_id');
            });
        }

        // Prefer type from the cycle's former upr_type_id when still present.
        if (Schema::hasColumn('upr_cycles', 'upr_type_id')) {
            DB::statement('
                UPDATE upr_categories c
                INNER JOIN upr_cycles cy ON cy.id = c.upr_cycle_id
                SET c.upr_type_id = cy.upr_type_id
                WHERE c.upr_type_id IS NULL AND cy.upr_type_id IS NOT NULL
            ');
        }

        // Backfill from UPR entries that already link category → type.
        if (Schema::hasTable('upr_entries')) {
            DB::statement('
                UPDATE upr_categories c
                INNER JOIN (
                    SELECT upr_category_id, MIN(upr_type_id) AS upr_type_id
                    FROM upr_entries
                    WHERE upr_category_id IS NOT NULL AND upr_type_id IS NOT NULL
                    GROUP BY upr_category_id
                ) e ON e.upr_category_id = c.id
                SET c.upr_type_id = e.upr_type_id
                WHERE c.upr_type_id IS NULL
            ');
        }

        $fallbackTypeId = DB::table('upr_types')->where('is_active', true)->orderBy('id')->value('id')
            ?? DB::table('upr_types')->orderBy('id')->value('id');
        if ($fallbackTypeId) {
            DB::table('upr_categories')->whereNull('upr_type_id')->update(['upr_type_id' => $fallbackTypeId]);
        }

        // FK may use the unique index prefix — drop FK before dropping unique.
        Schema::table('upr_categories', function (Blueprint $table) {
            try {
                $table->dropForeign(['upr_cycle_id']);
            } catch (\Throwable) {
                // Already dropped.
            }
        });

        $this->dropIndexIfExists('upr_categories', 'upr_categories_upr_cycle_id_name_unique');
        $this->dropIndexIfExists('upr_categories', 'upr_categories_cycle_type_name_unique');

        // Deduplicate category names within (cycle, type) before unique.
        $dupCats = DB::table('upr_categories')
            ->select('upr_cycle_id', 'upr_type_id', 'name', DB::raw('COUNT(*) as cnt'))
            ->groupBy('upr_cycle_id', 'upr_type_id', 'name')
            ->having('cnt', '>', 1)
            ->get();
        foreach ($dupCats as $dup) {
            $rows = DB::table('upr_categories')
                ->where('upr_cycle_id', $dup->upr_cycle_id)
                ->where('upr_type_id', $dup->upr_type_id)
                ->where('name', $dup->name)
                ->orderBy('id')
                ->get();
            foreach ($rows as $i => $row) {
                if ($i === 0) {
                    continue;
                }
                DB::table('upr_categories')->where('id', $row->id)->update([
                    'name' => $row->name.' ('.$row->id.')',
                ]);
            }
        }

        if (! $this->indexExists('upr_categories', 'upr_categories_upr_type_id_foreign')) {
            Schema::table('upr_categories', function (Blueprint $table) {
                $table->foreign('upr_type_id')->references('id')->on('upr_types')->cascadeOnDelete();
            });
        }

        if (! $this->indexExists('upr_categories', 'upr_categories_upr_cycle_id_foreign')) {
            Schema::table('upr_categories', function (Blueprint $table) {
                $table->foreign('upr_cycle_id')->references('id')->on('upr_cycles')->nullOnDelete();
            });
        }

        if (! $this->indexExists('upr_categories', 'upr_categories_cycle_type_name_unique')) {
            Schema::table('upr_categories', function (Blueprint $table) {
                $table->unique(['upr_cycle_id', 'upr_type_id', 'name'], 'upr_categories_cycle_type_name_unique');
            });
        }

        // Cycles: drop type FK/column and make name globally unique.
        if (Schema::hasColumn('upr_cycles', 'upr_type_id')) {
            Schema::table('upr_cycles', function (Blueprint $table) {
                try {
                    $table->dropForeign(['upr_type_id']);
                } catch (\Throwable) {
                    // Already dropped.
                }
            });

            $this->dropIndexIfExists('upr_cycles', 'upr_cycles_upr_type_id_name_unique');
            $this->dropIndexIfExists('upr_cycles', 'upr_cycles_upr_type_id_foreign');

            // Deduplicate cycle names before global unique.
            $dupCycles = DB::table('upr_cycles')
                ->select('name', DB::raw('COUNT(*) as cnt'))
                ->groupBy('name')
                ->having('cnt', '>', 1)
                ->get();
            foreach ($dupCycles as $dup) {
                $rows = DB::table('upr_cycles')->where('name', $dup->name)->orderBy('id')->get();
                foreach ($rows as $i => $row) {
                    if ($i === 0) {
                        continue;
                    }
                    DB::table('upr_cycles')->where('id', $row->id)->update([
                        'name' => $row->name.' ('.$row->id.')',
                    ]);
                }
            }

            Schema::table('upr_cycles', function (Blueprint $table) {
                $table->dropColumn('upr_type_id');
            });
        }

        if (! $this->indexExists('upr_cycles', 'upr_cycles_name_unique')) {
            Schema::table('upr_cycles', function (Blueprint $table) {
                $table->unique('name');
            });
        }
    }

    public function down(): void
    {
        $this->dropIndexIfExists('upr_cycles', 'upr_cycles_name_unique');

        if (! Schema::hasColumn('upr_cycles', 'upr_type_id')) {
            Schema::table('upr_cycles', function (Blueprint $table) {
                $table->unsignedBigInteger('upr_type_id')->nullable()->after('id');
            });
            Schema::table('upr_cycles', function (Blueprint $table) {
                $table->foreign('upr_type_id')->references('id')->on('upr_types')->nullOnDelete();
                $table->unique(['upr_type_id', 'name']);
            });
        }

        $this->dropIndexIfExists('upr_categories', 'upr_categories_cycle_type_name_unique');

        Schema::table('upr_categories', function (Blueprint $table) {
            try {
                $table->dropForeign(['upr_type_id']);
            } catch (\Throwable) {
                // ignore
            }
        });

        if (Schema::hasColumn('upr_categories', 'upr_type_id')) {
            Schema::table('upr_categories', function (Blueprint $table) {
                $table->dropColumn('upr_type_id');
            });
        }

        if (! $this->indexExists('upr_categories', 'upr_categories_upr_cycle_id_name_unique')) {
            Schema::table('upr_categories', function (Blueprint $table) {
                $table->unique(['upr_cycle_id', 'name']);
            });
        }
    }

    private function indexExists(string $table, string $index): bool
    {
        $dbName = DB::getDatabaseName();

        return DB::table('information_schema.statistics')
            ->where('table_schema', $dbName)
            ->where('table_name', $table)
            ->where('index_name', $index)
            ->exists();
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        if (! $this->indexExists($table, $index)) {
            return;
        }
        DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$index}`");
    }
};
