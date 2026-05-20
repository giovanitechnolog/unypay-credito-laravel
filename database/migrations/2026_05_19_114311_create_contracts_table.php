<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clientId')->constrained('clients')->onDelete('cascade');
            $table->string('code', 50)->unique();
            $table->string('contractName', 255);
            $table->string('creditor', 255);
            $table->string('contractType', 100)->default('Mútuo/Confissão de dívida');
            $table->string('contractDate', 10)->nullable();
            $table->enum('status', ['Ativo', 'Quitado', 'Inadimplente', 'Renegociado'])->default('Ativo');
            $table->boolean('validated')->default(false)->nullable();
            
            // Valores financeiros
            $table->decimal('principalAmount', 15, 2)->default(0.00);
            $table->decimal('financedTotal', 15, 2)->default(0.00);
            $table->decimal('tacAmount', 15, 2)->default(0.00);
            $table->decimal('iofAmount', 15, 2)->default(0.00);
            $table->integer('installmentCount')->default(1);
            $table->decimal('installmentAmount', 15, 2)->default(0.00);
            $table->string('firstDueDate', 10)->nullable();
            
            // Taxas
            $table->decimal('monthlyInterestRate', 8, 6)->default(0.000000);
            $table->decimal('moraRateMonthly', 8, 6)->default(0.000000);
            $table->decimal('penaltyRate', 8, 6)->default(0.000000);
            $table->enum('penaltyBaseType', ['installment', 'debt', 'contract'])->default('installment');
            $table->enum('penaltyScope', ['per_installment', 'contract_once'])->default('per_installment');
            $table->string('correctionIndex', 20)->default('IPCA');
            $table->decimal('honoraryRate', 8, 6)->default(0.000000);
            
            // Vencimento antecipado
            $table->boolean('accelerates')->default(false)->nullable();
            $table->text('accelerationRule')->nullable();
            $table->integer('accelerationConsecutiveThreshold')->nullable();
            $table->integer('accelerationAlternateThreshold')->nullable();
            
            // Garantias
            $table->text('guarantees')->nullable();
            $table->text('guarantors')->nullable();
            $table->string('validationUrl', 512)->nullable();
            $table->string('sourcePdfName', 255)->nullable();
            $table->text('observations')->nullable();
            
            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contracts');
    }
};