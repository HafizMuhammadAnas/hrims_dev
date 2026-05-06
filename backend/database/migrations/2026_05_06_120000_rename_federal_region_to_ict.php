<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('regions')->where('slug', 'federal')->update([
            'name' => 'ICT',
            'slug' => 'ict',
        ]);
    }

    public function down(): void
    {
        DB::table('regions')->where('slug', 'ict')->update([
            'name' => 'Federal',
            'slug' => 'federal',
        ]);
    }
};
