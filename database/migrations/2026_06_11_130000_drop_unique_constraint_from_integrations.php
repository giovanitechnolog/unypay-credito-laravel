<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * 🚀 Remove o índice único `(type, environment)` da tabela `integrations`.
 *
 * Motivação:
 *   • A versão inicial assumia que o operador escolheria o "tipo de
 *     integração" (Rodopar SIGx, ReceitaWS, ViaCEP, etc.) e por isso
 *     fazia sentido restringir uma integração ativa por (tipo, ambiente).
 *   • A UI evoluiu para um formulário genérico — o tipo deixou de ser um
 *     dado escolhido pelo usuário (todos novos cadastros caem no default
 *     `custom`), o que faria o índice bloquear múltiplas integrações
 *     custom no mesmo ambiente.
 *
 * Logo, dropamos o índice e mantemos a coluna `type` apenas como metadado
 * livre para filtros futuros.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('integrations')) {
            return;
        }

        // Verifica explicitamente se o índice ainda existe antes de tentar
        // dropá-lo. Em ambientes onde a primeira migration foi alterada
        // antes do deploy (e o índice nunca chegou a ser criado), evitamos
        // o erro "Cannot drop index ... needed in a foreign key constraint".
        $indexExists = collect(DB::select(
            "SHOW INDEX FROM integrations WHERE Key_name = ?",
            ['integrations_type_env_unique']
        ))->isNotEmpty();

        if ($indexExists) {
            Schema::table('integrations', function (Blueprint $table) {
                $table->dropUnique('integrations_type_env_unique');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('integrations')) {
            return;
        }

        Schema::table('integrations', function (Blueprint $table) {
            $table->unique(['type', 'environment'], 'integrations_type_env_unique');
        });
    }
};
