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
        Schema::create('user_column_preferences', function (Blueprint $table) {
            $table->id();
            
            // Chave estrangeira amarrando o operador logado
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            
            // Guarda o identificador da tela (ex: 'unypay_credito_colunas_lancamentos_v1')
            $table->string('table_key');
            
            // Array de IDs das colunas salvas em formato JSON
            $table->json('visible_columns');
            
            $table->timestamps();

            // Índice único composto para impedir que o mesmo usuário tenha duas linhas da mesma tela
            $table->unique(['user_id', 'table_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_column_preferences');
    }
};
