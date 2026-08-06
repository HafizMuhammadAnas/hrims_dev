<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Preferred religion column order for department forms and views.
     *
     * @return list<array{from: string, to: string, sort_order: int}>
     */
    public static function preferredSequence(): array
    {
        return [
            ['from' => 'Muslims', 'to' => 'Muslim', 'sort_order' => 1],
            ['from' => 'Christians', 'to' => 'Christianity', 'sort_order' => 2],
            ['from' => 'Hindus', 'to' => 'Hindu', 'sort_order' => 3],
            ['from' => 'Sikhs', 'to' => 'Sikh', 'sort_order' => 4],
            ['from' => 'Ahmadiyya', 'to' => 'Ahmadiyya', 'sort_order' => 5],
            ['from' => 'Others', 'to' => 'Others', 'sort_order' => 6],
        ];
    }

    public function up(): void
    {
        if (! Schema::hasTable('collection_religions')) {
            return;
        }

        $now = now();
        $claimed = [];

        foreach (self::preferredSequence() as $row) {
            $updated = DB::table('collection_religions')
                ->where('name', $row['from'])
                ->update([
                    'name' => $row['to'],
                    'sort_order' => $row['sort_order'],
                    'updated_at' => $now,
                ]);

            if ($updated === 0 && $row['from'] !== $row['to']) {
                DB::table('collection_religions')
                    ->where('name', $row['to'])
                    ->update([
                        'sort_order' => $row['sort_order'],
                        'updated_at' => $now,
                    ]);
            }

            $claimed[] = $row['to'];
            $claimed[] = $row['from'];
        }

        $rest = DB::table('collection_religions')
            ->whereNotIn('name', array_values(array_unique($claimed)))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id']);

        $next = count(self::preferredSequence()) + 1;
        foreach ($rest as $r) {
            DB::table('collection_religions')
                ->where('id', $r->id)
                ->update([
                    'sort_order' => $next++,
                    'updated_at' => $now,
                ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('collection_religions')) {
            return;
        }

        $now = now();
        $revert = [
            'Muslim' => 'Muslims',
            'Christianity' => 'Christians',
            'Hindu' => 'Hindus',
            'Sikh' => 'Sikhs',
        ];

        foreach ($revert as $from => $to) {
            DB::table('collection_religions')
                ->where('name', $from)
                ->update([
                    'name' => $to,
                    'updated_at' => $now,
                ]);
        }
    }
};
