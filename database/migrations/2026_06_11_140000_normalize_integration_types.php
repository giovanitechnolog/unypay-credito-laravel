<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 🚀 Normaliza valores antigos de `integrations.type`.
 *
 * Na primeira versão da tela, o campo "TIPO DE INTEGRAÇÃO" havia sido
 * removido e os novos cadastros recebiam `type='custom'`. Agora, com a
 * volta do conceito como "FINALIDADE" (cpf_lookup/cnpj_lookup/other),
 * trocamos qualquer registro com `'custom'` para `'other'` para que ele
 * passe na validação Rule::in(...) sem precisar ser editado manualmente.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('integrations')) {
            return;
        }

        DB::table('integrations')
            ->where('type', 'custom')
            ->update(['type' => 'other']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('integrations')) {
            return;
        }

        DB::table('integrations')
            ->where('type', 'other')
            ->update(['type' => 'custom']);
    }
};
