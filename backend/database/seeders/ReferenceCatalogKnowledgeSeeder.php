<?php

namespace Database\Seeders;

use App\Models\Article;
use App\Models\Convention;
use App\Models\ConventionComponent;
use App\Models\Issue;
use App\Models\IssueCategory;
use App\Models\IssueIndicator;
use App\Models\KnowledgeCard;
use App\Models\SdgNode;
use App\Models\UprRecommendation;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds conventions, SDG goals, knowledge hub tiles, sample UPR recommendations,
 * per-convention overview components, and demo issue↔catalog mappings.
 * Data mirrors website/frontend/src/data/knowledgeHub.ts plus workflow-friendly samples.
 */
class ReferenceCatalogKnowledgeSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $this->seedConventions();
            $this->seedConventionComponents();
            $this->seedSdgGoals();
            $this->seedUprRecommendations();
            $this->seedKnowledgeCards();
            $this->seedIssueMappings();
        });
    }

    private function seedConventions(): void
    {
        // No knowledge_icon is seeded: the Knowledge Hub renders a built-in vector icon per
        // convention code, and emoji stored here do not survive non-utf8mb4 dumps/imports.
        $rows = [
            ['code' => 'ICERD', 'name' => 'International Convention on the Elimination of All Forms of Racial Discrimination', 'adopted' => '1965', 'ratified' => '1966', 'articles' => '25', 'impl' => '72'],
            ['code' => 'ICCPR', 'name' => 'International Covenant on Civil and Political Rights', 'adopted' => '1966', 'ratified' => '2010', 'articles' => '53', 'impl' => '68'],
            ['code' => 'ICESCR', 'name' => 'International Covenant on Economic, Social and Cultural Rights', 'adopted' => '1966', 'ratified' => '2008', 'articles' => '31', 'impl' => '55'],
            ['code' => 'CEDAW', 'name' => 'Convention on the Elimination of All Forms of Discrimination against Women', 'adopted' => '1979', 'ratified' => '1996', 'articles' => '30', 'impl' => '65'],
            ['code' => 'CAT', 'name' => 'Convention against Torture and Other Cruel, Inhuman or Degrading Treatment or Punishment', 'adopted' => '1984', 'ratified' => '2010', 'articles' => '33', 'impl' => '58'],
            ['code' => 'CRC', 'name' => 'Convention on the Rights of the Child', 'adopted' => '1989', 'ratified' => '1990', 'articles' => '54', 'impl' => '61'],
            ['code' => 'CRPD', 'name' => 'Convention on the Rights of Persons with Disabilities', 'adopted' => '2006', 'ratified' => '2011', 'articles' => '50', 'impl' => '52'],
        ];

        foreach ($rows as $i => $row) {
            $description = $row['name'].' is a core international human rights instrument relevant to HRIMS treaty reporting and national follow-up. Use Request management to link national actions to this convention where applicable.';

            Convention::query()->updateOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'knowledge_adopted' => $row['adopted'],
                    'knowledge_ratified' => $row['ratified'],
                    'knowledge_articles' => $row['articles'],
                    'knowledge_implementation' => $row['impl'],
                    'description' => $description,
                    'sort_order' => $i,
                    'is_active' => true,
                ]
            );
        }
    }

    private function seedConventionComponents(): void
    {
        foreach (Convention::query()->orderBy('sort_order')->get() as $convention) {
            ConventionComponent::query()->updateOrCreate(
                [
                    'convention_id' => $convention->id,
                    'code' => 'OVERVIEW',
                ],
                [
                    'parent_id' => null,
                    'type' => 'overview',
                    'title' => 'Convention overview',
                    'body' => 'Reference summary for '.$convention->name.'. Super administrators can refine this text in the admin console.',
                    'sort_order' => 0,
                ]
            );
        }
    }

    private function seedSdgGoals(): void
    {
        // Icons come from the frontend goal-number map for the same reason as conventions.
        $goals = [
            [1, 'No poverty', 'End poverty in all its forms everywhere'],
            [2, 'Zero hunger', 'End hunger, achieve food security and improved nutrition'],
            [3, 'Good health and well-being', 'Ensure healthy lives and promote well-being for all'],
            [4, 'Quality education', 'Inclusive and equitable quality education'],
            [5, 'Gender equality', 'Achieve gender equality and empower all women and girls'],
            [6, 'Clean water and sanitation', 'Availability and sustainable management of water and sanitation'],
            [7, 'Affordable and clean energy', 'Access to affordable, reliable, sustainable energy'],
            [8, 'Decent work and economic growth', 'Sustained, inclusive and sustainable economic growth'],
            [9, 'Industry, innovation and infrastructure', 'Resilient infrastructure and inclusive industrialization'],
            [10, 'Reduce inequality', 'Reduce inequality within and among countries'],
            [11, 'Sustainable cities and communities', 'Inclusive, safe, resilient and sustainable cities'],
            [12, 'Responsible consumption and production', 'Sustainable consumption and production patterns'],
            [13, 'Climate action', 'Urgent action to combat climate change and impacts'],
            [14, 'Life below water', 'Conserve and sustainably use oceans and marine resources'],
            [15, 'Life on land', 'Protect and restore terrestrial ecosystems'],
            [16, 'Peace, justice and strong institutions', 'Peaceful and inclusive societies and access to justice'],
            [17, 'Partnership for the goals', 'Strengthen means of implementation and global partnership'],
        ];

        foreach ($goals as [$num, $title, $desc]) {
            SdgNode::query()->updateOrCreate(
                ['code' => 'SDG-'.$num],
                [
                    'parent_id' => null,
                    'node_type' => 'goal',
                    'title' => $title,
                    'goal_number' => $num,
                    'summary' => $desc,
                    'body' => null,
                    'stat_1_value' => '—',
                    'stat_1_label' => 'Monitoring',
                    'stat_2_value' => '2030',
                    'stat_2_label' => 'Target',
                    'sort_order' => $num,
                ]
            );
        }
    }

    private function seedUprRecommendations(): void
    {
        $rows = [
            ['session_label' => '41st session', 'code' => 'DEMO-UPR-1', 'title' => 'Strengthen independent national human rights institution in line with the Paris Principles', 'body' => 'Sample UPR recommendation narrative for catalog and issue mapping demos.'],
            ['session_label' => '41st session', 'code' => 'DEMO-UPR-2', 'title' => 'Continue efforts to prevent and combat gender-based violence', 'body' => null],
            ['session_label' => '42nd session', 'code' => 'DEMO-UPR-3', 'title' => 'Ensure inclusive quality education for all children, including girls and minorities', 'body' => null],
        ];

        foreach ($rows as $i => $r) {
            UprRecommendation::query()->updateOrCreate(
                ['code' => $r['code']],
                [
                    'session_label' => $r['session_label'],
                    'title' => $r['title'],
                    'body' => $r['body'],
                    'sort_order' => $i,
                ]
            );
        }
    }

    private function seedKnowledgeCards(): void
    {
        KnowledgeCard::query()->whereIn('section', ['indicators', 'upr'])->delete();

        // Icons stay blank so the Knowledge Hub renders its built-in vector icon per card title.
        $indicators = [
            ['Right to Health', 'Access to healthcare services', '78%', 'Coverage', '15', 'Programs'],
            ['Right to Education', 'Universal access to quality education', '62%', 'Literacy', '28', 'Initiatives'],
            ['Right to Work', 'Fair employment opportunities', '5.8%', 'Unemployment', '12', 'Policies'],
            ['Right to Housing', 'Adequate housing for all', '45%', 'Adequate', '8', 'Projects'],
            ['Right to Food', 'Access to nutritious food', '36%', 'Food Security', '19', 'Programs'],
        ];

        foreach ($indicators as $i => $row) {
            KnowledgeCard::query()->create([
                'section' => 'indicators',
                'icon' => '',
                'title' => $row[0],
                'summary' => $row[1],
                'stat_1_value' => $row[2],
                'stat_1_label' => $row[3],
                'stat_2_value' => $row[4],
                'stat_2_label' => $row[5],
                'body' => null,
                'sort_order' => $i,
            ]);
        }

        $upr = [
            ['Total Recommendations', 'Received in latest cycle', '302', 'Total', '2023', 'Year'],
            ['Accepted', 'For implementation', '253', 'Accepted', '83.7%', 'Rate'],
            ['Noted', 'For consideration', '49', 'Noted', '16.3%', 'Rate'],
            ['Implementation', 'Current progress', '45%', 'Progress', '114', 'Done'],
        ];

        foreach ($upr as $i => $row) {
            KnowledgeCard::query()->create([
                'section' => 'upr',
                'icon' => '',
                'title' => $row[0],
                'summary' => $row[1],
                'stat_1_value' => $row[2],
                'stat_1_label' => $row[3],
                'stat_2_value' => $row[4],
                'stat_2_label' => $row[5],
                'body' => null,
                'sort_order' => $i,
            ]);
        }
    }

    private function seedIssueMappings(): void
    {
        $catA = IssueCategory::query()->where('name', 'A')->first();
        $catB = IssueCategory::query()->where('name', 'B')->first();
        $cedaw = Convention::query()->where('code', 'CEDAW')->first();
        $crc = Convention::query()->where('code', 'CRC')->first();
        $article1 = Article::query()->where('article_name', 'Article 1')->first();
        $article4 = Article::query()->where('article_name', 'Article 4')->first();
        $article5 = Article::query()->where('article_name', 'Article 5')->first();

        if ($cedaw && $catA && $article1) {
            $issue1 = Issue::query()->updateOrCreate(
                [
                    'convention_id' => $cedaw->id,
                    'issue_title' => 'Gender equality — demo mapping',
                ],
                [
                    'category_id' => $catA->id,
                    'has_quantitative' => true,
                    'has_qualitative' => true,
                ]
            );
            $sync = [];
            $sync[$article1->id] = [
                'relevant_paragraph' => 'Relevant paragraph for Article 1 in this issue (CEDAW demo): non-discrimination and equality measures.',
            ];
            if ($article4) {
                $sync[$article4->id] = [
                    'relevant_paragraph' => 'Relevant paragraph for Article 4 in this issue (CEDAW demo): temporary special measures.',
                ];
            }
            $issue1->articles()->sync($sync);
            $issue1->indicators()->delete();
            IssueIndicator::query()->create([
                'issue_id' => $issue1->id,
                'indicator_text' => 'Participation of women in public employment',
                'disaggregation' => '{"sector":"public_admin"}',
            ]);
            IssueIndicator::query()->create([
                'issue_id' => $issue1->id,
                'indicator_text' => 'Qualitative assessment of anti-discrimination policies',
                'disaggregation' => null,
            ]);
        }

        if ($crc && $catB && $article5) {
            $issue2 = Issue::query()->updateOrCreate(
                [
                    'convention_id' => $crc->id,
                    'issue_title' => 'Child rights — demo mapping',
                ],
                [
                    'category_id' => $catB->id,
                    'has_quantitative' => false,
                    'has_qualitative' => true,
                ]
            );
            $issue2->articles()->sync([
                $article5->id => [
                    'relevant_paragraph' => 'Relevant paragraph for Article 5 in this issue (CRC demo): parental guidance and child development.',
                ],
            ]);
            $issue2->indicators()->delete();
            IssueIndicator::query()->create([
                'issue_id' => $issue2->id,
                'indicator_text' => 'Child-friendly justice procedures (narrative review)',
                'disaggregation' => null,
            ]);
        }
    }
}
