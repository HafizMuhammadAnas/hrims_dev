<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('issues', function (Blueprint $table) {
            $table->string('entry_kind', 32)->default('issue')->after('category_id');
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->text('description')->nullable()->after('article_name');
        });
    }

    public function down(): void
    {
        Schema::table('issues', function (Blueprint $table) {
            $table->dropColumn('entry_kind');
        });

        Schema::table('articles', function (Blueprint $table) {
            $table->dropColumn('description');
        });
    }
};
