<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adiciona a coluna `photo` à tabela users para armazenar o caminho relativo
 * (no disk "public") da foto do usuário administrativo.
 *
 * A coluna é nullable no banco para preservar registros legados; a
 * obrigatoriedade na criação é garantida via StoreUserRequest.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'photo')) {
                $table->string('photo', 2048)->nullable()->after('email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'photo')) {
                $table->dropColumn('photo');
            }
        });
    }
};
