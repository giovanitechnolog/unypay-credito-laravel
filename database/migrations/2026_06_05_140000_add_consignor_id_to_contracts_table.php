<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Vincula o Credor (Consignor) ao Contrato — relação 1:N (um credor pode
     * estar em vários contratos; cada contrato tem no máximo um credor).
     *
     * Decisões:
     *   • nullable     → contratos antigos continuam válidos sem credor.
     *   • nullOnDelete → se um credor for excluído, o contrato persiste
     *                    com consignorId = NULL (auditoria preservada).
     *                    Diferente do clientId, que usa cascade.
     *   • after        → coluna posicionada logo após clientId para refletir
     *                    o agrupamento lógico das duas FKs principais.
     */
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->foreignId('consignorId')
                ->nullable()
                ->after('clientId')
                ->constrained('consignors')
                ->nullOnDelete();

            $table->index('consignorId');
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            // Ordem importante: dropar a FK antes do índice e da coluna.
            $table->dropForeign(['consignorId']);
            $table->dropIndex(['consignorId']);
            $table->dropColumn('consignorId');
        });
    }
};
