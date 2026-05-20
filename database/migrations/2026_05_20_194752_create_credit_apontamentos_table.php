<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Executa a criação da tabela de restrições do Serasa (Padrão Manus)
     */
    public function up(): void
    {
        Schema::create('credit_apontamentos', function (Blueprint $table) {
            $table->id();
            
            // Relacionamento com a tabela física de clientes
            $table->foreignId('client_id')->constrained('clients')->onDelete('cascade');
            
            // Dados da Ocorrência e Bureau
            $table->string('tipo', 50); // negativacao, protesto, cheque_sem_fundo, etc.
            $table->text('descricao');
            $table->decimal('valor', 15, 2)->nullable();
            $table->string('credor', 255)->nullable();
            $table->date('data_ocorrencia');
            $table->string('status', 30)->default('ativo'); // ativo, em_analise, regularizado
            $table->string('fonte', 50)->default('serasa'); // serasa, spc, bacen, manual
            
            $table->timestamps(); // Cria created_at e updated_at automaticamente
        });
    }

    /**
     * Reverso da migration.
     */
    public function down(): void
    {
        Schema::dropIfExists('credit_apontamentos');
    }
};