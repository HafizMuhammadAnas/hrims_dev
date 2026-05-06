<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DepartmentTask;
use App\Models\HrRequest;
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

        $urgent = (clone $query)
            ->where(function ($q): void {
                $q->whereIn('status', ['pending', 'overdue'])
                    ->orWhere(function ($q2): void {
                        $q2->where('status', 'in-progress')
                            ->whereDate('due_date', '<', Carbon::now()->toDateString());
                    });
            })
            ->orderByDesc('updated_at')
            ->limit(5)
            ->with(['region:id,name'])
            ->get(['id', 'title', 'status', 'due_date', 'region_id'])
            ->map(fn (HrRequest $r) => [
                'id' => $r->id,
                'title' => $r->title,
                'status' => $r->status,
                'date' => $r->due_date?->format('Y-m-d'),
                'region_name' => $r->region?->name,
            ])
            ->values()
            ->all();

        $createdTrend = $this->monthlyCounts(clone $query, 'created_at', 6);

        $data = [
            'hr_requests_total' => $total,
            'by_status' => $byStatus,
            'urgent_requests' => $urgent,
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
                $data['department_tasks_by_month'] = $this->monthlyCounts(clone $tq, 'assigned_date', 6);
            } else {
                $data['department_tasks_total'] = 0;
                $data['department_tasks_by_status'] = [];
                $data['department_tasks_by_month'] = $this->emptyMonthSeries(6);
            }
        }

        return response()->json(['data' => $data]);
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
