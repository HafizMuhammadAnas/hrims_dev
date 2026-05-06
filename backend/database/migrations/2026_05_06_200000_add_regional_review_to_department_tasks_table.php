<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            $table->string('regional_review_status', 32)->nullable()->after('status');
            $table->text('regional_review_comments')->nullable()->after('regional_review_status');
        });
    }

    public function down(): void
    {
        Schema::table('department_tasks', function (Blueprint $table) {
            $table->dropColumn(['regional_review_status', 'regional_review_comments']);
        });
    }
};
