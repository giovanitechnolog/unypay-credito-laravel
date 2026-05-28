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
        
       
        Schema::table('contracts', function (Blueprint $table) {
            // 1. Cria a coluna aceitando nulo para não quebrar dados antigos
            if (!Schema::hasColumn('contracts', 'user_id')) {
                $table->foreignId('user_id')
                      ->nullable()
                      ->after('contract_type_id')
                      ->comment('Utilizador que cadastrou o contrato')
                      ->constrained('users')
                      ->onDelete('restrict'); // Restringe para não apagar o contrato se o user sumir
            }
        });

        // 2. Preenche retroativamente os contratos existentes com o ID 1 (Admin)
        DB::table('contracts')->whereNull('user_id')->update(['user_id' => 1]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};