<?php

namespace Tests\Feature;

use App\Models\Convention;
use App\Models\RbacRole;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1ConventionKnowledgeContentTest extends TestCase
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

    public function test_admin_can_store_overview_repositories_and_optional_protocol(): void
    {
        $user = $this->superAdmin();

        $create = $this->actingAs($user)->postJson('/api/v1/admin/conventions', [
            'code' => 'CRC',
            'name' => 'Convention on the Rights of the Child',
            'description' => 'CRC overview for the knowledge hub.',
            'optional_protocol_body' => 'Optional protocol on children in armed conflict.',
            'repositories' => [
                [
                    'title' => 'First cycle',
                    'documents' => [
                        [
                            'title' => 'State report',
                            'href' => '/knowledge/crc/state-report.pdf',
                            'type_label' => 'PDF report',
                        ],
                    ],
                ],
            ],
        ]);
        $create->assertCreated();
        $create->assertJsonPath('data.code', 'CRC');
        $create->assertJsonPath('data.description', 'CRC overview for the knowledge hub.');
        $create->assertJsonPath('data.optional_protocol_body', 'Optional protocol on children in armed conflict.');
        $create->assertJsonPath('data.repositories.0.title', 'First cycle');
        $create->assertJsonPath('data.repositories.0.documents.0.title', 'State report');

        $id = (int) $create->json('data.id');
        $public = $this->actingAs($user)->getJson('/api/v1/knowledge/conventions/'.$id);
        $public->assertOk();
        $public->assertJsonPath('data.description', 'CRC overview for the knowledge hub.');
        $public->assertJsonPath('data.repositories.0.documents.0.href', '/knowledge/crc/state-report.pdf');
        $public->assertJsonPath('data.optional_protocol_body', 'Optional protocol on children in armed conflict.');

        $this->assertDatabaseHas('conventions', ['id' => $id, 'code' => 'CRC']);
        $row = Convention::query()->findOrFail($id);
        $this->assertNotEmpty($row->normalizedRepositories());
    }
}
