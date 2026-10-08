<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $roleId = DB::table('rbac_roles')->where('slug', 'department_validator')->value('id');

        if ($roleId !== null) {
            $userIds = DB::table('rbac_user_role')
                ->where('role_id', $roleId)
                ->pluck('user_id')
                ->unique()
                ->values()
                ->all();

            if ($userIds !== []) {
                DB::table('rbac_user_role')->whereIn('user_id', $userIds)->delete();
                DB::table('notifications')->whereIn('user_id', $userIds)->delete();
                DB::table('users')->whereIn('id', $userIds)->delete();
            }

            DB::table('rbac_role_permission')->where('role_id', $roleId)->delete();
            DB::table('rbac_user_role')->where('role_id', $roleId)->delete();
            DB::table('rbac_roles')->where('id', $roleId)->delete();
        }

        if (Schema::hasColumn('department_tasks', 'department_validation_status')) {
            // Validator returns become regional revision so operators can still resubmit.
            DB::table('department_tasks')
                ->where('department_validation_status', 'needs-modification')
                ->update([
                    'regional_review_status' => 'needs-modification',
                    'department_validation_status' => 'accepted',
                    'department_validation_comments' => null,
                ]);

            // Pending validation → under review for regional/federal.
            DB::table('department_tasks')
                ->where('status', 'submitted')
                ->where(function ($q) {
                    $q->whereNull('department_validation_status')
                        ->orWhere('department_validation_status', '!=', 'accepted');
                })
                ->update([
                    'department_validation_status' => 'accepted',
                    'department_validation_comments' => null,
                ]);
        }

        DB::table('notifications')
            ->whereIn('event_key', [
                'department_task.pending_validation',
                'department_task.validation_returned',
            ])
            ->delete();

        DB::table('rbac_roles')
            ->where('slug', 'department_admin')
            ->update([
                'name' => 'Departmental administrator',
                'description' => 'Department data entry and submission',
            ]);
    }

    public function down(): void
    {
        // Role removal is intentional; do not recreate validator users.
        if (! DB::table('rbac_roles')->where('slug', 'department_validator')->exists()) {
            $roleId = DB::table('rbac_roles')->insertGetId([
                'slug' => 'department_validator',
                'name' => 'Departmental validator',
                'description' => 'Department internal validation before regional/federal review',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $permIds = DB::table('rbac_permissions')
                ->whereIn('slug', ['dashboard.view', 'requests.manage'])
                ->pluck('id');

            foreach ($permIds as $permId) {
                DB::table('rbac_role_permission')->insert([
                    'role_id' => $roleId,
                    'permission_id' => $permId,
                ]);
            }
        }

        DB::table('rbac_roles')
            ->where('slug', 'department_admin')
            ->update([
                'name' => 'Departmental data entry operator',
                'description' => 'Department data entry and submission',
            ]);
    }
};
