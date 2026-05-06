<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Region;
use Illuminate\Database\Seeder;

class DepartmentCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            ['suffix' => 'HEALTH', 'title' => 'Department of Health', 'type' => 'health'],
            ['suffix' => 'EDU', 'title' => 'Department of Education', 'type' => 'education'],
            ['suffix' => 'LAW', 'title' => 'Law & Justice', 'type' => 'law'],
            ['suffix' => 'SW', 'title' => 'Social Welfare', 'type' => 'social'],
            ['suffix' => 'LABOR', 'title' => 'Labor & Human Resource', 'type' => 'labor'],
            ['suffix' => 'POLICE', 'title' => 'Police', 'type' => 'law'],
        ];

        /** Region slug => department code prefix (Punjab keeps historic SEC-* codes). */
        $provincialPrefixes = [
            'punjab' => 'SEC',
            'sindh' => 'SIN',
            'balochistan' => 'BAL',
            'kpk' => 'KPK',
            'islamabad' => 'ISB',
            'gb' => 'GB',
            'ajk' => 'AJK',
        ];

        foreach ($provincialPrefixes as $slug => $prefix) {
            $region = Region::query()->where('slug', $slug)->first();
            if (! $region) {
                continue;
            }
            foreach ($templates as $tpl) {
                $code = "{$prefix}-{$tpl['suffix']}";
                $name = "{$region->name} — {$tpl['title']}";
                $dept = Department::query()->updateOrCreate(
                    ['code' => $code],
                    ['name' => $name, 'type' => $tpl['type']]
                );
                $dept->regions()->syncWithoutDetaching([$region->id]);
            }
        }

        $ict = Region::query()->where('slug', 'ict')->first();
        $federalRows = [
            ['code' => 'FED-HEALTH', 'name' => 'Federal — Health', 'type' => 'health'],
            ['code' => 'FED-EDU', 'name' => 'Federal — Education', 'type' => 'education'],
            ['code' => 'FED-LAW', 'name' => 'Federal — Law & Justice', 'type' => 'law'],
        ];

        foreach ($federalRows as $row) {
            $dept = Department::query()->updateOrCreate(
                ['code' => $row['code']],
                ['name' => $row['name'], 'type' => $row['type']]
            );
            if ($ict) {
                $dept->regions()->syncWithoutDetaching([$ict->id]);
            }
        }
    }
}
