<?php

namespace Tests\Feature;

use App\Models\HrRequest;
use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1DashboardSummaryTest extends TestCase
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

    public function test_federal_dashboard_summary_shape(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $role = RbacRole::query()->where('slug', 'federal_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => $punjab->id]);
        $user->roles()->attach($role);

        HrRequest::query()->create([
            'id' => 'REQ-DASH-1',
            'title' => 'Dashboard test request',
            'conv' => 'CEDAW',
            'region_id' => $punjab->id,
            'due_date' => now()->subDay()->toDateString(),
            'status' => 'draft',
            'details' => null,
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/dashboard/summary');

        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                'hr_requests_total',
                'by_status',
                'urgent_requests',
                'recent_requests',
                'requests_created_by_month',
                'regional_responses_total',
                'regional_responses_by_review',
                'compiled_records_total',
                'hr_requests_pending_federal',
            ],
        ]);

        $data = $response->json('data');
        $this->assertGreaterThanOrEqual(1, $data['hr_requests_total']);
        $this->assertNotEmpty($data['requests_created_by_month']);
        $this->assertCount(6, $data['requests_created_by_month']);
    }

    public function test_department_dashboard_includes_task_rollups(): void
    {
        $punjab = Region::query()->where('slug', 'punjab')->firstOrFail();
        $role = RbacRole::query()->where('slug', 'department_admin')->firstOrFail();
        $user = User::factory()->create([
            'region_id' => $punjab->id,
            'department_id' => null,
        ]);
        $user->roles()->attach($role);

        $response = $this->actingAs($user)->getJson('/api/v1/dashboard/summary');

        $response->assertOk();
        $response->assertJsonPath('data.department_tasks_total', 0);
        $response->assertJsonStructure([
            'data' => [
                'department_tasks_by_status',
                'department_tasks_by_month',
            ],
        ]);
    }
}
