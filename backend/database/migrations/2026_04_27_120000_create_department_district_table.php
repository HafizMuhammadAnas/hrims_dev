<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('department_district', function (Blueprint $table) {
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->primary(['department_id', 'district_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('department_district');
    }
};
