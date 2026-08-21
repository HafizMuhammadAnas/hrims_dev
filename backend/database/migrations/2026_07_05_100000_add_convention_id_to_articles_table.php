<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->foreignId('convention_id')->nullable()->after('id')->constrained('conventions')->cascadeOnDelete();
        });

        $catConventionId = DB::table('conventions')->where('code', 'CAT')->value('id');
        if ($catConventionId === null) {
            $now = now();
            $catConventionId = DB::table('conventions')->insertGetId([
                'code' => 'CAT',
                'name' => 'Convention against Torture and Other Cruel, Inhuman or Degrading Treatment or Punishment',
                'description' => null,
                'sort_order' => 4,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('articles')->update(['convention_id' => $catConventionId]);

        Schema::table('articles', function (Blueprint $table) {
            $table->unique(['convention_id', 'article_name'], 'articles_convention_name_unique');
        });
    }

    public function down(): void
    {
        Schema::table('articles', function (Blueprint $table) {
            $table->dropUnique('articles_convention_name_unique');
            $table->dropConstrainedForeignId('convention_id');
        });
    }
};
