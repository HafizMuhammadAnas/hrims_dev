<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiV1HealthTest extends TestCase
{
    public function test_health_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_health_endpoint_works_when_web_server_strips_api_prefix(): void
    {
        $response = $this->getJson('/v1/health');

        $response->assertOk()
            ->assertJsonPath('status', 'ok');
    }
}
