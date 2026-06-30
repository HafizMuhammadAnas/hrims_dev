<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Official religion catalog for indicator disaggregation.
     *
     * @return list<string>
     */
    public static function officialReligionNames(): array
    {
        return [
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
    }

    public function up(): void
    {
        if (! Schema::hasTable('collection_religions')) {
            return;
        }

        if (Schema::hasTable('issue_indicator_year_religion')) {
            DB::table('issue_indicator_year_religion')->delete();
        }

        DB::table('collection_religions')->delete();

        $now = now();
        foreach (self::officialReligionNames() as $index => $name) {
            DB::table('collection_religions')->insert([
                'name' => $name,
                'sort_order' => $index + 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // No-op: prior placeholder catalog is not restored automatically.
    }
};
