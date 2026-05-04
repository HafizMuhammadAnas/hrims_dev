<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rbac_roles', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('rbac_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->timestamps();
        });

        Schema::create('rbac_role_permission', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')->constrained('rbac_roles')->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained('rbac_permissions')->cascadeOnDelete();
            $table->unique(['role_id', 'permission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rbac_role_permission');
        Schema::dropIfExists('rbac_permissions');
        Schema::dropIfExists('rbac_roles');
    }
};
