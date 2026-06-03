<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 🚀 Adiciona o papel (FIADOR | CODEVEDOR) na pivot contract_guarantor.
 *
 * O cadastro mestre da pessoa permanece em `guarantors` (unificado),
 * mas o papel exercido em CADA contrato é diferenciado aqui na pivot.
 * Assim, a mesma pessoa pode figurar como Fiador no contrato A e como
 * Codevedor no contrato B sem duplicação de cadastro.
 *
 * ⚠️ ORDEM CRÍTICA — restrição do InnoDB:
 *   O índice `unique(contractId, guarantorId)` antigo está sendo usado pelo
 *   MySQL como índice de suporte da FK em `contractId`. Não dá para dropá-lo
 *   antes que exista OUTRO índice começando com `contractId`. Por isso a
 *   sequência abaixo é:
 *     1. cria coluna `role`;
 *     2. cria o NOVO unique composto (contractId, guarantorId, role) — esse
 *        índice também começa com `contractId`, então o MySQL passa a usá-lo
 *        como suporte da FK;
 *     3. só agora dropa o unique antigo, que o InnoDB libera.
 *
 *   Cada passo num Schema::table separado para garantir DDL atômica (ALTER
 *   TABLE individual) — evita o erro 1553.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contract_guarantor', function (Blueprint $table) {
            $table->enum('role', ['FIADOR', 'CODEVEDOR'])
                  ->default('FIADOR')
                  ->after('guarantorId');
        });

        Schema::table('contract_guarantor', function (Blueprint $table) {
            $table->unique(['contractId', 'guarantorId', 'role']);
        });

        Schema::table('contract_guarantor', function (Blueprint $table) {
            $table->dropUnique(['contractId', 'guarantorId']);
        });
    }

    public function down(): void
    {
        // Mesma lógica invertida: recria o unique antigo PRIMEIRO (passa a ser
        // suporte da FK em contractId), depois pode dropar o composto + coluna.
        Schema::table('contract_guarantor', function (Blueprint $table) {
            $table->unique(['contractId', 'guarantorId']);
        });

        Schema::table('contract_guarantor', function (Blueprint $table) {
            $table->dropUnique(['contractId', 'guarantorId', 'role']);
        });

        Schema::table('contract_guarantor', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
