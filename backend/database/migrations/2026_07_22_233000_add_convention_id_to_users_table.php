<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users') || Schema::hasColumn('users', 'convention_id')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('convention_id')
                ->nullable()
                ->after('department_id')
                ->constrained('conventions')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasColumn('users', 'convention_id')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('convention_id');
        });
    }
};
