<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Garantia idempotente das colunas `status` e `gender` na tabela `users`.
 *
 * A migration anterior (2026_05_30_161018_add_cadastro_fields_to_users_table)
 * pretendia criar essas colunas, mas em alguns ambientes ela ficou marcada
 * como executada sem aplicar todas as colunas — provavelmente porque a
 * migration foi editada após a sua primeira execução. Como resultado o CRUD
 * de Usuários quebra ao tentar selecionar `status` e `gender` no UserController.
 *
 * Esta migration usa Schema::hasColumn para criar somente o que falta, sem
 * afetar bancos onde as colunas já existem.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'status')) {
                $table->enum('status', ['Ativo', 'Inativo'])
                    ->default('Ativo')
                    ->after('role');
            }

            if (! Schema::hasColumn('users', 'gender')) {
                $table->string('gender', 20)
                    ->nullable()
                    ->after('birthDate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'status')) {
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('users', 'gender')) {
                $table->dropColumn('gender');
            }
        });
    }
};
