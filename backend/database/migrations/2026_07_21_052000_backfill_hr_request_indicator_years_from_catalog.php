<?php

use App\Models\HrRequest;
use App\Models\HrRequestIndicatorResponse;
use App\Models\HrRequestIndicatorYear;
use App\Models\IssueIndicator;
use Illuminate\Database\Migrations\Migration;

/**
 * Backfill request-scoped years from catalog years for existing HR requests
 * so department portals keep working after years move to Federal create.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable('hr_request_indicator_years')) {
            return;
        }

        $responses = HrRequestIndicatorResponse::query()->get();
        foreach ($responses as $resp) {
            $exists = HrRequestIndicatorYear::query()
                ->where('hr_request_id', $resp->hr_request_id)
                ->where('issue_indicator_id', $resp->issue_indicator_id)
                ->exists();
            if ($exists) {
                continue;
            }

            $indicator = IssueIndicator::query()
                ->with(['collectionYearRows', 'yearGenderCells'])
                ->find($resp->issue_indicator_id);
            if (! $indicator) {
                continue;
            }

            $quantYearIds = $indicator->quantitativeCollectionYearIds();
            $qualYearIds = $indicator->qualitativeCollectionYearIds();

            foreach ($quantYearIds as $yearId) {
                HrRequestIndicatorYear::query()->firstOrCreate([
                    'hr_request_id' => $resp->hr_request_id,
                    'issue_indicator_id' => $resp->issue_indicator_id,
                    'collection_year_id' => $yearId,
                    'kind' => HrRequestIndicatorYear::KIND_QUANTITATIVE,
                ]);
            }
            foreach ($qualYearIds as $yearId) {
                HrRequestIndicatorYear::query()->firstOrCreate([
                    'hr_request_id' => $resp->hr_request_id,
                    'issue_indicator_id' => $resp->issue_indicator_id,
                    'collection_year_id' => $yearId,
                    'kind' => HrRequestIndicatorYear::KIND_QUALITATIVE,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Keep backfilled rows; safe no-op.
    }
};
