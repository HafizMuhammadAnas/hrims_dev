<?php

namespace Database\Seeders;

use App\Models\Region;
use Illuminate\Database\Seeder;

class RegionSeeder extends Seeder
{
    public function run(): void
    {
        $regions = [
            ['name' => 'ICT', 'slug' => 'ict'],
            ['name' => 'Punjab', 'slug' => 'punjab'],
            ['name' => 'Sindh', 'slug' => 'sindh'],
            ['name' => 'Balochistan', 'slug' => 'balochistan'],
            ['name' => 'KPK', 'slug' => 'kpk'],
            ['name' => 'Islamabad', 'slug' => 'islamabad'],
            ['name' => 'GB', 'slug' => 'gb'],
            ['name' => 'AJK', 'slug' => 'ajk'],
        ];

        foreach ($regions as $row) {
            Region::query()->updateOrCreate(['slug' => $row['slug']], $row);
        }
    }
}
