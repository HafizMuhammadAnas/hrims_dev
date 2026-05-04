<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use Database\Seeders\DepartmentCatalogSeeder;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1HrRequestAuthorizationTest extends TestCase
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

    public function test_department_admin_cannot_create_hr_request(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $role = RbacRole::query()->where('slug', 'department_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $punjab->id]);
        $user->roles()->attach($role);

        $response = $this->actingAs($user)->postJson('/api/v1/hr-requests', [
            'id' => 'REQ-TEST-DEPT',
            'title' => 'Nope',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'date' => now()->format('Y-m-d'),
            'status' => 'pending',
        ]);

        $response->assertForbidden();
    }

    public function test_regional_admin_cannot_create_request_for_another_region(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $sindh = Region::query()->where('slug', 'sindh')->firstOrFail();
        $role = RbacRole::query()->where('slug', 'regional_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $punjab->id]);
        $user->roles()->attach($role);

        $response = $this->actingAs($user)->postJson('/api/v1/hr-requests', [
            'id' => 'REQ-TEST-XREGION',
            'title' => 'Wrong region',
            'conv' => 'CEDAW',
            'region_id' => $sindh->id,
            'date' => now()->format('Y-m-d'),
            'status' => 'pending',
        ]);

        $response->assertForbidden();
    }

    public function test_regional_admin_can_create_request_in_own_region(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $role = RbacRole::query()->where('slug', 'regional_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $punjab->id]);
        $user->roles()->attach($role);

        $response = $this->actingAs($user)->postJson('/api/v1/hr-requests', [
            'id' => 'REQ-TEST-OWN',
            'title' => 'Regional task',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'date' => now()->format('Y-m-d'),
            'status' => 'pending',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('hr_requests', [
            'id' => 'REQ-TEST-OWN',
            'region_id' => $punjab->id,
        ]);
    }

    public function test_regional_admin_cannot_update_request_in_other_region(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $sindh = Region::query()->where('slug', 'sindh')->firstOrFail();
        $role = RbacRole::query()->where('slug', 'regional_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $punjab->id]);
        $user->roles()->attach($role);

        HrRequest::query()->create([
            'id' => 'REQ-TEST-SINDH',
            'title' => 'Sindh only',
            'conv' => 'CEDAW',
            'region_id' => $sindh->id,
            'due_date' => now(),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($user)->patchJson('/api/v1/hr-requests/REQ-TEST-SINDH', [
            'title' => 'Hacked',
        ]);

        $response->assertForbidden();
    }

    public function test_federal_admin_can_update_request_in_any_region(): void
    {
        $federal = Region::query()->where('slug', 'federal')->firstOrFail();
        $sindh = Region::query()->where('slug', 'sindh')->firstOrFail();
        $role = RbacRole::query()->where('slug', 'federal_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $federal->id]);
        $user->roles()->attach($role);

        HrRequest::query()->create([
            'id' => 'REQ-TEST-FED-PATCH',
            'title' => 'Original',
            'conv' => 'CEDAW',
            'region_id' => $sindh->id,
            'due_date' => now(),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($user)->patchJson('/api/v1/hr-requests/REQ-TEST-FED-PATCH', [
            'title' => 'Updated by federal',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.title', 'Updated by federal');
    }

    public function test_department_admin_hr_request_index_is_limited_to_assigned_requests(): void
    {
        $this->seed(RegionSeeder::class);
        $this->seed(RbacSeeder::class);

        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $dept = Department::query()->create([
            'code' => 'TEST-D',
            'name' => 'Test Department',
            'type' => 'test',
        ]);
        $dept->regions()->attach($punjab->id);

        $role = RbacRole::query()->where('slug', 'department_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $punjab->id, 'department_id' => $dept->id]);
        $user->roles()->attach($role);

        HrRequest::query()->create([
            'id' => 'REQ-DEPT-A',
            'title' => 'Assigned',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'due_date' => now(),
            'status' => 'pending',
        ]);
        HrRequest::query()->create([
            'id' => 'REQ-DEPT-B',
            'title' => 'Not assigned',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'due_date' => now(),
            'status' => 'pending',
        ]);

        DepartmentTask::query()->create([
            'id' => 'TSK-TEST-01',
            'hr_request_id' => 'REQ-DEPT-A',
            'region_id' => $punjab->id,
            'department_id' => $dept->id,
            'status' => 'assigned',
            'assigned_date' => now()->toDateString(),
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/hr-requests');

        $response->assertOk();
        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame(['REQ-DEPT-A'], $ids);
    }

    public function test_users_api_rejects_regional_admin_role_slug(): void
    {
        $this->seed(RegionSeeder::class);
        $this->seed(RbacSeeder::class);
        $this->seed(DepartmentCatalogSeeder::class);

        $federal = Region::query()->where('slug', 'federal')->firstOrFail();
        $fedDept = Department::query()->whereHas('regions', fn ($q) => $q->where('slug', 'federal'))->firstOrFail();
        $role = RbacRole::query()->where('slug', 'federal_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $federal->id]);
        $user->roles()->attach($role);

        $response = $this->actingAs($user)->postJson('/api/v1/users', [
            'name' => 'X',
            'username' => 'reg_try',
            'password' => 'password123',
            'role_slug' => 'regional_admin',
            'department_id' => $fedDept->id,
        ]);

        $response->assertUnprocessable();
    }

    public function test_super_admin_cannot_create_department_user_via_api(): void
    {
        $this->seed(RegionSeeder::class);
        $this->seed(RbacSeeder::class);
        $this->seed(DepartmentCatalogSeeder::class);

        $federal = Region::query()->where('slug', 'federal')->firstOrFail();
        $dept = Department::query()->whereHas('regions', fn ($q) => $q->where('slug', 'federal'))->firstOrFail();
        $superRole = RbacRole::query()->where('slug', 'super_admin')->firstOrFail();
        $super = User::factory()->create(['region_id' => null, 'department_id' => null]);
        $super->roles()->attach($superRole);

        $response = $this->actingAs($super)->postJson('/api/v1/users', [
            'name' => 'Dept try',
            'username' => 'dept_try_super',
            'password' => 'password123',
            'role_slug' => 'department_admin',
            'department_id' => $dept->id,
        ]);

        $response->assertUnprocessable();
    }
}
