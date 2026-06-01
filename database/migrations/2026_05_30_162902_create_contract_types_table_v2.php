<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('contract_types')) {
            Schema::create('contract_types', function (Blueprint $table) {
                $table->id();
                $table->string('name', 255)->unique();
                $table->text('description')->nullable();
                $table->timestamp('createdAt')->useCurrent();
                $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_types');
    }
};