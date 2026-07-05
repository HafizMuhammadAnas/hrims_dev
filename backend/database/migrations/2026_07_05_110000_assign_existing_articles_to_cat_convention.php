<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('articles', 'convention_id')) {
            return;
        }

        $catConventionId = DB::table('conventions')->where('code', 'CAT')->value('id');
        if ($catConventionId === null) {
            return;
        }

        DB::table('articles')->update(['convention_id' => $catConventionId]);
    }

    public function down(): void
    {
        // Data correction only; no rollback.
    }
};
