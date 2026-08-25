<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
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

        DB::table('issue_categories')->whereNull('convention_id')->update(['convention_id' => $catConventionId]);

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
                $existingId = DB::table('issue_categories')
                    ->where('convention_id', $targetConventionId)
                    ->where('name', $source->name)
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
            DB::table('issues')->where('id', $issue->id)->update(['category_id' => $cloneMap[$key]]);
        }

        Schema::table('issue_categories', function (Blueprint $table) {
            $table->unique(['convention_id', 'name'], 'issue_categories_convention_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('issue_categories', function (Blueprint $table) {
            $table->dropUnique('issue_categories_convention_name_unique');
            $table->dropConstrainedForeignId('convention_id');
        });
    }
};
