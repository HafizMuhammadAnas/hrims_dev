<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Incorrect categories identified on production (hrims_new): IDs 91–100.
     * Remove these first, then map remaining categories to CAT.
     *
     * @var list<int>
     */
    private array $incorrectCategoryIds = [91, 92, 93, 94, 95, 96, 97, 98, 99, 100];

    public function up(): void
    {
        if (! Schema::hasColumn('issue_categories', 'convention_id')) {
            Schema::table('issue_categories', function (Blueprint $table) {
                $table->foreignId('convention_id')->nullable()->after('id')->constrained('conventions')->cascadeOnDelete();
            });
        }

        $catConventionId = DB::table('conventions')->where('code', 'CAT')->value('id');
        if ($catConventionId === null) {
            $now = now();
            $catConventionId = DB::table('conventions')->insertGetId([
                'code' => 'CAT',
                'name' => 'Convention against Torture and Other Cruel, Inhuman or Degrading Treatment or Punishment',
                'description' => null,
                'sort_order' => 4,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // 1) Remove incorrect categories (91–100), reassigning any linked issues first.
        $this->removeIncorrectCategories();

        // 2) Assign CAT to every remaining category that still has no convention.
        DB::table('issue_categories')->whereNull('convention_id')->update(['convention_id' => $catConventionId]);

        // 3) For non-CAT issues still pointing at a CAT category, clone/map a category under that issue's convention.
        $nonCatIssues = DB::table('issues')
            ->where('convention_id', '!=', $catConventionId)
            ->whereNotNull('category_id')
            ->get(['id', 'convention_id', 'category_id']);

        $cloneMap = [];
        $now = now();
        foreach ($nonCatIssues as $issue) {
            $sourceId = (int) $issue->category_id;
            $targetConventionId = (int) $issue->convention_id;
            $key = $sourceId.':'.$targetConventionId;
            if (! isset($cloneMap[$key])) {
                $source = DB::table('issue_categories')->where('id', $sourceId)->first();
                if ($source === null) {
                    continue;
                }
                // Only clone when the category still belongs to a different convention.
                if ((int) ($source->convention_id ?? 0) === $targetConventionId) {
                    $cloneMap[$key] = $sourceId;
                } else {
                    $existingId = DB::table('issue_categories')
                        ->where('convention_id', $targetConventionId)
                        ->where('name', $source->name)
                        ->orderBy('id')
                        ->value('id');
                    if ($existingId) {
                        $cloneMap[$key] = (int) $existingId;
                    } else {
                        $row = [
                            'convention_id' => $targetConventionId,
                            'name' => $source->name,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                        if (Schema::hasColumn('issue_categories', 'is_active')) {
                            $row['is_active'] = (bool) ($source->is_active ?? true);
                        }
                        $cloneMap[$key] = (int) DB::table('issue_categories')->insertGetId($row);
                    }
                }
            }
            DB::table('issues')->where('id', $issue->id)->update(['category_id' => $cloneMap[$key]]);
        }

        // 4) Merge any remaining same-name duplicates under one convention, then add unique index.
        $this->mergeDuplicateCategories();

        if (! $this->hasUniqueIndex('issue_categories', 'issue_categories_convention_name_unique')) {
            Schema::table('issue_categories', function (Blueprint $table) {
                $table->unique(['convention_id', 'name'], 'issue_categories_convention_name_unique');
            });
        }
    }

    public function down(): void
    {
        if ($this->hasUniqueIndex('issue_categories', 'issue_categories_convention_name_unique')) {
            Schema::table('issue_categories', function (Blueprint $table) {
                $table->dropUnique('issue_categories_convention_name_unique');
            });
        }

        if (Schema::hasColumn('issue_categories', 'convention_id')) {
            Schema::table('issue_categories', function (Blueprint $table) {
                $table->dropConstrainedForeignId('convention_id');
            });
        }
    }

    private function removeIncorrectCategories(): void
    {
        $toRemove = DB::table('issue_categories')
            ->whereIn('id', $this->incorrectCategoryIds)
            ->orderBy('id')
            ->get(['id', 'name']);

        foreach ($toRemove as $row) {
            $id = (int) $row->id;
            $replacementId = DB::table('issue_categories')
                ->where('name', $row->name)
                ->whereNotIn('id', $this->incorrectCategoryIds)
                ->orderBy('id')
                ->value('id');

            if ($replacementId) {
                DB::table('issues')->where('category_id', $id)->update(['category_id' => (int) $replacementId]);
            } else {
                // No safe replacement: leave issues untouched and skip delete to avoid cascade.
                $stillUsed = DB::table('issues')->where('category_id', $id)->exists();
                if ($stillUsed) {
                    continue;
                }
            }

            DB::table('issue_categories')->where('id', $id)->delete();
        }
    }

    private function mergeDuplicateCategories(): void
    {
        $duplicates = DB::table('issue_categories')
            ->select('convention_id', 'name', DB::raw('COUNT(*) as n'))
            ->whereNotNull('convention_id')
            ->groupBy('convention_id', 'name')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $dup) {
            $rows = DB::table('issue_categories')
                ->where('convention_id', $dup->convention_id)
                ->where('name', $dup->name)
                ->orderByDesc('is_active')
                ->orderBy('id')
                ->get(['id', 'is_active']);

            if ($rows->count() < 2) {
                continue;
            }

            $keeperId = null;
            $bestScore = -1;
            foreach ($rows as $row) {
                $issueCount = (int) DB::table('issues')->where('category_id', $row->id)->count();
                $score = ((bool) ($row->is_active ?? true) ? 1_000_000 : 0) + $issueCount;
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $keeperId = (int) $row->id;
                } elseif ($score === $bestScore && $keeperId !== null && (int) $row->id < $keeperId) {
                    $keeperId = (int) $row->id;
                }
            }

            if ($keeperId === null) {
                continue;
            }

            foreach ($rows as $row) {
                $id = (int) $row->id;
                if ($id === $keeperId) {
                    continue;
                }
                DB::table('issues')->where('category_id', $id)->update(['category_id' => $keeperId]);
                DB::table('issue_categories')->where('id', $id)->delete();
            }
        }
    }

    private function hasUniqueIndex(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();
        $row = DB::selectOne(
            'SELECT COUNT(*) AS c
             FROM information_schema.statistics
             WHERE table_schema = ?
               AND table_name = ?
               AND index_name = ?',
            [$database, $table, $indexName]
        );

        return ((int) ($row->c ?? 0)) > 0;
    }
};
