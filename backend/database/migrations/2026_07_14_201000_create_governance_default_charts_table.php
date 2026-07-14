<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('governance_default_charts', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('kind', 32); // trend | comparison
            $table->string('title', 500);
            $table->string('shape', 32); // line|bar|area|step|pie|composed
            $table->string('series_a_key', 64)->default('total');
            $table->string('series_a_label', 255)->default('Total');
            $table->unsignedBigInteger('series_a_indicator_id')->nullable();
            $table->string('series_b_key', 64)->nullable();
            $table->string('series_b_label', 255)->nullable();
            $table->unsignedBigInteger('series_b_indicator_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('series_a_indicator_id')->references('id')->on('issue_indicators')->nullOnDelete();
            $table->foreign('series_b_indicator_id')->references('id')->on('issue_indicators')->nullOnDelete();
            $table->index(['is_active', 'sort_order']);
        });

        $this->seedDefaults();
    }

    public function down(): void
    {
        Schema::dropIfExists('governance_default_charts');
    }

    private function seedDefaults(): void
    {
        $defs = [
            [
                'kind' => 'comparison',
                'title' => 'Torture Complaints: Received vs Investigated',
                'shape' => 'composed',
                'series_a_key' => 'received',
                'series_a_label' => 'Complaints Received',
                'series_a_match' => ['number of torture complaints received'],
                'series_a_exact' => 'number of torture complaints received',
                'series_a_excludes' => [],
                'series_b_key' => 'investigated',
                'series_b_label' => 'Complaints Investigated',
                'series_b_match' => ['number of complaints investigated'],
                'series_b_exact' => 'number of complaints investigated',
                'series_b_excludes' => ['against torture', 'torture-related'],
            ],
            [
                'kind' => 'trend',
                'title' => 'Number of officials suspended pending investigation',
                'shape' => 'line',
                'series_a_key' => 'total',
                'series_a_label' => 'Total',
                'series_a_match' => ['number of officials suspended pending investigation'],
                'series_a_exact' => 'number of officials suspended pending investigation',
                'series_a_excludes' => [],
            ],
            [
                'kind' => 'trend',
                'title' => 'Number of prosecutions initiated',
                'shape' => 'bar',
                'series_a_key' => 'total',
                'series_a_label' => 'Total',
                'series_a_match' => ['number of prosecutions initiated'],
                'series_a_exact' => 'number of prosecutions initiated',
                'series_a_excludes' => ['under the torture', 'attempt to commit', 'complicity', 'counter terrorism', 'custodial deaths', 'based on torture'],
            ],
            [
                'kind' => 'trend',
                'title' => 'Number of convictions secured',
                'shape' => 'area',
                'series_a_key' => 'total',
                'series_a_label' => 'Total',
                'series_a_match' => ['number of convictions secured'],
                'series_a_exact' => 'number of convictions secured',
                'series_a_excludes' => ['for torture offences', 'counter terrorism', 'torture-related', 'police officials'],
            ],
            [
                'kind' => 'trend',
                'title' => 'Number of custodial rape cases reported',
                'shape' => 'step',
                'series_a_key' => 'total',
                'series_a_label' => 'Total',
                'series_a_match' => ['number of custodial rape cases reported'],
                'series_a_exact' => 'number of custodial rape cases reported',
                'series_a_excludes' => [],
            ],
            [
                'kind' => 'trend',
                'title' => 'Number of torture complaints registered under the Torture and Custodial Death (Prevention and Punishment) Act, 2022',
                'shape' => 'pie',
                'series_a_key' => 'total',
                'series_a_label' => 'Total',
                'series_a_match' => ['number of torture complaints registered under the torture and custodial death'],
                'series_a_exact' => 'number of torture complaints registered under the torture and custodial death (prevention and punishment) act, 2022',
                'series_a_excludes' => [],
            ],
            [
                'kind' => 'comparison',
                'title' => 'Superior Officers: Prosecuted vs Convicted',
                'shape' => 'line',
                'series_a_key' => 'prosecuted',
                'series_a_label' => 'Prosecuted',
                'series_a_match' => ['number of superior officers prosecuted'],
                'series_a_exact' => 'number of superior officers prosecuted',
                'series_a_excludes' => [],
                'series_b_key' => 'convicted',
                'series_b_label' => 'Convicted',
                'series_b_match' => ['number of superior officers', 'convicted'],
                'series_b_exact' => 'number of superior officers convicted',
                'series_b_excludes' => ['prosecuted', 'investigated'],
            ],
        ];

        $indicators = DB::table('issue_indicators')->select('id', 'indicator_text')->get();
        $now = now();
        $sort = 0;
        foreach ($defs as $def) {
            $aId = $this->matchIndicatorId(
                $indicators,
                $def['series_a_match'],
                $def['series_a_exact'] ?? null,
                $def['series_a_excludes'] ?? [],
            );
            $bId = null;
            if (($def['kind'] ?? '') === 'comparison') {
                $bId = $this->matchIndicatorId(
                    $indicators,
                    $def['series_b_match'] ?? [],
                    $def['series_b_exact'] ?? null,
                    $def['series_b_excludes'] ?? [],
                );
            }

            DB::table('governance_default_charts')->insert([
                'sort_order' => $sort++,
                'kind' => $def['kind'],
                'title' => $def['title'],
                'shape' => $def['shape'],
                'series_a_key' => $def['series_a_key'],
                'series_a_label' => $def['series_a_label'],
                'series_a_indicator_id' => $aId,
                'series_b_key' => $def['series_b_key'] ?? null,
                'series_b_label' => $def['series_b_label'] ?? null,
                'series_b_indicator_id' => $bId,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, object>  $indicators
     * @param  list<string>  $includes
     * @param  list<string>  $excludes
     */
    private function matchIndicatorId($indicators, array $includes, ?string $preferExact, array $excludes): ?int
    {
        $bestId = null;
        $bestScore = -1;
        foreach ($indicators as $row) {
            $text = $this->norm((string) $row->indicator_text);
            $skip = false;
            foreach ($excludes as $ex) {
                if (str_contains($text, $this->norm($ex))) {
                    $skip = true;
                    break;
                }
            }
            if ($skip) {
                continue;
            }
            foreach ($includes as $inc) {
                if (! str_contains($text, $this->norm($inc))) {
                    $skip = true;
                    break;
                }
            }
            if ($skip) {
                continue;
            }
            $score = 10 + strlen(implode('', $includes));
            if ($preferExact) {
                $prefer = $this->norm($preferExact);
                if ($text === $prefer) {
                    $score += 1000;
                } elseif (str_starts_with($text, $prefer)) {
                    $score += 500;
                }
            }
            $score += max(0, 200 - strlen($text));
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestId = (int) $row->id;
            }
        }

        return $bestId;
    }

    private function norm(string $s): string
    {
        return trim(preg_replace('/\s+/', ' ', strtolower(str_replace('.', '', $s))) ?? '');
    }
};
