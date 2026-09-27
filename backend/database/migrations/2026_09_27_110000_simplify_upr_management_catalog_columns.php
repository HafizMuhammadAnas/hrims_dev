<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('upr_types', function (Blueprint $table) {
            $table->dropColumn(['code', 'description']);
        });

        Schema::table('upr_cycles', function (Blueprint $table) {
            $table->dropUnique(['name']);
            $table->dropColumn(['code', 'session_label', 'description']);
            $table->foreignId('upr_type_id')->nullable()->after('id')->constrained('upr_types')->nullOnDelete();
            $table->unique(['upr_type_id', 'name']);
        });

        Schema::table('upr_categories', function (Blueprint $table) {
            $table->dropColumn(['code', 'description']);
        });
    }

    public function down(): void
    {
        Schema::table('upr_categories', function (Blueprint $table) {
            $table->string('code', 64)->nullable()->after('name');
            $table->string('description', 500)->nullable()->after('code');
        });

        Schema::table('upr_cycles', function (Blueprint $table) {
            $table->dropUnique(['upr_type_id', 'name']);
            $table->dropConstrainedForeignId('upr_type_id');
            $table->string('code', 64)->nullable()->after('name');
            $table->string('session_label', 128)->nullable()->after('code');
            $table->string('description', 500)->nullable()->after('session_label');
            $table->unique('name');
        });

        Schema::table('upr_types', function (Blueprint $table) {
            $table->string('code', 64)->nullable()->after('name');
            $table->string('description', 500)->nullable()->after('code');
        });
    }
};
