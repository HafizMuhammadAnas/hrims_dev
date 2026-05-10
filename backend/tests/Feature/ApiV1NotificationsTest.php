<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\HrRequest;
use App\Models\Notification;
use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1NotificationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped(
                'Enable the pdo_sqlite PHP extension (or point phpunit.xml at a MySQL test database) to run these tests.',
            );
        }

        parent::setUp();
        $this->seed(RegionSeeder::class);
        $this->seed(RbacSeeder::class);
    }

    public function test_hr_request_creation_notifies_scoped_super_and_regional_admins(): void
    {
        $federal = Region::query()->where('slug', 'ict')->firstOrFail();
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();

        $federalAdmin = $this->makeUserWithRole('federal_admin', ['region_id' => $federal->id]);
        $superAdmin = $this->makeUserWithRole('super_admin');
        $regionalAdmin = $this->makeUserWithRole('regional_admin', ['region_id' => $punjab->id]);
        $otherRegional = $this->makeUserWithRole('regional_admin', ['region_id' => Region::query()->where('slug', 'sindh')->value('id')]);

        $response = $this->actingAs($federalAdmin)->postJson('/api/v1/hr-requests', [
            'id' => 'REQ-NOTIFY-001',
            'title' => 'Notification test request',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'date' => now()->addWeek()->format('Y-m-d'),
            'status' => 'draft',
        ]);

        $response->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $superAdmin->id,
            'event_key' => 'hr_request.created',
            'entity_id' => 'REQ-NOTIFY-001',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $regionalAdmin->id,
            'event_key' => 'hr_request.created',
            'entity_id' => 'REQ-NOTIFY-001',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $federalAdmin->id,
            'entity_id' => 'REQ-NOTIFY-001',
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $otherRegional->id,
            'entity_id' => 'REQ-NOTIFY-001',
        ]);
    }

    public function test_department_task_assignment_notifies_the_assigned_department_scope(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $regionalAdmin = $this->makeUserWithRole('regional_admin', ['region_id' => $punjab->id]);

        $department = Department::query()->create([
            'code' => 'TEST-NOTIFY',
            'name' => 'Punjab Notification Department',
            'type' => 'test',
        ]);
        $department->regions()->attach($punjab->id);

        $departmentAdmin = $this->makeUserWithRole('department_admin', [
            'region_id' => $punjab->id,
            'department_id' => $department->id,
        ]);
        $viewer = $this->makeUserWithRole('viewer', [
            'region_id' => $punjab->id,
            'department_id' => $department->id,
        ]);

        HrRequest::query()->create([
            'id' => 'REQ-TASK-001',
            'title' => 'Task notification request',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'due_date' => now()->addDays(10),
            'status' => 'draft',
        ]);

        $response = $this->actingAs($regionalAdmin)->postJson('/api/v1/department-tasks', [
            'hr_request_id' => 'REQ-TASK-001',
            'department_id' => $department->id,
        ]);

        $response->assertCreated();
        $taskId = (string) $response->json('data.id');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $departmentAdmin->id,
            'event_key' => 'department_task.assigned',
            'entity_id' => $taskId,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $viewer->id,
            'event_key' => 'department_task.assigned',
            'entity_id' => $taskId,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $regionalAdmin->id,
            'event_key' => 'department_task.assigned',
            'entity_id' => $taskId,
        ]);
    }

    public function test_notifications_api_returns_only_own_notifications_and_marks_them_read(): void
    {
        $user = $this->makeUserWithRole('super_admin');
        $other = $this->makeUserWithRole('federal_admin', [
            'region_id' => Region::query()->where('slug', 'ict')->value('id'),
        ]);

        $mine = Notification::query()->create([
            'user_id' => $user->id,
            'event_key' => 'demo.event',
            'title' => 'My notification',
            'message' => 'Only I should see this.',
            'route' => '/requests',
        ]);
        Notification::query()->create([
            'user_id' => $other->id,
            'event_key' => 'demo.event',
            'title' => 'Other notification',
            'message' => 'Hidden from the current user.',
            'route' => '/requests',
        ]);

        $list = $this->actingAs($user)->getJson('/api/v1/notifications');
        $list->assertOk();
        $this->assertSame(1, count($list->json('data')));
        $this->assertSame($mine->id, $list->json('data.0.id'));
        $this->assertSame(1, $list->json('meta.unread_count'));

        $markOne = $this->actingAs($user)->postJson("/api/v1/notifications/{$mine->id}/read");
        $markOne->assertOk();
        $this->assertDatabaseMissing('notifications', [
            'id' => $mine->id,
            'read_at' => null,
        ]);

        Notification::query()->create([
            'user_id' => $user->id,
            'event_key' => 'demo.event.2',
            'title' => 'Another',
            'message' => 'Unread item',
            'route' => '/requests',
        ]);

        $markAll = $this->actingAs($user)->postJson('/api/v1/notifications/read-all');
        $markAll->assertOk();
        $this->assertSame(0, Notification::query()->where('user_id', $user->id)->whereNull('read_at')->count());
    }

    public function test_user_deactivation_notifies_managing_admins_in_scope(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $superAdmin = $this->makeUserWithRole('super_admin');
        $regionalAdmin = $this->makeUserWithRole('regional_admin', ['region_id' => $punjab->id]);

        $department = Department::query()->create([
            'code' => 'REG-NOTIFY',
            'name' => 'Regional Managed Department',
            'type' => 'test',
        ]);
        $department->regions()->attach($punjab->id);

        $managedUser = $this->makeUserWithRole('department_admin', [
            'region_id' => $punjab->id,
            'department_id' => $department->id,
        ]);

        $response = $this->actingAs($superAdmin)->patchJson("/api/v1/users/{$managedUser->id}", [
            'is_active' => false,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('notifications', [
            'user_id' => $regionalAdmin->id,
            'event_key' => 'user.deactivated',
            'entity_id' => (string) $managedUser->id,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $superAdmin->id,
            'event_key' => 'user.deactivated',
            'entity_id' => (string) $managedUser->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function makeUserWithRole(string $roleSlug, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $role = RbacRole::query()->where('slug', $roleSlug)->firstOrFail();
        $user->roles()->attach($role);

        return $user;
    }
}
