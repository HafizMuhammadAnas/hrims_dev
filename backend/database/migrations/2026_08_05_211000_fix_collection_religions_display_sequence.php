<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent fix: ensure collection_religions sort_order (and display names)
 * match Muslim → Christianity → Hindu → Sikh → Ahmadiyya → Others.
 * Handles both legacy plurals (Muslims, Christians, …) and already-renamed rows.
 */
return new class extends Migration
{
    /**
     * @return list<array{names: list<string>, to: string, sort_order: int}>
     */
    private function preferredSequence(): array
    {
        return [
            ['names' => ['Muslims', 'Muslim'], 'to' => 'Muslim', 'sort_order' => 1],
            ['names' => ['Christians', 'Christianity', 'Christian'], 'to' => 'Christianity', 'sort_order' => 2],
            ['names' => ['Hindus', 'Hindu'], 'to' => 'Hindu', 'sort_order' => 3],
            ['names' => ['Sikhs', 'Sikh'], 'to' => 'Sikh', 'sort_order' => 4],
            ['names' => ['Ahmadiyya', 'Ahmadis', 'Ahmadi'], 'to' => 'Ahmadiyya', 'sort_order' => 5],
            ['names' => ['Others', 'Other'], 'to' => 'Others', 'sort_order' => 6],
        ];
    }

    public function up(): void
    {
        if (! Schema::hasTable('collection_religions')) {
            return;
        }

        $now = now();
        $preferredIds = [];

        foreach ($this->preferredSequence() as $row) {
            $record = DB::table('collection_religions')
                ->whereIn('name', $row['names'])
                ->orderBy('id')
                ->first();

            if (! $record) {
                continue;
            }

            DB::table('collection_religions')
                ->where('id', $record->id)
                ->update([
                    'name' => $row['to'],
                    'sort_order' => $row['sort_order'],
                    'updated_at' => $now,
                ]);

            $preferredIds[] = (int) $record->id;
        }

        $rest = DB::table('collection_religions')
            ->when($preferredIds !== [], fn ($q) => $q->whereNotIn('id', $preferredIds))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id']);

        $next = count($this->preferredSequence()) + 1;
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
        // Intentional no-op: display labels/order are product preference, not reversible schema.
    }
};
