<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            if (! Schema::hasColumn('department_tasks', 'verification_file_url')) {
                $table->string('verification_file_url', 2048)->nullable()->after('attachment_url');
            }
            if (! Schema::hasColumn('department_tasks', 'physical_validation_done')) {
                $table->boolean('physical_validation_done')->default(false)->after('verification_file_url');
            }
        });
    }

    public function down(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('department_tasks', 'physical_validation_done')) {
                $table->dropColumn('physical_validation_done');
            }
            if (Schema::hasColumn('department_tasks', 'verification_file_url')) {
                $table->dropColumn('verification_file_url');
            }
        });
    }
};
