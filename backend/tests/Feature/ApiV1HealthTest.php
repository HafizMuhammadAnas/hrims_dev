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
}
