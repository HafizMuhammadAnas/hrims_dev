<?php

namespace Database\Seeders;

use App\Models\Convention;
use App\Models\RbacRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * One convention_admin login per active convention (dev / initial bootstrap).
 * Password for all: `password` — change after deploy.
 * Username pattern: {code_lower}_admin (e.g. cat_admin, crc_admin).
 */
class ConventionAdminSeeder extends Seeder
{
    public function run(): void
    {
        $role = RbacRole::query()->where('slug', 'convention_admin')->first();
        if (! $role) {
            return;
        }

        $conventions = Convention::query()->orderBy('id')->get(['id', 'code', 'name']);
        foreach ($conventions as $convention) {
            $code = strtoupper(trim((string) $convention->code));
            if ($code === '') {
                continue;
            }
            $username = Str::lower($code).'_admin';
            $user = User::query()->updateOrCreate(
                ['username' => $username],
                [
                    'name' => $code.' Convention Admin',
                    'email' => $username.'@example.test',
                    'password' => Hash::make('password'),
                    'region_id' => null,
                    'department_id' => null,
                    'convention_id' => (int) $convention->id,
                    'is_active' => true,
                ],
            );
            $user->roles()->sync([$role->id]);
            if ((int) $user->convention_id !== (int) $convention->id) {
                $user->convention_id = (int) $convention->id;
                $user->save();
            }
        }
    }
}
