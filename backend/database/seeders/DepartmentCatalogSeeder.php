<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Region;
use Illuminate\Database\Seeder;

class DepartmentCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $punjabId = Region::query()->where('slug', 'punjab')->value('id');
        $federalId = Region::query()->where('slug', 'federal')->value('id');

        $punjabRows = [
            ['code' => 'SEC-HEALTH', 'name' => 'Punjab — Department of Health', 'type' => 'health'],
            ['code' => 'SEC-EDU', 'name' => 'Punjab — Department of Education', 'type' => 'education'],
            ['code' => 'SEC-LAW', 'name' => 'Punjab — Law & Justice', 'type' => 'law'],
            ['code' => 'SEC-SW', 'name' => 'Punjab — Social Welfare', 'type' => 'social'],
            ['code' => 'SEC-LABOR', 'name' => 'Punjab — Labor & Human Resource', 'type' => 'labor'],
            ['code' => 'SEC-POLICE', 'name' => 'Punjab — Police', 'type' => 'law'],
        ];

        foreach ($punjabRows as $row) {
            $dept = Department::query()->updateOrCreate(
                ['code' => $row['code']],
                ['name' => $row['name'], 'type' => $row['type']]
            );
            if ($punjabId) {
                $dept->regions()->syncWithoutDetaching([(int) $punjabId]);
            }
        }

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
            if ($federalId) {
                $dept->regions()->syncWithoutDetaching([(int) $federalId]);
            }
        }
    }
}
