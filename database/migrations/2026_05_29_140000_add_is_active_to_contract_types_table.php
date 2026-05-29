<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adiciona a flag is_active na tabela de tipos de contrato para
     * permitir desativar registros sem precisar excluí-los, preservando
     * o histórico de contratos antigos que apontam para o tipo.
     */
    public function up(): void
    {
        Schema::table('contract_types', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('slug');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contract_types', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
