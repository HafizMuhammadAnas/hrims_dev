<?php

namespace Tests\Feature;

use App\Models\Convention;
use App\Models\IssueCategory;
use App\Models\RbacRole;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1IssueCategoryConventionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (! extension_loaded('pdo_sqlite')) {
            $this->markTestSkipped('pdo_sqlite required for tests.');
        }

        parent::setUp();
        $this->seed(RegionSeeder::class);
        $this->seed(RbacSeeder::class);
    }

    private function superAdmin(): User
    {
        $role = RbacRole::query()->where('slug', 'super_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => null, 'department_id' => null]);
        $user->roles()->attach($role);

        return $user;
    }

    public function test_admin_creates_category_under_selected_convention(): void
    {
        $user = $this->superAdmin();
        $cedaw = Convention::query()->create([
            'code' => 'CEDAW',
            'name' => 'Convention on the Elimination of All Forms of Discrimination against Women',
            'sort_order' => 1,
            'is_active' => true,
        ]);
        $crc = Convention::query()->create([
            'code' => 'CRC',
            'name' => 'Convention on the Rights of the Child',
            'sort_order' => 2,
            'is_active' => true,
        ]);

        $create = $this->actingAs($user)->postJson('/api/v1/admin/issue-categories', [
            'convention_id' => $cedaw->id,
            'name' => 'Discrimination',
        ]);
        $create->assertCreated();
        $create->assertJsonPath('data.convention_id', $cedaw->id);
        $create->assertJsonPath('data.convention.code', 'CEDAW');
        $create->assertJsonPath('data.name', 'Discrimination');

        $this->actingAs($user)->postJson('/api/v1/admin/issue-categories', [
            'convention_id' => $cedaw->id,
            'name' => 'Discrimination',
        ])->assertUnprocessable();

        $this->actingAs($user)->postJson('/api/v1/admin/issue-categories', [
            'convention_id' => $crc->id,
            'name' => 'Discrimination',
        ])->assertCreated();

        $filtered = $this->actingAs($user)->getJson('/api/v1/admin/issue-categories?convention_id='.$cedaw->id);
        $filtered->assertOk();
        $filtered->assertJsonCount(1, 'data');
        $filtered->assertJsonPath('data.0.convention_id', $cedaw->id);

        $public = $this->actingAs($user)->getJson('/api/v1/report-form/issue-categories?convention_id='.$crc->id);
        $public->assertOk();
        $public->assertJsonCount(1, 'data');
        $public->assertJsonPath('data.0.convention_code', 'CRC');
    }

    public function test_store_requires_convention(): void
    {
        $user = $this->superAdmin();
        $this->actingAs($user)->postJson('/api/v1/admin/issue-categories', [
            'name' => 'Unscoped',
        ])->assertUnprocessable();
    }
}
