<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Executa a criação da tabela de simulações com o Schema mestre.
     */
    public function up(): void
    {
        Schema::create('loan_simulations', function (Blueprint $table) {
            $table->id();
            $table->string('client_name', 255)->nullable();
            $table->string('client_document', 45)->nullable();
            $table->string('person_type', 2)->default('PF');
            $table->string('calc_mode', 20); // price, simple, manual
            $table->decimal('principal', 15, 2);
            $table->decimal('monthly_rate', 10, 6)->default(0);
            $table->integer('installment_count');
            $table->decimal('installment_amount', 15, 2);
            $table->date('first_due_date')->nullable();
            $table->decimal('tac_value', 15, 2)->default(0);
            $table->decimal('iof_value', 15, 2)->default(0);
            $table->decimal('financed_total', 15, 2);
            $table->decimal('total_payable', 15, 2);
            $table->decimal('total_interest', 15, 2);
            $table->decimal('cet_monthly', 12, 8)->default(0);
            $table->decimal('cet_annual', 12, 8)->default(0);
            $table->timestamps(); // Cria created_at e updated_at automaticamente
        });
    }

    /**
     * Remove a tabela se necessário.
     */
    public function down(): void
    {
        Schema::dropIfExists('loan_simulations');
    }
};