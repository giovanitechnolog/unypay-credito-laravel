<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Testemunhas vinculadas a um contrato (1:N).
     *
     * Cada linha guarda apenas nome e CPF — dados simples atrelados ao documento,
     * sem cadastro mestre compartilhado (diferente de fiadores/codevedores).
     */
    public function up(): void
    {
        Schema::create('contract_witnesses', function (Blueprint $table) {
            $table->id();

            $table->foreignId('contractId')
                  ->constrained('contracts')
                  ->cascadeOnDelete();

            $table->string('name', 255);
            // 14 chars: armazena os 11 dígitos (mesmo padrão da tabela guarantors).
            $table->string('cpf', 14);

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            $table->index('contractId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_witnesses');
    }
};
