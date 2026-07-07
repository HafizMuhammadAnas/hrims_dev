<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE issues MODIFY issue_title TEXT NULL');
        }

        DB::table('issues')
            ->where('entry_kind', 'recommendation')
            ->where(function ($query) {
                $query->whereNull('description')->orWhere('description', '');
            })
            ->whereNotNull('issue_title')
            ->update([
                'description' => DB::raw('issue_title'),
            ]);

        DB::table('issues')
            ->where('entry_kind', 'recommendation')
            ->update(['issue_title' => null]);
    }

    public function down(): void
    {
        DB::table('issues')
            ->where('entry_kind', 'recommendation')
            ->whereNull('issue_title')
            ->whereNotNull('description')
            ->update([
                'issue_title' => DB::raw('CASE WHEN CHAR_LENGTH(description) > 500 THEN LEFT(description, 500) ELSE description END'),
            ]);

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE issues MODIFY issue_title TEXT NOT NULL');
        }
    }
};
