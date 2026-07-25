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

    public static function isFederalAdmin(User $user): bool
    {
        return $user->hasRole('federal_admin');
    }

    public static function isConventionAdmin(User $user): bool
    {
        return $user->hasRole('convention_admin');
    }

    public static function conventionId(User $user): ?int
    {
        if (! self::isConventionAdmin($user) || $user->convention_id === null) {
            return null;
        }

        return (int) $user->convention_id;
    }

    /**
     * Federal / convention / super operators of the national request–response workflow
     * (not regional or department).
     */
    public static function isNationalWorkflowOperator(User $user): bool
    {
        return self::isSuperAdmin($user)
            || self::isFederalAdmin($user)
            || self::isConventionAdmin($user);
    }

    public static function seesAllRegions(User $user): bool
    {
        return self::isNationalWorkflowOperator($user);
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
     * Convention admins see all statuses for their convention only.
     */
    public static function applyHrRequestScope(Builder $query, User $user): void
    {
        if (self::isSuperAdmin($user) || self::isFederalAdmin($user)) {
            return;
        }

        if (self::isConventionAdmin($user)) {
            $cid = self::conventionId($user);
            if ($cid === null) {
                $query->whereRaw('1 = 0');

                return;
            }
            $query->where('convention_id', $cid);

            return;
        }

        // Draft requests are federal-only until published (status = active).
        $query->where('status', 'active');

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
     * Apply convention filter when the actor is a convention admin (no-op otherwise).
     */
    public static function applyConventionScopeToHrRequests(Builder $query, User $user): void
    {
        $cid = self::conventionId($user);
        if ($cid === null) {
            return;
        }
        $query->where('convention_id', $cid);
    }

    /**
     * Scope a query that relates to hr_requests (e.g. clarifications, compiled records).
     */
    public static function applyConventionScopeToRelated(Builder $query, User $user, string $relation = 'hrRequest'): void
    {
        $cid = self::conventionId($user);
        if ($cid === null) {
            return;
        }
        $query->whereHas($relation, fn (Builder $q) => $q->where('convention_id', $cid));
    }

    public static function hrRequestBelongsToUserConvention(User $user, HrRequest $model): bool
    {
        $cid = self::conventionId($user);
        if ($cid === null) {
            return true;
        }

        return (int) ($model->convention_id ?? 0) === $cid;
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
        if (self::isSuperAdmin($user) || self::isFederalAdmin($user)) {
            return true;
        }

        if (self::isConventionAdmin($user)) {
            return self::hrRequestBelongsToUserConvention($user, $model);
        }

        if ($model->status !== 'active') {
            return false;
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
     * Full create/update/delete on HR requests. Federal and convention admins may use any region;
     * regional administrators are limited to their assigned region in controllers.
     */
    public static function canManageHrRequests(User $user): bool
    {
        return self::isSuperAdmin($user)
            || self::isFederalAdmin($user)
            || self::isConventionAdmin($user)
            || $user->hasRole('regional_admin');
    }
}
