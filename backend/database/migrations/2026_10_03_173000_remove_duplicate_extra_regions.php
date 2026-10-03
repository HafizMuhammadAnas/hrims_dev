<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Remove regions KPK, Islamabad, GB, AJK from catalog.
 * - kpk → merge into kp (Khyber Pakhtunkhwa) when present
 * - islamabad → merge into ict when present
 * - gb / ajk → delete after clearing related rows
 */
return new class extends Migration
{
    /** @var list<string> */
    private array $removeSlugs = ['kpk', 'islamabad', 'gb', 'ajk'];

    public function up(): void
    {
        if (! Schema::hasTable('regions')) {
            return;
        }

        // If KP exists, fold KPK into it; otherwise rename KPK → Khyber Pakhtunkhwa.
        if (DB::table('regions')->where('slug', 'kp')->exists()) {
            $this->mergeRegionSlug('kpk', 'kp');
        } else {
            DB::table('regions')->where('slug', 'kpk')->update([
                'name' => 'Khyber Pakhtunkhwa',
                'slug' => 'kp',
            ]);
        }

        $this->mergeRegionSlug('islamabad', 'ict');

        foreach ($this->removeSlugs as $slug) {
            $this->forceDeleteRegionBySlug($slug);
        }
    }

    public function down(): void
    {
        // Intentionally empty — removed catalog rows are not restored.
    }

    private function mergeRegionSlug(string $fromSlug, string $toSlug): void
    {
        $from = DB::table('regions')->where('slug', $fromSlug)->first();
        $to = DB::table('regions')->where('slug', $toSlug)->first();
        if (! $from || ! $to || (int) $from->id === (int) $to->id) {
            return;
        }

        $fromId = (int) $from->id;
        $toId = (int) $to->id;

        if (Schema::hasTable('districts')) {
            $districts = DB::table('districts')->where('region_id', $fromId)->get();
            foreach ($districts as $d) {
                $exists = DB::table('districts')
                    ->where('region_id', $toId)
                    ->where('slug', $d->slug)
                    ->exists();
                if ($exists) {
                    DB::table('districts')->where('id', $d->id)->delete();
                } else {
                    DB::table('districts')->where('id', $d->id)->update(['region_id' => $toId]);
                }
            }
        }

        if (Schema::hasTable('department_region')) {
            $links = DB::table('department_region')->where('region_id', $fromId)->get();
            foreach ($links as $link) {
                DB::table('department_region')->insertOrIgnore([
                    'department_id' => $link->department_id,
                    'region_id' => $toId,
                ]);
            }
            DB::table('department_region')->where('region_id', $fromId)->delete();
        }

        if (Schema::hasTable('hr_request_region')) {
            $links = DB::table('hr_request_region')->where('region_id', $fromId)->get();
            foreach ($links as $link) {
                DB::table('hr_request_region')->insertOrIgnore([
                    'hr_request_id' => $link->hr_request_id,
                    'region_id' => $toId,
                ]);
            }
            DB::table('hr_request_region')->where('region_id', $fromId)->delete();
        }

        foreach (['users', 'hr_requests', 'regional_responses', 'department_tasks', 'violation_entries', 'hr_request_clarifications'] as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'region_id')) {
                continue;
            }
            DB::table($table)->where('region_id', $fromId)->update(['region_id' => $toId]);
        }
    }

    private function forceDeleteRegionBySlug(string $slug): void
    {
        $region = DB::table('regions')->where('slug', $slug)->first();
        if (! $region) {
            return;
        }
        $id = (int) $region->id;

        if (Schema::hasTable('districts')) {
            DB::table('districts')->where('region_id', $id)->delete();
        }
        if (Schema::hasTable('department_region')) {
            DB::table('department_region')->where('region_id', $id)->delete();
        }
        if (Schema::hasTable('hr_request_region')) {
            DB::table('hr_request_region')->where('region_id', $id)->delete();
        }
        if (Schema::hasTable('hr_request_clarifications')) {
            DB::table('hr_request_clarifications')->where('region_id', $id)->delete();
        }

        foreach (['users', 'hr_requests', 'regional_responses', 'department_tasks', 'violation_entries'] as $table) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'region_id')) {
                continue;
            }
            DB::table($table)->where('region_id', $id)->update(['region_id' => null]);
        }

        DB::table('regions')->where('id', $id)->delete();
    }
};
