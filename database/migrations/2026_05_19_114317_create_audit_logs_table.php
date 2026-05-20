<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('entityType', 50);
            $table->integer('entityId')->nullable();
            $table->string('action', 100);
            $table->text('description')->nullable();
            $table->string('performedBy', 255)->nullable();
            $table->text('payloadJson')->nullable();
            $table->timestamp('createdAt')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};