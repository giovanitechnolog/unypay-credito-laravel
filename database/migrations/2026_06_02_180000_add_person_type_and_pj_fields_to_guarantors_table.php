<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Estende a tabela de fiadores para suportar Pessoa Física e Pessoa Jurídica.
     *
     * Campos adicionados:
     *   personType        — discrimina PF/PJ (default PF para registros existentes)
     *   cnpj              — CNPJ (apenas dígitos), unique nullable
     *   tradeName         — Nome Fantasia (apenas para PJ)
     *   stateRegistration — Inscrição Estadual (apenas para PJ; aceita "ISENTO")
     */
    public function up(): void
    {
        Schema::table('guarantors', function (Blueprint $table) {
            if (! Schema::hasColumn('guarantors', 'personType')) {
                $table->enum('personType', ['PF', 'PJ'])
                      ->default('PF')
                      ->after('name');
            }

            if (! Schema::hasColumn('guarantors', 'cnpj')) {
                $table->string('cnpj', 14)
                      ->nullable()
                      ->unique()
                      ->after('rg');
            }

            if (! Schema::hasColumn('guarantors', 'tradeName')) {
                $table->string('tradeName', 255)
                      ->nullable()
                      ->after('cnpj');
            }

            if (! Schema::hasColumn('guarantors', 'stateRegistration')) {
                $table->string('stateRegistration', 30)
                      ->nullable()
                      ->after('tradeName');
            }
        });
    }

    public function down(): void
    {
        Schema::table('guarantors', function (Blueprint $table) {
            if (Schema::hasColumn('guarantors', 'stateRegistration')) {
                $table->dropColumn('stateRegistration');
            }
            if (Schema::hasColumn('guarantors', 'tradeName')) {
                $table->dropColumn('tradeName');
            }
            if (Schema::hasColumn('guarantors', 'cnpj')) {
                // Drop o índice único antes da coluna
                $table->dropUnique(['cnpj']);
                $table->dropColumn('cnpj');
            }
            if (Schema::hasColumn('guarantors', 'personType')) {
                $table->dropColumn('personType');
            }
        });
    }
};
