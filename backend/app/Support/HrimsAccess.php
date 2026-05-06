<?php

namespace App\Support;

use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class HrimsAccess
{
    public static function isSuperAdmin(User $user): bool
    {
        return $user->hasRole('super_admin');
    }

    public static function seesAllRegions(User $user): bool
    {
        return $user->hasRole('super_admin') || $user->hasRole('federal_admin');
    }

    /**
     * @return list<int>|null null = no filter (all regions)
     */
    public static function scopedRegionIds(User $user): ?array
    {
        if (self::seesAllRegions($user)) {
            return null;
        }

        if ($user->hasRole('department_admin') || $user->hasRole('viewer')) {
            return null;
        }

        if ($user->region_id !== null) {
            return [(int) $user->region_id];
        }

        return [];
    }

    /**
     * Limit HR requests for dashboards, listings, and federal-group linkage.
     * Department users only see requests their department is assigned to.
     */
    public static function applyHrRequestScope(Builder $query, User $user): void
    {
        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            return;
        }

        if ($user->hasRole('regional_admin') && $user->region_id !== null) {
            $rid = (int) $user->region_id;
            $query->where(function (Builder $q) use ($rid) {
                $q->where('region_id', $rid)
                    ->orWhereHas('regions', fn (Builder $r) => $r->where('regions.id', $rid));
            });

            return;
        }

        if (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $ids = self::hrRequestIdsForDepartmentUser($user);
            if ($ids === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('id', $ids);
            }

            return;
        }

        $query->whereRaw('1 = 0');
    }

    /**
     * @return list<string>
     */
    public static function hrRequestIdsForDepartmentUser(User $user): array
    {
        if (! $user->department_id) {
            return [];
        }

        return DepartmentTask::query()
            ->where('department_id', $user->department_id)
            ->pluck('hr_request_id')
            ->unique()
            ->values()
            ->all();
    }

    public static function userMayViewHrRequest(User $user, HrRequest $model): bool
    {
        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            return true;
        }

        if ($user->hasRole('regional_admin') && $user->region_id !== null) {
            $rid = (int) $user->region_id;

            return (int) $model->region_id === $rid
                || $model->regions()->where('regions.id', $rid)->exists();
        }

        if (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            return DepartmentTask::query()
                ->where('department_id', $user->department_id)
                ->where('hr_request_id', $model->id)
                ->exists();
        }

        return false;
    }

    /**
     * Whether to hide department submission text from the API. Regional admins need payloads
     * to review distributed tasks (accept / request modification).
     */
    public static function redactDepartmentTaskPayloadFor(User $user): bool
    {
        return false;
    }

    /**
     * Full create/update/delete on HR requests. Federal users may use any region;
     * regional administrators are limited to their assigned region in controllers.
     */
    public static function canManageHrRequests(User $user): bool
    {
        return $user->hasRole('super_admin')
            || $user->hasRole('federal_admin')
            || $user->hasRole('regional_admin');
    }
}
