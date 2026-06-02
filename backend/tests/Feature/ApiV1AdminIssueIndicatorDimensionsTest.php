<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\CollectionGender;
use App\Models\CollectionYear;
use App\Models\Convention;
use App\Models\IssueCategory;
use App\Models\RbacRole;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1AdminIssueIndicatorDimensionsTest extends TestCase
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

    public function test_indicator_stores_genders_per_year(): void
    {
        $user = $this->superAdmin();
        $convention = Convention::query()->firstOrFail();
        $category = IssueCategory::query()->firstOrFail();
        $article = Article::query()->firstOrFail();
        $y2024 = CollectionYear::query()->create(['label' => '2024', 'sort_order' => 1]);
        $y2025 = CollectionYear::query()->create(['label' => '2025', 'sort_order' => 2]);
        $female = CollectionGender::query()->create(['name' => 'Female', 'sort_order' => 1]);
        $male = CollectionGender::query()->create(['name' => 'Male', 'sort_order' => 2]);

        $res = $this->actingAs($user)->postJson('/api/v1/admin/issues', [
            'convention_id' => $convention->id,
            'category_id' => $category->id,
            'issue_title' => 'Test issue',
            'has_quantitative' => true,
            'has_qualitative' => false,
            'articles' => [['article_id' => $article->id]],
            'indicators' => [
                [
                    'indicator_text' => 'Indicator A',
                    'has_quantitative' => true,
                    'has_qualitative' => false,
                    'collects_by_year' => true,
                    'collection_by_year' => [
                        [
                            'collection_year_id' => $y2024->id,
                            'collection_gender_ids' => [$female->id, $male->id],
                        ],
                        [
                            'collection_year_id' => $y2025->id,
                            'collection_gender_ids' => [$female->id],
                        ],
                    ],
                ],
            ],
        ]);

        $res->assertCreated();
        $indicator = $res->json('data.indicators.0');
        $this->assertTrue($indicator['collects_by_year']);
        $this->assertCount(2, $indicator['collection_by_year']);

        $byYear = collect($indicator['collection_by_year'])->keyBy('year_id');
        $this->assertSame(
            [$female->id, $male->id],
            collect($byYear[$y2024->id]['gender_ids'])->sort()->values()->all(),
        );
        $this->assertSame(
            [$female->id],
            $byYear[$y2025->id]['gender_ids'],
        );
    }
}
