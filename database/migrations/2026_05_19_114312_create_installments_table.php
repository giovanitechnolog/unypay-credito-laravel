<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contractId')->constrained('contracts')->onDelete('cascade');
            $table->integer('installmentNumber');
            $table->string('dueDate', 10);
            $table->decimal('originalAmount', 15, 2);
            $table->enum('status', ['A vencer', 'Vencido', 'Pago', 'Pago parcial'])->default('A vencer');
            $table->text('notes')->nullable();
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installments');
    }
};