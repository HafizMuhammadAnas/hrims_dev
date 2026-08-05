<?php

namespace App\Support;

use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\HrRequestClarification;
use App\Models\Notification;
use App\Models\RegionalResponse;
use App\Models\User;
use Illuminate\Support\Collection;

class NotificationService
{
    /**
     * Event keys each portal role should see in the notification bar / inbox.
     *
     * @return list<string>|null null = no restriction
     */
    public function allowedEventKeysFor(User $user): ?array
    {
        $user->loadMissing('roles');

        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            // Federal: regional submit/resubmit + clarifications + ICT department responses they review.
            return [
                'regional_response.created',
                'regional_response.resubmitted',
                'regional_response.reviewed',
                'hr_request_clarification.requested',
                'department_task.submitted',
                'department_task.resubmitted',
            ];
        }

        if ($user->hasRole('regional_admin')) {
            return [
                'hr_request.created',
                'hr_request.updated',
                'regional_response.reviewed',
                'department_task.assigned',
                'department_task.submitted',
                'department_task.resubmitted',
                'hr_request_clarification.answered',
                'user.created',
                'user.updated',
                'user.deactivated',
                'user.activated',
                'user.managed',
                'user.deleted',
            ];
        }

        if ($user->hasRole('department_admin') || $user->hasRole('viewer')) {
            return [
                'department_task.assigned',
                'department_task.needs_modification',
                'hr_request.created',
                'hr_request.updated',
            ];
        }

        return null;
    }

    public function notifyHrRequestCreated(HrRequest $requestModel, User $actor): void
    {
        if ($requestModel->status !== 'active') {
            return;
        }

        $this->notifyUsersWithRoutes(
            $this->usersForHrRequest($requestModel),
            $actor,
            'hr_request.created',
            'Request received',
            sprintf('%s · %s', $requestModel->title ?: 'Request', $requestModel->id),
            'hr_request',
            $requestModel->id,
            fn (User $user) => $this->routeForHrRequest($user, $requestModel->id),
            [
                'status' => $requestModel->status,
                'title' => $requestModel->title,
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

        $message = sprintf('%s · %s', $requestModel->title ?: 'Request', $requestModel->id);
        if ($previousStatus !== null && $previousStatus !== $requestModel->status) {
            $message = sprintf(
                '%s · %s (status: %s → %s)',
                $requestModel->title ?: 'Request',
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
                'title' => $requestModel->title,
            ],
        );
    }

    public function notifyRegionalResponseCreated(RegionalResponse $response, User $actor, bool $isResubmit = false): void
    {
        $response->loadMissing(['region:id,name']);
        $regionLabel = $response->region?->name ?: 'Region';
        $reqId = (string) $response->hr_request_id;

        // Federal / super-admin review only — regional actor is excluded; departments are not notified.
        $this->notifyUsersWithRoutes(
            $this->federalAdmins(),
            $actor,
            $isResubmit ? 'regional_response.resubmitted' : 'regional_response.created',
            $isResubmit ? 'Regional response resubmitted' : 'Regional response received',
            sprintf('%s · %s', $regionLabel, $reqId),
            'regional_response',
            $response->id,
            fn () => '/regional-responses/'.$response->id.'?from='.rawurlencode('/responses'),
            [
                'review_status' => $response->review_status,
                'hr_request_id' => $response->hr_request_id,
                'region_name' => $response->region?->name,
                'is_resubmit' => $isResubmit,
            ],
        );
    }

    public function notifyRegionalResponseReviewed(RegionalResponse $response, User $actor, ?string $previousStatus = null): void
    {
        $response->loadMissing(['region:id,name']);
        $regionLabel = $response->region?->name ?: 'Region';
        $reqId = (string) $response->hr_request_id;
        $statusLabel = $response->review_status ?: 'updated';
        $needsModification = $response->review_status === 'needs-modification';

        $this->notifyUsersWithRoutes(
            $this->usersForRegionalResponseReview($response),
            $actor,
            'regional_response.reviewed',
            $needsModification ? 'Modification requested' : 'Regional response reviewed',
            sprintf(
                '%s · %s · %s%s',
                $regionLabel,
                $reqId,
                $statusLabel,
                $previousStatus && $previousStatus !== $response->review_status
                    ? sprintf(' (was %s)', $previousStatus)
                    : ''
            ),
            'regional_response',
            $response->id,
            fn (User $user) => $this->routeForRegionalResponse($user, $response),
            [
                'review_status' => $response->review_status,
                'previous_review_status' => $previousStatus,
                'hr_request_id' => $response->hr_request_id,
                'region_name' => $response->region?->name,
            ],
        );
    }

    public function notifyDepartmentTaskAssigned(DepartmentTask $task, User $actor): void
    {
        $task->loadMissing(['hrRequest:id,title']);
        $requestTitle = $task->hrRequest?->title ?: 'Request';
        $requestId = (string) $task->hr_request_id;

        $this->notifyUsersWithRoutes(
            $this->usersForDepartmentTask($task),
            $actor,
            'department_task.assigned',
            'Department task assigned',
            sprintf('%s · %s', $requestTitle, $requestId),
            'department_task',
            $task->id,
            fn (User $user) => $this->routeForDepartmentTask($user, $task),
            [
                'status' => $task->status,
                'hr_request_id' => $task->hr_request_id,
                'title' => $requestTitle,
            ],
        );
    }

    /**
     * Department response submitted / resubmitted → regional (or federal for ICT tasks).
     */
    public function notifyDepartmentTaskSubmitted(DepartmentTask $task, User $actor, bool $isResubmit = false): void
    {
        $task->loadMissing(['hrRequest:id,title', 'department.regions', 'region:id,name']);
        $requestTitle = $task->hrRequest?->title ?: 'Request';
        $requestId = (string) $task->hr_request_id;

        $this->notifyUsersWithRoutes(
            $this->usersForDepartmentTaskSubmission($task),
            $actor,
            $isResubmit ? 'department_task.resubmitted' : 'department_task.submitted',
            $isResubmit ? 'Department response resubmitted' : 'Department response received',
            sprintf('%s · %s', $requestTitle, $requestId),
            'department_task',
            $task->id,
            fn (User $user) => $this->routeForDepartmentTask($user, $task),
            [
                'status' => $task->status,
                'hr_request_id' => $task->hr_request_id,
                'title' => $requestTitle,
                'is_resubmit' => $isResubmit,
            ],
        );
    }

    /**
     * Regional/federal review returns a department task for modification → department users.
     */
    public function notifyDepartmentTaskNeedsModification(DepartmentTask $task, User $actor): void
    {
        $task->loadMissing(['hrRequest:id,title', 'department.regions']);
        $requestTitle = $task->hrRequest?->title ?: 'Request';
        $requestId = (string) $task->hr_request_id;

        $this->notifyUsersWithRoutes(
            $this->usersForDepartmentTaskAssigneesOnly($task),
            $actor,
            'department_task.needs_modification',
            'Revision requested',
            sprintf('%s · %s', $requestTitle, $requestId),
            'department_task',
            $task->id,
            fn (User $user) => $this->routeForDepartmentTask($user, $task),
            [
                'status' => $task->status,
                'regional_review_status' => $task->regional_review_status,
                'hr_request_id' => $task->hr_request_id,
                'title' => $requestTitle,
            ],
        );
    }

    public function notifyClarificationRequested(HrRequestClarification $clarification, User $actor): void
    {
        $clarification->loadMissing(['region:id,name', 'hrRequest:id,title']);
        $regionLabel = $clarification->region?->name ?: 'Region';
        $reqId = (string) $clarification->hr_request_id;

        $this->notifyUsersWithRoutes(
            $this->federalAdmins(),
            $actor,
            'hr_request_clarification.requested',
            'Clarification requested',
            sprintf('%s · %s', $regionLabel, $reqId),
            'hr_request_clarification',
            (string) $clarification->id,
            fn () => '/requests/clarifications?id='.rawurlencode((string) $clarification->id),
            [
                'hr_request_id' => $clarification->hr_request_id,
                'region_name' => $clarification->region?->name,
                'status' => $clarification->status,
            ],
        );
    }

    public function notifyClarificationAnswered(HrRequestClarification $clarification, User $actor): void
    {
        $clarification->loadMissing(['region:id', 'hrRequest:id,title']);
        $reqId = (string) $clarification->hr_request_id;
        $requestTitle = $clarification->hrRequest?->title ?: 'Request';

        $this->notifyUsersWithRoutes(
            $this->usersForClarificationRegion($clarification),
            $actor,
            'hr_request_clarification.answered',
            'Clarification answered',
            sprintf('%s · %s', $requestTitle, $reqId),
            'hr_request_clarification',
            (string) $clarification->id,
            fn (User $user) => $this->routeForHrRequest($user, $reqId),
            [
                'hr_request_id' => $clarification->hr_request_id,
                'status' => $clarification->status,
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
     * Display title for legacy rows stored with older wording.
     */
    public function displayTitle(Notification $notification): string
    {
        $title = (string) $notification->title;
        if ($title === 'Regional response submitted') {
            return 'Regional response received';
        }
        if ($title === 'Request created') {
            return 'Request received';
        }

        return $title;
    }

    /**
     * Display message — rewrites legacy department-task copy to "title · request id".
     */
    public function displayMessage(Notification $notification): string
    {
        $message = (string) $notification->message;

        if ($notification->event_key !== 'department_task.assigned') {
            return $message;
        }

        // Already in the new "Title · REQ-…" form.
        if (! str_contains($message, 'assigned department task')) {
            return $message;
        }

        $meta = is_array($notification->meta) ? $notification->meta : [];
        $requestId = isset($meta['hr_request_id']) ? trim((string) $meta['hr_request_id']) : '';
        $requestTitle = isset($meta['title']) ? trim((string) $meta['title']) : '';

        if ($requestId === '' && preg_match('/\b(REQ-[A-Za-z0-9-]+)\b/', $message, $m)) {
            $requestId = $m[1];
        }

        if ($requestId === '' && is_string($notification->route)
            && preg_match('#/requests/([^?&/]+)#', $notification->route, $m)) {
            $requestId = rawurldecode($m[1]);
        }

        if ($requestTitle === '' && $requestId !== '') {
            $requestTitle = (string) (HrRequest::query()->whereKey($requestId)->value('title') ?? '');
        }

        if ($requestId === '') {
            return $message;
        }

        return sprintf('%s · %s', $requestTitle !== '' ? $requestTitle : 'Request', $requestId);
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
     * Regional (+ department users on the request). Federal portal is excluded —
     * federal only receives regional response notifications.
     *
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

        if ($regionIds === [] && $departmentIds === []) {
            return collect();
        }

        return User::query()
            ->with(['roles', 'department.regions'])
            ->where(function ($query) use ($regionIds, $departmentIds): void {
                if ($regionIds !== []) {
                    $query->where(function ($inner) use ($regionIds): void {
                        $inner
                            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
                            ->whereIn('region_id', $regionIds);
                    });
                }

                if ($departmentIds !== []) {
                    $method = $regionIds !== [] ? 'orWhere' : 'where';
                    $query->{$method}(function ($inner) use ($departmentIds): void {
                        $inner
                            ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['department_admin', 'viewer']))
                            ->whereIn('department_id', $departmentIds);
                    });
                }
            })
            ->get();
    }

    /**
     * Regional admins for the responding region only (federal actor is excluded at send time).
     *
     * @return Collection<int, User>
     */
    private function usersForRegionalResponseReview(RegionalResponse $response): Collection
    {
        $response->loadMissing(['region:id']);

        if ($response->region_id === null) {
            return collect();
        }

        return User::query()
            ->with('roles')
            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
            ->where('region_id', $response->region_id)
            ->get();
    }

    /**
     * Department task notifications: assigned department users (+ owning regional for provincial tasks).
     * Federal portal is not notified on assignment (regional responses / ICT submissions only).
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

                if (! $isIct && $task->region_id !== null) {
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
     * Who should be notified when a department submits/resubmits a response.
     * Provincial → regional admins; ICT/federal departments → federal admins.
     *
     * @return Collection<int, User>
     */
    private function usersForDepartmentTaskSubmission(DepartmentTask $task): Collection
    {
        $task->loadMissing(['department.regions']);
        $isIct = $task->department?->coversRegionSlug('ict')
            || $task->department?->coversRegionSlug('federal')
            || false;

        if ($isIct) {
            return $this->federalAdmins();
        }

        if ($task->region_id === null) {
            return collect();
        }

        return User::query()
            ->with('roles')
            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
            ->where('region_id', $task->region_id)
            ->get();
    }

    /**
     * Department assignees only (no regional/federal managers).
     *
     * @return Collection<int, User>
     */
    private function usersForDepartmentTaskAssigneesOnly(DepartmentTask $task): Collection
    {
        return User::query()
            ->with(['roles', 'department.regions'])
            ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['department_admin', 'viewer']))
            ->where('department_id', $task->department_id)
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    private function usersForClarificationRegion(HrRequestClarification $clarification): Collection
    {
        if ($clarification->region_id === null) {
            return collect();
        }

        return User::query()
            ->with('roles')
            ->whereHas('roles', fn ($r) => $r->where('slug', 'regional_admin'))
            ->where('region_id', $clarification->region_id)
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
