<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DevUserSeeder extends Seeder
{
    /**
     * Development logins (password for all: `password`) — change after deploy.
     *
     * - superadmin — Super administrator (catalog + create federal/regional admins)
     * - federal — Federal admin
     * - punjab_admin — Regional admin (Punjab)
     * - punjab_edu — Department admin (if SEC-EDU department exists)
     */
    public function run(): void
    {
        $super = User::query()->updateOrCreate(
            ['username' => 'superadmin'],
            [
                'name' => 'Super Administrator',
                'email' => 'super@example.test',
                'password' => Hash::make('password'),
                'region_id' => null,
                'department_id' => null,
                'is_active' => true,
            ]
        );
        $superRole = RbacRole::query()->where('slug', 'super_admin')->firstOrFail();
        $super->roles()->sync([$superRole->id]);

        $federalRegion = Region::query()->where('slug', 'federal')->firstOrFail();

        $user = User::query()->updateOrCreate(
            ['username' => 'federal'],
            [
                'name' => 'Federal Admin',
                'email' => 'federal@example.test',
                'password' => Hash::make('password'),
                'region_id' => $federalRegion->id,
                'department_id' => null,
                'is_active' => true,
            ]
        );

        $role = RbacRole::query()->where('slug', 'federal_admin')->firstOrFail();
        $user->roles()->sync([$role->id]);

        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $regional = User::query()->updateOrCreate(
            ['username' => 'punjab_admin'],
            [
                'name' => 'Punjab regional admin',
                'email' => 'punjab@example.test',
                'password' => Hash::make('password'),
                'region_id' => $punjab->id,
                'department_id' => null,
                'is_active' => true,
            ]
        );
        $regionalRole = RbacRole::query()->where('slug', 'regional_admin')->firstOrFail();
        $regional->roles()->sync([$regionalRole->id]);

        $eduDept = Department::query()->where('code', 'SEC-EDU')->first();
        if ($eduDept) {
            $deptUser = User::query()->updateOrCreate(
                ['username' => 'punjab_edu'],
                [
                    'name' => 'Punjab Education (department)',
                    'email' => 'punjab.edu@example.test',
                    'password' => Hash::make('password'),
                    'region_id' => $punjab->id,
                    'department_id' => $eduDept->id,
                    'is_active' => true,
                ]
            );
            $deptRole = RbacRole::query()->where('slug', 'department_admin')->firstOrFail();
            $deptUser->roles()->sync([$deptRole->id]);
        }
    }
}
