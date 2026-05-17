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

        $this->notifyUsers(
            $this->usersForHrRequest($requestModel),
            $actor,
            'hr_request.created',
            'Request created',
            sprintf('%s created request %s.', $actor->name, $requestModel->id),
            'hr_request',
            $requestModel->id,
            '/requests/'.$requestModel->id,
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

        $this->notifyUsers(
            $this->usersForHrRequest($requestModel),
            $actor,
            'hr_request.updated',
            'Request updated',
            $message,
            'hr_request',
            $requestModel->id,
            '/requests/'.$requestModel->id,
            [
                'status' => $requestModel->status,
                'previous_status' => $previousStatus,
            ],
        );
    }

    public function notifyRegionalResponseCreated(RegionalResponse $response, User $actor): void
    {
        $this->notifyUsers(
            $this->usersForRegionalResponse($response),
            $actor,
            'regional_response.created',
            'Regional response submitted',
            sprintf('%s submitted response %s for request %s.', $actor->name, $response->id, $response->hr_request_id),
            'regional_response',
            $response->id,
            '/responses',
            [
                'review_status' => $response->review_status,
                'hr_request_id' => $response->hr_request_id,
            ],
        );
    }

    public function notifyRegionalResponseReviewed(RegionalResponse $response, User $actor, ?string $previousStatus = null): void
    {
        $this->notifyUsers(
            $this->usersForRegionalResponse($response),
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
            '/responses',
            [
                'review_status' => $response->review_status,
                'previous_review_status' => $previousStatus,
                'hr_request_id' => $response->hr_request_id,
            ],
        );
    }

    public function notifyDepartmentTaskAssigned(DepartmentTask $task, User $actor): void
    {
        $this->notifyUsers(
            $this->usersForDepartmentTask($task),
            $actor,
            'department_task.assigned',
            'Department task assigned',
            sprintf('%s assigned department task %s for request %s.', $actor->name, $task->id, $task->hr_request_id),
            'department_task',
            $task->id,
            '/department-tasks',
            [
                'status' => $task->status,
                'hr_request_id' => $task->hr_request_id,
            ],
        );
    }

    public function notifyUserManaged(User $subject, User $actor, string $eventKey, string $title, string $message): void
    {
        $this->notifyUsers(
            $this->usersForManagedUser($subject),
            $actor,
            $eventKey,
            $title,
            $message,
            'user',
            (string) $subject->id,
            $this->routeForManagedUser($subject),
            [
                'subject_role' => $subject->roles->pluck('slug')->values()->all(),
            ],
        );
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  array<string, mixed>  $meta
     */
    private function notifyUsers(
        Collection $users,
        ?User $actor,
        string $eventKey,
        string $title,
        string $message,
        ?string $entityType,
        ?string $entityId,
        ?string $route,
        array $meta = [],
    ): void {
        $rows = $users
            ->filter(fn (User $user) => $actor === null || (int) $user->id !== (int) $actor->id)
            ->unique('id')
            ->values()
            ->map(function (User $user) use ($eventKey, $title, $message, $entityType, $entityId, $route, $meta): array {
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
                    'route' => $route,
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
    private function usersForHrRequest(HrRequest $requestModel): Collection
    {
        $requestModel->loadMissing(['regions:id', 'departments:id', 'departments.regions:id,slug']);

        $regionIds = $requestModel->regions->pluck('id')->map(fn ($id) => (int) $id)->all();
        if ($regionIds === [] && $requestModel->region_id !== null) {
            $regionIds = [(int) $requestModel->region_id];
        }
        $departmentIds = $requestModel->departments->pluck('id')->map(fn ($id) => (int) $id)->all();

        return User::query()
            ->with('roles')
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
    private function usersForRegionalResponse(RegionalResponse $response): Collection
    {
        $response->loadMissing(['hrRequest.departments:id', 'hrRequest.regions:id']);

        $regionIds = [];
        if ($response->region_id !== null) {
            $regionIds[] = (int) $response->region_id;
        }
        foreach ($response->hrRequest?->regions ?? [] as $region) {
            $regionIds[] = (int) $region->id;
        }
        $regionIds = array_values(array_unique($regionIds));

        $departmentIds = $response->hrRequest?->departments?->pluck('id')->map(fn ($id) => (int) $id)->all() ?? [];

        return User::query()
            ->with('roles')
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
    private function usersForDepartmentTask(DepartmentTask $task): Collection
    {
        $regionIds = $task->region_id !== null ? [(int) $task->region_id] : [];

        return User::query()
            ->with('roles')
            ->where(function ($query) use ($task, $regionIds): void {
                $query->whereHas('roles', fn ($r) => $r->whereIn('slug', ['super_admin', 'federal_admin']));

                if ($regionIds !== []) {
                    $query->orWhere(function ($inner) use ($regionIds): void {
                        $inner
                            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
                            ->whereIn('region_id', $regionIds);
                    });
                }

                $query->orWhere(function ($inner) use ($task): void {
                    $inner
                        ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['department_admin', 'viewer']))
                        ->where('department_id', $task->department_id);
                });
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
            ->with('roles')
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

    private function routeForManagedUser(User $subject): string
    {
        $subject->loadMissing('department.regions');

        if ($subject->department?->coversRegionSlug('ict')) {
            return '/federal-users-mgmt';
        }

        return '/regional-users-mgmt';
    }
}
