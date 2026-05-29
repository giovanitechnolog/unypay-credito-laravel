<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adiciona campos de identificação pessoal ao usuário administrativo:
 * - document (CPF ou CNPJ — string para preservar a máscara)
 * - birthDate (data de nascimento)
 * - phone (telefone/celular com DDD)
 *
 * Todos os campos são nullable no banco para preservar registros legados.
 * A obrigatoriedade na criação fica a cargo dos FormRequests, permitindo
 * regras diferentes entre criar e editar conforme o produto evoluir.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'document')) {
                $table->string('document', 20)->nullable()->after('email');
            }
            if (! Schema::hasColumn('users', 'birthDate')) {
                $table->date('birthDate')->nullable()->after('document');
            }
            if (! Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 25)->nullable()->after('birthDate');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'phone')) {
                $table->dropColumn('phone');
            }
            if (Schema::hasColumn('users', 'birthDate')) {
                $table->dropColumn('birthDate');
            }
            if (Schema::hasColumn('users', 'document')) {
                $table->dropColumn('document');
            }
        });
    }
};
