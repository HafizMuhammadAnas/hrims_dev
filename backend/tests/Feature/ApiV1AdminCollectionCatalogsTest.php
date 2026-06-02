<?php

namespace Tests\Feature;

use App\Models\RbacRole;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1AdminCollectionCatalogsTest extends TestCase
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

    public function test_super_admin_can_manage_collection_years_and_genders(): void
    {
        $user = $this->superAdmin();

        $year = $this->actingAs($user)->postJson('/api/v1/admin/collection-years', [
            'label' => '2025',
        ]);
        $year->assertCreated();
        $yearId = $year->json('data.id');

        $gender = $this->actingAs($user)->postJson('/api/v1/admin/collection-genders', [
            'name' => 'Female',
        ]);
        $gender->assertCreated();

        $index = $this->actingAs($user)->getJson('/api/v1/admin/collection-years');
        $index->assertOk();
        $this->assertContains('2025', collect($index->json('data'))->pluck('label')->all());

        $this->actingAs($user)->patchJson('/api/v1/admin/collection-years/'.$yearId, [
            'label' => '2026',
        ])->assertOk();

        $this->actingAs($user)->deleteJson('/api/v1/admin/collection-genders/'.$gender->json('data.id'))
            ->assertOk();
    }
}
