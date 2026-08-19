<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompiledRecord;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
use App\Models\HrRequestClarification;
use App\Models\RegionalResponse;
use App\Models\User;
use App\Support\HrimsAccess;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = HrRequest::query();
        HrimsAccess::applyHrRequestScope($query, $user);

        $byStatus = (clone $query)
            ->select('status', DB::raw('count(*) as c'))
            ->groupBy('status')
            ->pluck('c', 'status')
            ->map(fn ($c) => (int) $c)
            ->all();

        $total = (clone $query)->count();

        $today = Carbon::now()->toDateString();
        $mapRequestRow = static fn (HrRequest $r) => [
            'id' => $r->id,
            'title' => $r->title,
            'status' => $r->status,
            'date' => $r->due_date?->format('Y-m-d'),
            'region_name' => $r->region?->name,
        ];

        $urgent = (clone $query)
            ->where(function ($q) use ($today): void {
                $q->where('status', 'draft')
                    ->orWhere(function ($q2) use ($today): void {
                        $q2->where('status', 'active')
                            ->whereDate('due_date', '<', $today);
                    });
            })
            ->orderByDesc('updated_at')
            ->limit(5)
            ->with(['region:id,name'])
            ->get(['id', 'title', 'status', 'due_date', 'region_id'])
            ->map($mapRequestRow)
            ->values()
            ->all();

        // Recent received / in-scope requests for the dashboard list (not only overdue).
        $recentRequests = (clone $query)
            ->orderByDesc('updated_at')
            ->limit(8)
            ->with(['region:id,name'])
            ->get(['id', 'title', 'status', 'due_date', 'region_id'])
            ->map($mapRequestRow)
            ->values()
            ->all();

        $createdTrend = $this->monthlyCounts(clone $query, 'created_at', 6);

        $data = [
            'hr_requests_total' => $total,
            'by_status' => $byStatus,
            'urgent_requests' => $urgent,
            'recent_requests' => $recentRequests,
            'requests_created_by_month' => $createdTrend,
        ];

        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin') || $user->hasRole('regional_admin')) {
            $respQ = $this->scopedRegionalResponsesQuery($user);
            $data['regional_responses_total'] = (clone $respQ)->count();
            $data['regional_responses_by_review'] = (clone $respQ)
                ->select('review_status', DB::raw('count(*) as c'))
                ->groupBy('review_status')
                ->pluck('c', 'review_status')
                ->map(fn ($c) => (int) $c)
                ->all();
        }

        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            $compiledTotal = CompiledRecord::query()->count();
            $activeCount = (int) ($byStatus['active'] ?? 0);
            $data['regional_responses_pending_submission'] = $this->pendingProvincialResponsesCount($user);
            $data['compiled_records_total'] = $compiledTotal;
            $data['hr_requests_pending_federal'] = max(0, $activeCount - $compiledTotal);
            $data['clarifications_pending_federal'] = HrRequestClarification::query()
                ->where('status', 'pending_federal')
                ->count();
        }

        if ($user->hasRole('regional_admin') && $user->region_id !== null) {
            $tq = DepartmentTask::query()->where('region_id', $user->region_id);
            $data['department_tasks_total'] = (clone $tq)->count();
            $data['department_tasks_by_status'] = (clone $tq)
                ->select('status', DB::raw('count(*) as c'))
                ->groupBy('status')
                ->pluck('c', 'status')
                ->map(fn ($c) => (int) $c)
                ->all();
            $data['department_tasks_by_workflow'] = $this->departmentTasksByWorkflow(clone $tq);
        }

        if ($user->hasRole('department_admin') || $user->hasRole('viewer')) {
            if ($user->department_id) {
                $tq = DepartmentTask::query()->where('department_id', $user->department_id);
                $data['department_tasks_total'] = (clone $tq)->count();
                $data['department_tasks_by_status'] = (clone $tq)
                    ->select('status', DB::raw('count(*) as c'))
                    ->groupBy('status')
                    ->pluck('c', 'status')
                    ->map(fn ($c) => (int) $c)
                    ->all();
                $data['department_tasks_by_workflow'] = $this->departmentTasksByWorkflow(clone $tq);
                $data['department_tasks_by_month'] = $this->monthlyCounts(clone $tq, 'assigned_date', 6);

                $openForAction = DepartmentTask::query()
                    ->where('department_id', $user->department_id)
                    ->where(function ($q): void {
                        $q->where('status', 'assigned')
                            ->orWhere(function ($q2): void {
                                $q2->where('status', 'submitted')
                                    ->where('regional_review_status', 'needs-modification');
                            });
                    })
                    ->orderByDesc('assigned_date')
                    ->limit(5)
                    ->with(['region', 'hrRequest:id,title,due_date,region_id'])
                    ->get();

                $data['urgent_department_tasks'] = $openForAction->map(function (DepartmentTask $t) {
                    $status = $t->regional_review_status === 'needs-modification' ? 'needs-revision' : 'pending';

                    return [
                        'task_id' => $t->id,
                        'id' => $t->hr_request_id,
                        'title' => $t->hrRequest?->title ?? $t->hr_request_id,
                        'status' => $status,
                        'date' => $t->hrRequest?->due_date?->format('Y-m-d'),
                        'region_name' => $t->region?->name,
                    ];
                })->values()->all();
            } else {
                $data['department_tasks_total'] = 0;
                $data['department_tasks_by_status'] = [];
                $data['department_tasks_by_workflow'] = $this->emptyDepartmentWorkflowCounts();
                $data['department_tasks_by_month'] = $this->emptyMonthSeries(6);
                $data['urgent_department_tasks'] = [];
            }
        }

        return response()->json(['data' => $data]);
    }

    /**
     * Department task workflow buckets (aligned with department/regional task lists).
     *
     * @return array{in_process: int, responded: int, revision: int, accepted: int}
     */
    private function departmentTasksByWorkflow(Builder $taskQuery): array
    {
        $rows = (clone $taskQuery)->get(['status', 'regional_review_status', 'submission_date']);
        $out = $this->emptyDepartmentWorkflowCounts();

        foreach ($rows as $row) {
            $status = (string) $row->getAttribute('status');
            $review = $row->getAttribute('regional_review_status');
            $submissionDate = $row->getAttribute('submission_date');
            $hasResponse = $submissionDate !== null || $status === 'submitted';

            if (! $hasResponse) {
                $out['in_process']++;
                continue;
            }

            if ($review === 'needs-modification') {
                $out['revision']++;
                continue;
            }

            if ($review === 'accepted') {
                $out['accepted']++;
                continue;
            }

            $out['responded']++;
        }

        return $out;
    }

    /**
     * Assigned provinces (ICT / national line excluded) that have not submitted
     * a regional compilation yet — the federal "Pending Responses" figure.
     */
    private function pendingProvincialResponsesCount(User $user): int
    {
        $requestQuery = HrRequest::query();
        HrimsAccess::applyHrRequestScope($requestQuery, $user);

        return (int) DB::table('hr_request_region as hrr')
            ->join('regions as r', 'r.id', '=', 'hrr.region_id')
            ->whereIn('hrr.hr_request_id', $requestQuery->select('hr_requests.id'))
            ->whereNotIn('r.slug', ['ict', 'federal'])
            ->whereNotExists(function ($q): void {
                $q->select(DB::raw(1))
                    ->from('regional_responses as rr')
                    ->whereColumn('rr.hr_request_id', 'hrr.hr_request_id')
                    ->whereColumn('rr.region_id', 'hrr.region_id');
            })
            ->count();
    }

    /**
     * @return array{in_process: int, responded: int, revision: int, accepted: int}
     */
    private function emptyDepartmentWorkflowCounts(): array
    {
        return [
            'in_process' => 0,
            'responded' => 0,
            'revision' => 0,
            'accepted' => 0,
        ];
    }

    private function scopedRegionalResponsesQuery(User $user): Builder
    {
        $query = RegionalResponse::query();

        if ($user->hasRole('super_admin') || $user->hasRole('federal_admin')) {
            return $query;
        }

        if ($user->hasRole('regional_admin') && $user->region_id !== null) {
            return $query->where('region_id', $user->region_id);
        }

        if (($user->hasRole('department_admin') || $user->hasRole('viewer')) && $user->department_id) {
            $ids = HrimsAccess::hrRequestIdsForDepartmentUser($user);
            if ($ids === []) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('hr_request_id', $ids);
            }
            if ($user->region_id !== null) {
                $query->where('region_id', $user->region_id);
            }

            return $query;
        }

        $query->whereRaw('1 = 0');

        return $query;
    }

    /**
     * @return list<array{month: string, label: string, count: int}>
     */
    private function monthlyCounts(Builder $query, string $dateColumn, int $months): array
    {
        $start = Carbon::now()->copy()->subMonths($months - 1)->startOfMonth();

        $rows = (clone $query)
            ->whereNotNull($dateColumn)
            ->where($dateColumn, '>=', $start)
            ->get([$dateColumn]);

        $buckets = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $m = Carbon::now()->copy()->subMonths($i)->startOfMonth();
            $buckets[$m->format('Y-m')] = 0;
        }

        foreach ($rows as $row) {
            $d = $row->getAttribute($dateColumn);
            if ($d === null) {
                continue;
            }
            $c = $d instanceof Carbon ? $d : Carbon::parse((string) $d);
            $key = $c->copy()->startOfMonth()->format('Y-m');
            if (array_key_exists($key, $buckets)) {
                $buckets[$key]++;
            }
        }

        return $this->bucketsToSeries($buckets);
    }

    /**
     * @return list<array{month: string, label: string, count: int}>
     */
    private function emptyMonthSeries(int $months): array
    {
        $buckets = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $m = Carbon::now()->copy()->subMonths($i)->startOfMonth();
            $buckets[$m->format('Y-m')] = 0;
        }

        return $this->bucketsToSeries($buckets);
    }

    /**
     * @param  array<string, int>  $buckets
     * @return list<array{month: string, label: string, count: int}>
     */
    private function bucketsToSeries(array $buckets): array
    {
        $out = [];
        foreach ($buckets as $ym => $count) {
            $d = Carbon::createFromFormat('Y-m', $ym)->startOfMonth();
            $out[] = [
                'month' => $ym,
                'label' => $d->format('M Y'),
                'count' => $count,
            ];
        }

        return $out;
    }
}
