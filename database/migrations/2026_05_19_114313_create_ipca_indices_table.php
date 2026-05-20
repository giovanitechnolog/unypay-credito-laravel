<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ipca_indices', function (Blueprint $table) {
            $table->id();
            $table->string('monthRef', 7)->unique();
            $table->string('monthEnd', 10)->nullable();
            $table->decimal('monthlyRate', 10, 8)->default(0.00000000);
            $table->string('sourceName', 255)->nullable();
            $table->string('sourceUrl', 512)->nullable();
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ipca_indices');
    }
};