<?php

namespace Tests\Feature;

use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1AuthSessionTest extends TestCase
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

    public function test_login_session_survives_subsequent_get_with_referer(): void
    {
        $federal = Region::query()->where('slug', 'ict')->firstOrFail();
        $user = User::factory()->create([
            'username' => 'federal_session_test',
            'password' => 'password',
            'region_id' => $federal->id,
        ]);
        $role = RbacRole::query()->where('slug', 'federal_admin')->firstOrFail();
        $user->roles()->attach($role);

        $this->getJson('/api/v1/auth/csrf-cookie')->assertNoContent();

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/login', [
                'username' => 'federal_session_test',
                'password' => 'password',
            ])
            ->assertOk()
            ->assertJsonPath('data.username', 'federal_session_test');

        $this->withHeader('Referer', 'http://localhost:5173/requests')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.username', 'federal_session_test');

        $this->withHeader('Referer', 'http://localhost:5173/requests')
            ->getJson('/api/v1/hr-requests')
            ->assertOk();
    }
}
