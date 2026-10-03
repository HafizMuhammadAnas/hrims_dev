<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\HrRequest;
use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ApiV1DepartmentTaskReviewTest extends TestCase
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

    public function test_operator_submit_enters_pending_validation_not_under_review(): void
    {
        [, $taskId, $departmentAdmin] = $this->assignAndSubmitDepartmentTask(false);

        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'status' => 'submitted',
            'department_validation_status' => null,
            'regional_review_status' => null,
        ]);

        $list = $this->actingAs($departmentAdmin)->getJson('/api/v1/department-tasks');
        $list->assertOk();
        $row = collect($list->json('data'))->firstWhere('id', $taskId);
        $this->assertNotNull($row);
        $this->assertNull($row['department_validation_status']);
    }

    public function test_validator_accept_forwards_to_under_review_for_region(): void
    {
        [$regionalAdmin, $taskId] = $this->assignSubmitAndValidateDepartmentTask();

        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'department_validation_status' => 'accepted',
            'regional_review_status' => null,
        ]);

        $maskedBefore = $this->actingAs($regionalAdmin)->getJson('/api/v1/department-tasks');
        $maskedBefore->assertOk();
        $beforeRow = collect($maskedBefore->json('data'))->firstWhere('id', $taskId);
        $this->assertNotNull($beforeRow);
        $this->assertSame('submitted', $beforeRow['status']);
        $this->assertSame('accepted', $beforeRow['department_validation_status']);
    }

    public function test_region_cannot_see_response_until_validator_accepts(): void
    {
        [$regionalAdmin, $taskId] = $this->assignAndSubmitDepartmentTask(false);

        $list = $this->actingAs($regionalAdmin)->getJson('/api/v1/department-tasks');
        $list->assertOk();
        $row = collect($list->json('data'))->firstWhere('id', $taskId);
        $this->assertNotNull($row);
        $this->assertSame('assigned', $row['status']);
        $this->assertNull($row['submission_date']);
        $this->assertNull($row['response_data']);
    }

    public function test_validator_return_then_operator_resubmit_returns_to_pending_validation(): void
    {
        [, $taskId, $departmentAdmin, $validator] = $this->assignAndSubmitDepartmentTask(false);

        $this->actingAs($validator)->postJson("/api/v1/department-tasks/{$taskId}/department-validation", [
            'department_validation_status' => 'needs-modification',
            'department_validation_comments' => 'Fix figures',
        ])->assertOk();

        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'department_validation_status' => 'needs-modification',
        ]);

        $this->actingAs($departmentAdmin)->postJson("/api/v1/department-tasks/{$taskId}/submit-response", [
            'response_data' => 'Corrected department answer',
        ])->assertOk();

        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'status' => 'submitted',
            'department_validation_status' => null,
            'regional_review_status' => null,
        ]);
    }

    public function test_regional_revision_then_operator_resubmit_requires_validation_again(): void
    {
        [$regionalAdmin, $taskId, $departmentAdmin] = $this->assignSubmitAndValidateDepartmentTask();

        $this->actingAs($regionalAdmin)->postJson("/api/v1/department-tasks/{$taskId}/review", [
            'regional_review_status' => 'needs-modification',
            'regional_review_comments' => 'Need update',
        ])->assertOk();

        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'regional_review_status' => 'needs-modification',
            'department_validation_status' => null,
        ]);

        $this->actingAs($departmentAdmin)->postJson("/api/v1/department-tasks/{$taskId}/submit-response", [
            'response_data' => 'Updated after regional revision',
        ])->assertOk();

        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'department_validation_status' => null,
            'regional_review_status' => null,
        ]);

        $list = $this->actingAs($regionalAdmin)->getJson('/api/v1/department-tasks');
        $row = collect($list->json('data'))->firstWhere('id', $taskId);
        $this->assertSame('assigned', $row['status']);
        $this->assertNull($row['submission_date']);
    }

    public function test_regional_admin_can_accept_under_review_department_response(): void
    {
        [$regionalAdmin, $taskId] = $this->assignSubmitAndValidateDepartmentTask();

        $review = $this->actingAs($regionalAdmin)->postJson("/api/v1/department-tasks/{$taskId}/review", [
            'regional_review_status' => 'accepted',
        ]);

        $review->assertOk();
        $this->assertSame('accepted', $review->json('data.regional_review_status'));
        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'regional_review_status' => 'accepted',
        ]);
    }

    public function test_accept_review_succeeds_when_pending_revision_origin_column_is_missing(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            $table->dropColumn('pending_revision_origin');
        });
        $this->assertFalse(Schema::hasColumn('department_tasks', 'pending_revision_origin'));

        [$regionalAdmin, $taskId] = $this->assignSubmitAndValidateDepartmentTask();

        $review = $this->actingAs($regionalAdmin)->postJson("/api/v1/department-tasks/{$taskId}/review", [
            'regional_review_status' => 'accepted',
        ]);

        $review->assertOk();
        $this->assertSame('accepted', $review->json('data.regional_review_status'));
        $this->assertDatabaseHas('department_tasks', [
            'id' => $taskId,
            'regional_review_status' => 'accepted',
        ]);
    }

    public function test_validator_cannot_submit_response_directly(): void
    {
        [, $taskId, , $validator] = $this->createAssignedDepartmentTask();

        $this->actingAs($validator)->postJson("/api/v1/department-tasks/{$taskId}/submit-response", [
            'response_data' => 'Validator should not submit',
        ])->assertForbidden();
    }

    /**
     * @return array{0: User, 1: string, 2: User, 3: User}
     */
    private function assignAndSubmitDepartmentTask(bool $validate = true): array
    {
        [$regionalAdmin, $taskId, $departmentAdmin, $validator] = $this->createAssignedDepartmentTask();

        $this->actingAs($departmentAdmin)->postJson("/api/v1/department-tasks/{$taskId}/submit-response", [
            'response_data' => 'Department answer ready for validation',
        ])->assertOk();

        if ($validate) {
            $this->actingAs($validator)->postJson("/api/v1/department-tasks/{$taskId}/department-validation", [
                'department_validation_status' => 'accepted',
            ])->assertOk();
        }

        return [$regionalAdmin, $taskId, $departmentAdmin, $validator];
    }

    /**
     * @return array{0: User, 1: string, 2: User}
     */
    private function assignSubmitAndValidateDepartmentTask(): array
    {
        [$regionalAdmin, $taskId, $departmentAdmin] = $this->assignAndSubmitDepartmentTask(true);

        return [$regionalAdmin, $taskId, $departmentAdmin];
    }

    /**
     * @return array{0: User, 1: string, 2: User, 3: User}
     */
    private function createAssignedDepartmentTask(): array
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $regionalAdmin = $this->makeUserWithRole('regional_admin', ['region_id' => $punjab->id]);

        $department = Department::query()->create([
            'code' => 'TEST-REVIEW-ACCEPT-'.uniqid(),
            'name' => 'Review Accept Department',
            'type' => 'test',
        ]);
        $department->regions()->attach($punjab->id);

        $departmentAdmin = $this->makeUserWithRole('department_admin', [
            'region_id' => $punjab->id,
            'department_id' => $department->id,
        ]);
        $validator = $this->makeUserWithRole('department_validator', [
            'region_id' => $punjab->id,
            'department_id' => $department->id,
        ]);

        $reqId = 'REQ-DEPT-ACCEPT-'.uniqid();
        HrRequest::query()->create([
            'id' => $reqId,
            'title' => 'Dept accept review',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'due_date' => now()->addDays(10),
            'status' => 'active',
        ]);

        $assign = $this->actingAs($regionalAdmin)->postJson('/api/v1/department-tasks', [
            'hr_request_id' => $reqId,
            'department_id' => $department->id,
        ]);
        $assign->assertCreated();
        $taskId = (string) $assign->json('data.id');

        return [$regionalAdmin, $taskId, $departmentAdmin, $validator];
    }

    private function makeUserWithRole(string $roleSlug, array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        $role = RbacRole::query()->where('slug', $roleSlug)->firstOrFail();
        $user->roles()->attach($role);

        return $user;
    }
}
