<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Replace workflow-style statuses with publication lifecycle: draft | active.
     */
    public function up(): void
    {
        DB::table('hr_requests')->whereIn('status', ['pending', 'in-progress', 'overdue'])->update(['status' => 'draft']);
        DB::table('hr_requests')->where('status', 'completed')->update(['status' => 'active']);
    }

    public function down(): void
    {
        DB::table('hr_requests')->where('status', 'draft')->update(['status' => 'pending']);
        DB::table('hr_requests')->where('status', 'active')->update(['status' => 'in-progress']);
    }
};
