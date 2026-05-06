<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\RbacRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DepartmentUsersSeeder extends Seeder
{
    /**
     * Creates one active department_admin per department linked to a region (pivot row).
     * Password for all: {@see DevUserSeeder} same convention — `password` (change in production).
     *
     * Username pattern: `{region_slug}_{department_code}` with hyphens in code turned into underscores,
     * e.g. punjab_sec_edu, sindh_sin_health, ict_fed_health.
     */
    public function run(): void
    {
        $role = RbacRole::query()->where('slug', 'department_admin')->firstOrFail();

        $departments = Department::query()->with('regions')->orderBy('id')->get();

        foreach ($departments as $dept) {
            foreach ($dept->regions as $region) {
                $username = $this->usernameFor($region->slug, $dept->code);

                $user = User::query()->updateOrCreate(
                    ['username' => $username],
                    [
                        'name' => "{$region->name} — {$dept->name}",
                        'email' => "{$username}@dept.example.test",
                        'password' => Hash::make('password'),
                        'region_id' => $region->id,
                        'department_id' => $dept->id,
                        'is_active' => true,
                    ]
                );

                $user->roles()->sync([$role->id]);
            }
        }
    }

    private function usernameFor(string $regionSlug, string $deptCode): string
    {
        $codePart = Str::lower(str_replace('-', '_', $deptCode));

        return Str::lower($regionSlug).'_'.$codePart;
    }
}
