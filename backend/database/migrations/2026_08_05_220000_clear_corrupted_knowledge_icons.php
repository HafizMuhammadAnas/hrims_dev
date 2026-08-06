<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seeded emoji icons that travelled through a non-utf8mb4 connection collapsed to
 * literal "?" placeholders, which render as broken glyphs in the Knowledge Hub.
 * Clearing them — along with the remaining seeded emoji, so one section does not mix
 * emoji with placeholders — lets the frontend render its built-in vector icons.
 */
return new class extends Migration
{
    /**
     * `knowledge_cards.icon` is NOT NULL, so it is blanked instead of nulled.
     *
     * @return list<array{table: string, column: string, cleared: string|null}>
     */
    private function targets(): array
    {
        return [
            ['table' => 'conventions', 'column' => 'knowledge_icon', 'cleared' => null],
            ['table' => 'sdg_nodes', 'column' => 'knowledge_icon', 'cleared' => null],
            ['table' => 'knowledge_cards', 'column' => 'icon', 'cleared' => ''],
        ];
    }

    /**
     * Emoji previously written by ReferenceCatalogKnowledgeSeeder; only the
     * three-byte ones survived the import, the rest arrived as "?".
     *
     * @return list<string>
     */
    private function legacySeededGlyphs(): array
    {
        return [
            '📜', '⚖', '🏛', '👩', '🛡', '👶', '♿',
            '🎯', '🌾', '❤', '📚', '💧', '⚡', '📈', '🏭', '🤝', '🏙', '♻', '🌍', '🐟', '🌳', '🕊', '🔗',
            '🏥', '💼', '🏠', '🍎', '📊', '✅', '📝',
        ];
    }

    private function normalize(string $icon): string
    {
        // Drop variation selectors / zero-width marks left behind by a mangled emoji.
        $stripped = preg_replace('/[\x{FE0E}\x{FE0F}\x{200B}-\x{200D}\x{2060}]/u', '', $icon) ?? $icon;

        return trim($stripped);
    }

    private function shouldClear(?string $icon): bool
    {
        if ($icon === null || $icon === '') {
            return false;
        }

        $stripped = $this->normalize($icon);

        if ($stripped === '') {
            return true;
        }

        if (preg_match('/^[?\x{FFFD}]+$/u', $stripped)) {
            return true;
        }

        return in_array($stripped, $this->legacySeededGlyphs(), true);
    }

    public function up(): void
    {
        foreach ($this->targets() as ['table' => $table, 'column' => $column, 'cleared' => $cleared]) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                continue;
            }

            $rows = DB::table($table)
                ->whereNotNull($column)
                ->get(['id', $column]);

            foreach ($rows as $row) {
                if (! $this->shouldClear($row->{$column})) {
                    continue;
                }

                DB::table($table)
                    ->where('id', $row->id)
                    ->update([$column => $cleared]);
            }
        }
    }

    public function down(): void
    {
        // Intentional no-op: the cleared values carried no recoverable information.
    }
};
