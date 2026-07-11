<?php

namespace App\Support;

use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\Notification;
use App\Models\RegionalResponse;
use App\Models\User;
use Illuminate\Support\Collection;

class NotificationService
{
    public function notifyHrRequestCreated(HrRequest $requestModel, User $actor): void
    {
        if ($requestModel->status !== 'active') {
            return;
        }

        $this->notifyUsersWithRoutes(
            $this->usersForHrRequest($requestModel),
            $actor,
            'hr_request.created',
            'Request created',
            sprintf('%s created request %s.', $actor->name, $requestModel->id),
            'hr_request',
            $requestModel->id,
            fn (User $user) => $this->routeForHrRequest($user, $requestModel->id),
            [
                'status' => $requestModel->status,
            ],
        );
    }

    public function notifyHrRequestUpdated(HrRequest $requestModel, User $actor, ?string $previousStatus = null): void
    {
        if ($requestModel->status === 'draft' && $previousStatus === 'draft') {
            return;
        }

        if ($previousStatus === 'draft' && $requestModel->status === 'active') {
            $this->notifyHrRequestCreated($requestModel, $actor);

            return;
        }

        if ($requestModel->status !== 'active') {
            return;
        }

        $message = sprintf('%s updated request %s.', $actor->name, $requestModel->id);
        if ($previousStatus !== null && $previousStatus !== $requestModel->status) {
            $message = sprintf(
                '%s changed request %s from %s to %s.',
                $actor->name,
                $requestModel->id,
                $previousStatus,
                $requestModel->status
            );
        }

        $this->notifyUsersWithRoutes(
            $this->usersForHrRequest($requestModel),
            $actor,
            'hr_request.updated',
            'Request updated',
            $message,
            'hr_request',
            $requestModel->id,
            fn (User $user) => $this->routeForHrRequest($user, $requestModel->id),
            [
                'status' => $requestModel->status,
                'previous_status' => $previousStatus,
            ],
        );
    }

    public function notifyRegionalResponseCreated(RegionalResponse $response, User $actor): void
    {
        // Federal / super-admin review only — regional actor is excluded; departments are not notified.
        $this->notifyUsersWithRoutes(
            $this->federalAdmins(),
            $actor,
            'regional_response.created',
            'Regional response submitted',
            sprintf('%s submitted response %s for request %s.', $actor->name, $response->id, $response->hr_request_id),
            'regional_response',
            $response->id,
            fn () => '/regional-responses/'.$response->id.'?from='.rawurlencode('/responses'),
            [
                'review_status' => $response->review_status,
                'hr_request_id' => $response->hr_request_id,
            ],
        );
    }

    public function notifyRegionalResponseReviewed(RegionalResponse $response, User $actor, ?string $previousStatus = null): void
    {
        $this->notifyUsersWithRoutes(
            $this->usersForRegionalResponseReview($response),
            $actor,
            'regional_response.reviewed',
            'Regional response reviewed',
            sprintf(
                '%s reviewed response %s: %s%s.',
                $actor->name,
                $response->id,
                $response->review_status,
                $previousStatus && $previousStatus !== $response->review_status ? sprintf(' (was %s)', $previousStatus) : ''
            ),
            'regional_response',
            $response->id,
            fn (User $user) => $this->routeForRegionalResponse($user, $response),
            [
                'review_status' => $response->review_status,
                'previous_review_status' => $previousStatus,
                'hr_request_id' => $response->hr_request_id,
            ],
        );
    }

    public function notifyDepartmentTaskAssigned(DepartmentTask $task, User $actor): void
    {
        $this->notifyUsersWithRoutes(
            $this->usersForDepartmentTask($task),
            $actor,
            'department_task.assigned',
            'Department task assigned',
            sprintf('%s assigned department task %s for request %s.', $actor->name, $task->id, $task->hr_request_id),
            'department_task',
            $task->id,
            fn (User $user) => $this->routeForDepartmentTask($user, $task),
            [
                'status' => $task->status,
                'hr_request_id' => $task->hr_request_id,
            ],
        );
    }

    public function notifyUserManaged(User $subject, User $actor, string $eventKey, string $title, string $message): void
    {
        $this->notifyUsersWithRoutes(
            $this->usersForManagedUser($subject),
            $actor,
            $eventKey,
            $title,
            $message,
            'user',
            (string) $subject->id,
            fn (User $user) => $this->routeForManagedUser($user, $subject),
            [
                'subject_role' => $subject->roles->pluck('slug')->values()->all(),
            ],
        );
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  callable(User): (?string)  $routeForUser
     * @param  array<string, mixed>  $meta
     */
    private function notifyUsersWithRoutes(
        Collection $users,
        ?User $actor,
        string $eventKey,
        string $title,
        string $message,
        ?string $entityType,
        ?string $entityId,
        callable $routeForUser,
        array $meta = [],
    ): void {
        $rows = $users
            ->filter(fn (User $user) => $actor === null || (int) $user->id !== (int) $actor->id)
            ->unique('id')
            ->values()
            ->map(function (User $user) use ($eventKey, $title, $message, $entityType, $entityId, $routeForUser, $meta): array {
                $encoded = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
                if ($encoded === false) {
                    $encoded = '{}';
                }

                return [
                    'user_id' => $user->id,
                    'event_key' => $eventKey,
                    'title' => $title,
                    'message' => $message,
                    'entity_type' => $entityType,
                    'entity_id' => $entityId,
                    'route' => $routeForUser($user),
                    'meta' => $encoded,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            })
            ->all();

        if ($rows !== []) {
            Notification::query()->insert($rows);
        }
    }

    /**
     * @return Collection<int, User>
     */
    private function federalAdmins(): Collection
    {
        return User::query()
            ->with('roles')
            ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['super_admin', 'federal_admin']))
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    private function usersForHrRequest(HrRequest $requestModel): Collection
    {
        $requestModel->loadMissing(['regions:id', 'departments:id', 'departments.regions:id,slug']);

        $regionIds = $requestModel->regions->pluck('id')->map(fn ($id) => (int) $id)->all();
        if ($regionIds === [] && $requestModel->region_id !== null) {
            $regionIds = [(int) $requestModel->region_id];
        }
        $departmentIds = $requestModel->departments->pluck('id')->map(fn ($id) => (int) $id)->all();

        return User::query()
            ->with(['roles', 'department.regions'])
            ->where(function ($query) use ($regionIds, $departmentIds): void {
                $query->whereHas('roles', fn ($r) => $r->whereIn('slug', ['super_admin', 'federal_admin']));

                if ($regionIds !== []) {
                    $query->orWhere(function ($inner) use ($regionIds): void {
                        $inner
                            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
                            ->whereIn('region_id', $regionIds);
                    });
                }

                if ($departmentIds !== []) {
                    $query->orWhere(function ($inner) use ($departmentIds): void {
                        $inner
                            ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['department_admin', 'viewer']))
                            ->whereIn('department_id', $departmentIds);
                    });
                }
            })
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    private function usersForRegionalResponseReview(RegionalResponse $response): Collection
    {
        $response->loadMissing(['region:id']);

        return User::query()
            ->with('roles')
            ->where(function ($query) use ($response): void {
                $query->whereHas('roles', fn ($r) => $r->whereIn('slug', ['super_admin', 'federal_admin']));

                if ($response->region_id !== null) {
                    $query->orWhere(function ($inner) use ($response): void {
                        $inner
                            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
                            ->where('region_id', $response->region_id);
                    });
                }
            })
            ->get();
    }

    /**
     * Department task notifications: department users + owning regional (or federal for ICT) only.
     *
     * @return Collection<int, User>
     */
    private function usersForDepartmentTask(DepartmentTask $task): Collection
    {
        $task->loadMissing(['department.regions']);
        $isIct = $task->department?->coversRegionSlug('ict') ?? false;

        return User::query()
            ->with(['roles', 'department.regions'])
            ->where(function ($query) use ($task, $isIct): void {
                $query->where(function ($inner) use ($task): void {
                    $inner
                        ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['department_admin', 'viewer']))
                        ->where('department_id', $task->department_id);
                });

                if ($isIct) {
                    $query->orWhereHas('roles', fn ($r) => $r->whereIn('slug', ['super_admin', 'federal_admin']));
                } elseif ($task->region_id !== null) {
                    $query->orWhere(function ($inner) use ($task): void {
                        $inner
                            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
                            ->where('region_id', $task->region_id);
                    });
                }
            })
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    private function usersForManagedUser(User $subject): Collection
    {
        $subject->loadMissing(['roles', 'department.regions']);
        $subjectRoleSlugs = $subject->roles->pluck('slug')->all();

        return User::query()
            ->with(['roles', 'department.regions'])
            ->where(function ($query) use ($subject, $subjectRoleSlugs): void {
                $query->whereHas('roles', fn ($r) => $r->where('slug', 'super_admin'));

                if (in_array('department_admin', $subjectRoleSlugs, true) || in_array('viewer', $subjectRoleSlugs, true)) {
                    if ($subject->department?->coversRegionSlug('ict')) {
                        $query->orWhereHas('roles', fn ($r) => $r->where('slug', 'federal_admin'));
                    }

                    if ($subject->region_id !== null) {
                        $query->orWhere(function ($inner) use ($subject): void {
                            $inner
                                ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
                                ->where('region_id', $subject->region_id);
                        });
                    }
                }
            })
            ->get();
    }

    private function primaryRoleSlug(User $user): ?string
    {
        $user->loadMissing('roles');
        $slugs = $user->roles->pluck('slug')->all();
        foreach (['super_admin', 'federal_admin', 'regional_admin', 'department_admin', 'viewer'] as $slug) {
            if (in_array($slug, $slugs, true)) {
                return $slug;
            }
        }

        return $slugs[0] ?? null;
    }

    private function routeForHrRequest(User $user, string $requestId): string
    {
        $role = $this->primaryRoleSlug($user);

        if ($role === 'regional_admin') {
            return '/requests/'.rawurlencode($requestId).'?from='.rawurlencode('/region-received');
        }

        if ($role === 'department_admin' || $role === 'viewer') {
            $from = $user->department?->coversRegionSlug('ict')
                ? '/federal-department-requests'
                : '/department-tasks';

            return '/requests/'.rawurlencode($requestId).'?from='.rawurlencode($from);
        }

        return '/requests/'.rawurlencode($requestId).'?from='.rawurlencode('/requests');
    }

    private function routeForRegionalResponse(User $user, RegionalResponse $response): string
    {
        $role = $this->primaryRoleSlug($user);

        if ($role === 'regional_admin') {
            return '/regional-compilations/'.rawurlencode($response->id).'?from='.rawurlencode('/region-history');
        }

        return '/regional-responses/'.rawurlencode($response->id).'?from='.rawurlencode('/responses');
    }

    private function routeForDepartmentTask(User $user, DepartmentTask $task): string
    {
        $role = $this->primaryRoleSlug($user);
        $requestId = (string) $task->hr_request_id;
        $taskId = (string) $task->id;

        if ($role === 'regional_admin') {
            $from = '/region-monitoring';
        } elseif ($role === 'department_admin' || $role === 'viewer') {
            $from = $user->department?->coversRegionSlug('ict')
                ? '/federal-department-requests'
                : '/department-tasks';
        } else {
            $from = '/federal-department-requests';
        }

        return '/requests/'.rawurlencode($requestId).'?task='.rawurlencode($taskId).'&from='.rawurlencode($from);
    }

    private function routeForManagedUser(User $viewer, User $subject): string
    {
        $subject->loadMissing('department.regions');
        $viewerRole = $this->primaryRoleSlug($viewer);

        if ($viewerRole === 'regional_admin') {
            return '/regional-users-mgmt/'.$subject->id.'/edit';
        }

        if ($subject->department?->coversRegionSlug('ict') || in_array($viewerRole, ['federal_admin', 'super_admin'], true)) {
            return '/federal-users-mgmt/'.$subject->id.'/edit';
        }

        return '/regional-users-mgmt/'.$subject->id.'/edit';
    }
}
