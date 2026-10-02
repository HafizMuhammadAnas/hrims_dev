<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('knowledge_upr_entries', 'upr_type_id')) {
            Schema::table('knowledge_upr_entries', function (Blueprint $table) {
                $table->unsignedBigInteger('upr_type_id')->nullable()->after('kind');
            });
        }

        // Backfill from legacy kind string matched to upr_types.name (case-insensitive).
        $types = DB::table('upr_types')->get(['id', 'name']);
        foreach ($types as $type) {
            DB::table('knowledge_upr_entries')
                ->whereNull('upr_type_id')
                ->whereRaw('LOWER(kind) = ?', [strtolower((string) $type->name)])
                ->update(['upr_type_id' => $type->id]);
        }

        // Map legacy "others" (and any remaining) to first available type.
        $fallbackTypeId = DB::table('upr_types')->where('is_active', true)->orderBy('id')->value('id')
            ?? DB::table('upr_types')->orderBy('id')->value('id');
        if ($fallbackTypeId) {
            DB::table('knowledge_upr_entries')->whereNull('upr_type_id')->update(['upr_type_id' => $fallbackTypeId]);
        }

        Schema::table('knowledge_upr_entries', function (Blueprint $table) {
            try {
                $table->foreign('upr_type_id')->references('id')->on('upr_types')->nullOnDelete();
            } catch (\Throwable) {
                // Already exists.
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('knowledge_upr_entries', 'upr_type_id')) {
            return;
        }
        Schema::table('knowledge_upr_entries', function (Blueprint $table) {
            try {
                $table->dropForeign(['upr_type_id']);
            } catch (\Throwable) {
                // ignore
            }
            $table->dropColumn('upr_type_id');
        });
    }
};
