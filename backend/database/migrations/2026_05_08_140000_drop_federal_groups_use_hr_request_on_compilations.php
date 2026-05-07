<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function dropForeignKeyOnColumn(string $table, string $column): void
    {
        if (! Schema::hasColumn($table, $column)) {
            return;
        }

        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if ($driver === 'mysql') {
            $db = $connection->getDatabaseName();
            $rows = $connection->select(
                'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL',
                [$db, $table, $column]
            );
            foreach ($rows as $row) {
                $name = $row->CONSTRAINT_NAME ?? $row->constraint_name ?? null;
                if ($name) {
                    $connection->statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$name}`");
                }
            }
        } else {
            Schema::table($table, function (Blueprint $blueprint) use ($column) {
                try {
                    $blueprint->dropForeign([$column]);
                } catch (\Throwable) {
                    // SQLite / legacy installs without a named FK
                }
            });
        }

        Schema::table($table, function (Blueprint $blueprint) use ($column) {
            $blueprint->dropColumn($column);
        });
    }

    public function up(): void
    {
        if (! Schema::hasColumn('compiled_records', 'hr_request_id')) {
            Schema::table('compiled_records', function (Blueprint $table) {
                $table->string('hr_request_id', 64)->nullable()->after('id');
            });
        }

        if (! $this->foreignKeyExists('compiled_records', 'hr_request_id')) {
            Schema::table('compiled_records', function (Blueprint $table) {
                $table->foreign('hr_request_id')->references('id')->on('hr_requests')->nullOnDelete();
            });
        }

        $this->dropForeignKeyOnColumn('regional_responses', 'federal_group_id');
        $this->dropForeignKeyOnColumn('hr_requests', 'federal_group_id');
        $this->dropForeignKeyOnColumn('compiled_records', 'federal_group_id');

        Schema::dropIfExists('federal_group_hr_request');
        Schema::dropIfExists('federal_groups');
    }

    private function foreignKeyExists(string $table, string $column): bool
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return false;
        }

        $db = Schema::getConnection()->getDatabaseName();
        $rows = DB::select(
            'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL',
            [$db, $table, $column]
        );

        return count($rows) > 0;
    }

    public function down(): void
    {
        // Forward-only: restoring federal_groups would require recreating seed data and FKs.
    }
};
