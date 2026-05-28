<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // 1. Cria a coluna na tabela de baixas associando ao utilizador logado
            if (!Schema::hasColumn('payments', 'user_id')) {
                $table->foreignId('user_id')
                      ->nullable()
                      ->after('id')
                      ->comment('Operador que efetuou a baixa do pagamento')
                      ->constrained('users')
                      ->onDelete('restrict');
            }
        });

        // 2. Preenche retroativamente os pagamentos históricos da planilha com o ID 1
        DB::table('payments')->whereNull('user_id')->update(['user_id' => 1]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};