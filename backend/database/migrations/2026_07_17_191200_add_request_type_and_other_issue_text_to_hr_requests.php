<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hr_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('hr_requests', 'request_type')) {
                $table->string('request_type', 32)->nullable()->index()->after('issue_id');
            }
            if (! Schema::hasColumn('hr_requests', 'other_issue_text')) {
                $table->longText('other_issue_text')->nullable()->after('request_type');
            }
        });

        if (
            Schema::hasColumn('hr_requests', 'request_type')
            && Schema::hasTable('issues')
            && Schema::hasColumn('issues', 'entry_kind')
        ) {
            $linkedRequests = DB::table('hr_requests')
                ->join('issues', 'issues.id', '=', 'hr_requests.issue_id')
                ->whereNull('hr_requests.request_type')
                ->select(['hr_requests.id', 'issues.entry_kind'])
                ->get();

            foreach ($linkedRequests as $linkedRequest) {
                DB::table('hr_requests')
                    ->where('id', $linkedRequest->id)
                    ->update([
                        'request_type' => $linkedRequest->entry_kind === 'recommendation'
                            ? 'concluding_observation'
                            : 'loi',
                    ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('hr_requests', function (Blueprint $table) {
            if (Schema::hasColumn('hr_requests', 'other_issue_text')) {
                $table->dropColumn('other_issue_text');
            }
            if (Schema::hasColumn('hr_requests', 'request_type')) {
                $table->dropIndex(['request_type']);
                $table->dropColumn('request_type');
            }
        });
    }
};
