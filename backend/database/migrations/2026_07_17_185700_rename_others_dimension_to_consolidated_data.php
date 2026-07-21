<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasColumn('issue_indicators', 'collects_by_others')
            && ! Schema::hasColumn('issue_indicators', 'collects_by_consolidated')
        ) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->renameColumn('collects_by_others', 'collects_by_consolidated');
            });
        } elseif (! Schema::hasColumn('issue_indicators', 'collects_by_consolidated')) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->boolean('collects_by_consolidated')->default(false)->after('collects_by_religion');
            });
        }

        $this->renameStoredResponseKeys(
            'by_year_others',
            'by_year_consolidated',
            'others',
            'consolidated',
        );
    }

    public function down(): void
    {
        $this->renameStoredResponseKeys(
            'by_year_consolidated',
            'by_year_others',
            'consolidated',
            'others',
        );

        if (
            Schema::hasColumn('issue_indicators', 'collects_by_consolidated')
            && ! Schema::hasColumn('issue_indicators', 'collects_by_others')
        ) {
            Schema::table('issue_indicators', function (Blueprint $table) {
                $table->renameColumn('collects_by_consolidated', 'collects_by_others');
            });
        }
    }

    private function renameStoredResponseKeys(
        string $fromPayloadKey,
        string $toPayloadKey,
        string $fromDimensionKey,
        string $toDimensionKey,
    ): void {
        if (! Schema::hasTable('department_tasks') || ! Schema::hasColumn('department_tasks', 'response_data')) {
            return;
        }

        DB::table('department_tasks')
            ->select(['id', 'response_data'])
            ->whereNotNull('response_data')
            ->orderBy('id')
            ->chunkById(200, function ($tasks) use (
                $fromPayloadKey,
                $toPayloadKey,
                $fromDimensionKey,
                $toDimensionKey,
            ) {
                foreach ($tasks as $task) {
                    $payload = json_decode((string) $task->response_data, true);
                    if (! is_array($payload) || ! is_array($payload['by_indicator'] ?? null)) {
                        continue;
                    }

                    $changed = false;
                    foreach ($payload['by_indicator'] as &$bundle) {
                        if (! is_array($bundle) || ! is_array($bundle['quantitative'] ?? null)) {
                            continue;
                        }

                        $quantitative = &$bundle['quantitative'];
                        if (array_key_exists($fromPayloadKey, $quantitative)) {
                            if (! array_key_exists($toPayloadKey, $quantitative)) {
                                $quantitative[$toPayloadKey] = $quantitative[$fromPayloadKey];
                            }
                            unset($quantitative[$fromPayloadKey]);
                            $changed = true;
                        }

                        if (
                            is_array($quantitative['matrix_row_enabled'] ?? null)
                            && array_key_exists($fromDimensionKey, $quantitative['matrix_row_enabled'])
                        ) {
                            if (! array_key_exists($toDimensionKey, $quantitative['matrix_row_enabled'])) {
                                $quantitative['matrix_row_enabled'][$toDimensionKey] =
                                    $quantitative['matrix_row_enabled'][$fromDimensionKey];
                            }
                            unset($quantitative['matrix_row_enabled'][$fromDimensionKey]);
                            $changed = true;
                        }
                    }
                    unset($bundle);

                    if ($changed) {
                        DB::table('department_tasks')
                            ->where('id', $task->id)
                            ->update([
                                'response_data' => json_encode(
                                    $payload,
                                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                                ),
                            ]);
                    }
                }
            });
    }
};
