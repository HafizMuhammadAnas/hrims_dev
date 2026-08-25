<?php

namespace App\Console\Commands;

use App\Models\IssueCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RepairIssueCategoryConventionsCommand extends Command
{
    protected $signature = 'hrims:repair-issue-category-conventions {--dry-run : Show what would change without writing}';

    protected $description = 'Remap issues whose category belongs to a different convention (clone category by name when needed)';

    public function handle(): int
    {
        if (! Schema::hasColumn('issue_categories', 'convention_id')) {
            $this->error('issue_categories.convention_id is missing. Run php artisan migrate --force first.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $mismatched = DB::table('issues as i')
            ->join('issue_categories as ic', 'ic.id', '=', 'i.category_id')
            ->whereColumn('i.convention_id', '<>', 'ic.convention_id')
            ->get([
                'i.id as issue_id',
                'i.convention_id as issue_convention_id',
                'i.category_id as category_id',
                'ic.name as category_name',
                'ic.is_active as category_is_active',
            ]);

        if ($mismatched->isEmpty()) {
            $this->info('No mismatched issue/category rows found.');

            return self::SUCCESS;
        }

        $this->info('Found '.$mismatched->count().' mismatched issue(s).');
        $cloneMap = [];
        $updated = 0;

        foreach ($mismatched as $row) {
            $sourceId = (int) $row->category_id;
            $targetConventionId = (int) $row->issue_convention_id;
            $key = $sourceId.':'.$targetConventionId;

            if (! isset($cloneMap[$key])) {
                $existingId = DB::table('issue_categories')
                    ->where('convention_id', $targetConventionId)
                    ->where('name', $row->category_name)
                    ->orderByDesc('is_active')
                    ->orderBy('id')
                    ->value('id');

                if ($existingId) {
                    $cloneMap[$key] = (int) $existingId;
                } elseif ($dryRun) {
                    $cloneMap[$key] = -1;
                    $this->line("Would clone category \"{$row->category_name}\" under convention #{$targetConventionId}");
                } else {
                    $cloneMap[$key] = (int) IssueCategory::query()->create([
                        'convention_id' => $targetConventionId,
                        'name' => $row->category_name,
                        'is_active' => (bool) ($row->category_is_active ?? true),
                    ])->id;
                    $this->line("Cloned category \"{$row->category_name}\" => #{$cloneMap[$key]} for convention #{$targetConventionId}");
                }
            }

            $newCategoryId = $cloneMap[$key];
            if ($newCategoryId <= 0) {
                continue;
            }

            if ($dryRun) {
                $this->line("Would update issue #{$row->issue_id}: category {$sourceId} -> {$newCategoryId}");
            } else {
                DB::table('issues')->where('id', $row->issue_id)->update(['category_id' => $newCategoryId]);
                $updated++;
            }
        }

        if ($dryRun) {
            $this->info('Dry run complete. Re-run without --dry-run to apply.');
        } else {
            $this->info("Updated {$updated} issue(s).");
        }

        return self::SUCCESS;
    }
}
