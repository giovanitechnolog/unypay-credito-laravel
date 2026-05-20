<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('installmentId')->constrained('installments')->onDelete('cascade');
            $table->decimal('amount', 15, 2);
            $table->string('paidAt', 10);
            $table->enum('method', ['PIX', 'TED', 'Boleto', 'Cheque', 'Dinheiro', 'Cartão'])->default('PIX')->nullable();
            $table->text('notes')->nullable();
            $table->string('recordedBy', 255)->nullable();
            $table->timestamp('createdAt')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};