<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_request_convention')) {
            Schema::create('hr_request_convention', function (Blueprint $table) {
                $table->string('hr_request_id', 64);
                $table->foreignId('convention_id')->constrained('conventions')->cascadeOnDelete();
                $table->primary(['hr_request_id', 'convention_id']);
                $table->foreign('hr_request_id')->references('id')->on('hr_requests')->cascadeOnDelete();
            });
        }

        // Backfill from the legacy single convention_id column.
        if (Schema::hasColumn('hr_requests', 'convention_id')) {
            DB::table('hr_request_convention')->insertUsing(
                ['hr_request_id', 'convention_id'],
                DB::table('hr_requests')
                    ->select('id', 'convention_id')
                    ->whereNotNull('convention_id')
                    ->whereNotExists(function ($q): void {
                        $q->select(DB::raw(1))
                            ->from('hr_request_convention as hrc')
                            ->whereColumn('hrc.hr_request_id', 'hr_requests.id')
                            ->whereColumn('hrc.convention_id', 'hr_requests.convention_id');
                    })
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_request_convention');
    }
};
