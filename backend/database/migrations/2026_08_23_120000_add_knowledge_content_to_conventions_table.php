<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conventions', function (Blueprint $table) {
            $table->json('repositories')->nullable()->after('description');
            $table->longText('optional_protocol_body')->nullable()->after('repositories');
        });
    }

    public function down(): void
    {
        Schema::table('conventions', function (Blueprint $table) {
            $table->dropColumn(['repositories', 'optional_protocol_body']);
        });
    }
};
