<?php

namespace Database\Seeders;

use App\Models\RbacPermission;
use App\Models\RbacRole;
use Illuminate\Database\Seeder;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['slug' => 'super_admin', 'name' => 'Super administrator', 'description' => 'System catalog and top-level user provisioning'],
            ['slug' => 'federal_admin', 'name' => 'Federal administrator', 'description' => 'National scope'],
            ['slug' => 'federal_sub_admin', 'name' => 'Federal sub user', 'description' => 'Federal scope without user or department management'],
            ['slug' => 'regional_admin', 'name' => 'Regional administrator', 'description' => 'Regional focal person'],
            ['slug' => 'department_admin', 'name' => 'Departmental administrator', 'description' => 'Department data entry and submission'],
            ['slug' => 'viewer', 'name' => 'Viewer', 'description' => 'Read-only'],
        ];

        foreach ($roles as $row) {
            RbacRole::query()->updateOrCreate(['slug' => $row['slug']], $row);
        }

        // Drop legacy validator role if a prior seed created it.
        $legacyValidator = RbacRole::query()->where('slug', 'department_validator')->first();
        if ($legacyValidator) {
            $legacyValidator->permissions()->detach();
            $legacyValidator->users()->detach();
            $legacyValidator->delete();
        }

        $permissions = [
            ['slug' => 'dashboard.view', 'name' => 'View dashboard'],
            ['slug' => 'users.manage', 'name' => 'Manage users'],
            ['slug' => 'requests.manage', 'name' => 'Manage HR requests'],
            ['slug' => 'catalog.manage', 'name' => 'Manage reference catalog'],
        ];

        foreach ($permissions as $row) {
            RbacPermission::query()->updateOrCreate(['slug' => $row['slug']], $row);
        }

        $matrix = [
            'super_admin' => ['dashboard.view', 'users.manage', 'requests.manage', 'catalog.manage'],
            'federal_admin' => ['dashboard.view', 'users.manage', 'requests.manage'],
            'federal_sub_admin' => ['dashboard.view', 'requests.manage'],
            'regional_admin' => ['dashboard.view', 'users.manage', 'requests.manage'],
            'department_admin' => ['dashboard.view', 'requests.manage'],
            'viewer' => ['dashboard.view'],
        ];

        foreach ($matrix as $roleSlug => $permSlugs) {
            $role = RbacRole::query()->where('slug', $roleSlug)->firstOrFail();
            $ids = RbacPermission::query()->whereIn('slug', $permSlugs)->pluck('id');
            $role->permissions()->sync($ids);
        }
    }
}
