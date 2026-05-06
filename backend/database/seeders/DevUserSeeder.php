<?php

namespace Database\Seeders;

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
     * Department logins are created by {@see DepartmentUsersSeeder} (username like punjab_sec_edu).
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

        $federalRegion = Region::query()->where('slug', 'ict')->firstOrFail();

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
    }
}
