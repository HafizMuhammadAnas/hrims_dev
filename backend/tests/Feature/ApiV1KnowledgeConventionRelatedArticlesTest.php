<?php

namespace Tests\Feature;

use App\Models\Article;
use App\Models\Convention;
use App\Models\Issue;
use App\Models\IssueCategory;
use App\Models\RbacRole;
use App\Models\User;
use Database\Seeders\RbacSeeder;
use Database\Seeders\RegionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiV1KnowledgeConventionRelatedArticlesTest extends TestCase
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

    private function viewer(): User
    {
        $role = RbacRole::query()->where('slug', 'federal_admin')->firstOrFail();
        $user = User::factory()->create(['region_id' => null, 'department_id' => null]);
        $user->roles()->attach($role);

        return $user;
    }

    public function test_convention_articles_loi_and_observations_include_related_articles(): void
    {
        $user = $this->viewer();
        $convention = Convention::query()->create([
            'code' => 'KNOW',
            'name' => 'Knowledge hub related-articles convention',
            'is_active' => true,
            'sort_order' => 99,
        ]);
        $article = Article::query()->create([
            'convention_id' => $convention->id,
            'article_name' => 'Article 7',
            'description' => 'No one shall be subjected to torture.',
            'is_active' => true,
        ]);
        $unrelated = Article::query()->create([
            'convention_id' => $convention->id,
            'article_name' => 'Article 8',
            'description' => 'Slavery is prohibited.',
            'is_active' => true,
        ]);
        $category = IssueCategory::query()->firstOrFail();

        $loi = Issue::query()->create([
            'convention_id' => $convention->id,
            'category_id' => $category->id,
            'entry_kind' => 'issue',
            'issue_title' => 'Independent investigations',
            'description' => 'Describe investigation measures.',
            'is_active' => true,
        ]);
        $loi->articles()->sync([$article->id]);

        $observation = Issue::query()->create([
            'convention_id' => $convention->id,
            'category_id' => $category->id,
            'entry_kind' => 'recommendation',
            'issue_title' => 'Committee follow-up',
            'description' => 'The State party should prosecute torture.',
            'is_active' => true,
        ]);
        $observation->articles()->sync([$article->id]);

        $articles = $this->actingAs($user)->getJson("/api/v1/knowledge/conventions/{$convention->id}/articles");
        $articles->assertOk();
        $articles->assertJsonPath('data.0.article_name', 'Article 7');
        $articles->assertJsonPath('data.0.related_loi.0.id', $loi->id);
        $articles->assertJsonPath('data.0.related_loi.0.issue_title', 'Independent investigations');
        $articles->assertJsonPath('data.0.related_concluding_observations.0.id', $observation->id);
        $this->assertSame('Article 8', $articles->json('data.1.article_name'));
        $this->assertSame([], $articles->json('data.1.related_loi'));
        $this->assertSame([], $articles->json('data.1.related_concluding_observations'));
        $this->assertNotNull($unrelated->id);

        $loiList = $this->actingAs($user)->getJson(
            "/api/v1/knowledge/conventions/{$convention->id}/issues?entry_kind=issue"
        );
        $loiList->assertOk();
        $loiList->assertJsonPath('data.0.id', $loi->id);
        $loiList->assertJsonPath('data.0.articles.0.id', $article->id);
        $loiList->assertJsonPath('data.0.articles.0.article_name', 'Article 7');

        $observations = $this->actingAs($user)->getJson(
            "/api/v1/knowledge/conventions/{$convention->id}/issues?entry_kind=recommendation"
        );
        $observations->assertOk();
        $observations->assertJsonPath('data.0.id', $observation->id);
        $observations->assertJsonPath('data.0.articles.0.id', $article->id);
        $observations->assertJsonPath('data.0.articles.0.article_name', 'Article 7');
    }
}
