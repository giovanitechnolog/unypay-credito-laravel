<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('loan_simulations', function (Blueprint $table) {
            // Cria a coluna user_id como nullable para não dar erro se já existirem simulações antigas
            $table->foreignId('user_id')
                  ->nullable()
                  ->after('id') // Coloca logo no começo da tabela, após o ID principal
                  ->constrained('users')
                  ->onDelete('set null'); // Se o usuário for deletado, a simulação permanece como histórico
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loan_simulations', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};