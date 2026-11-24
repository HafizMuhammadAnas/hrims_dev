<?php

namespace Tests\Feature;

use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
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
        Mail::fake();
    }

    public function test_login_session_survives_subsequent_get_with_referer(): void
    {
        $federal = Region::query()->where('slug', 'ict')->firstOrFail();
        $user = User::factory()->create([
            'username' => 'federal_session_test',
            'password' => 'password',
            'email' => 'federal_session_test@example.test',
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
            ->assertJsonPath('requires_2fa', true);

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/verify-2fa', [
                'code' => '123456',
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

    public function test_login_requires_2fa_and_rejects_wrong_code(): void
    {
        $federal = Region::query()->where('slug', 'ict')->firstOrFail();
        User::factory()->create([
            'username' => 'otp_user',
            'password' => 'password',
            'email' => 'otp_user@example.test',
            'region_id' => $federal->id,
        ]);

        $this->getJson('/api/v1/auth/csrf-cookie')->assertNoContent();

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/login', [
                'username' => 'otp_user',
                'password' => 'password',
            ])
            ->assertOk()
            ->assertJsonPath('requires_2fa', true);

        $this->withHeader('Origin', 'http://localhost:5173')
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/verify-2fa', [
                'code' => '000000',
            ])
            ->assertStatus(422);
    }

    public function test_super_admin_login_skips_2fa(): void
    {
        $user = User::factory()->create([
            'username' => 'super_otp_skip',
            'password' => 'password',
            'email' => 'super_otp_skip@example.test',
        ]);
        $role = RbacRole::query()->where('slug', 'super_admin')->firstOrFail();
        $user->roles()->attach($role);

        $this->getJson('/api/v1/auth/csrf-cookie')->assertNoContent();

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/login', [
                'username' => 'super_otp_skip',
                'password' => 'password',
            ])
            ->assertOk()
            ->assertJsonMissing(['requires_2fa' => true])
            ->assertJsonPath('data.username', 'super_otp_skip');

        $this->withHeader('Origin', 'http://localhost:5173')
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.username', 'super_otp_skip');
    }

    public function test_login_skips_2fa_when_globally_disabled(): void
    {
        app(\App\Services\SystemSettingService::class)->setLoginOtpEnabled(false);

        $federal = Region::query()->where('slug', 'ict')->firstOrFail();
        User::factory()->create([
            'username' => 'otp_off_user',
            'password' => 'password',
            'email' => 'otp_off_user@example.test',
            'region_id' => $federal->id,
        ]);

        $this->getJson('/api/v1/auth/csrf-cookie')->assertNoContent();

        $this->withHeader('Origin', 'http://localhost:5173')
            ->postJson('/api/v1/auth/login', [
                'username' => 'otp_off_user',
                'password' => 'password',
            ])
            ->assertOk()
            ->assertJsonMissing(['requires_2fa' => true])
            ->assertJsonPath('data.username', 'otp_off_user');
    }
}
