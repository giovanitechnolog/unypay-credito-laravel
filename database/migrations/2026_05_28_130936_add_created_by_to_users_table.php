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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'created_by')) {
                $table->foreignId('created_by')
                      ->nullable()
                      ->after('id')
                      ->comment('ID do administrador que criou este usuário')
                      ->constrained('users') // Auto-relacionamento na própria tabela de usuários
                      ->onDelete('restrict');
            }
        });

        // O primeiro usuário (Admin mestre do seeder) não foi criado por ninguém via tela, 
        // mas para os outros que já existirem, colocamos o ID 1 como padrinho retroativo
        DB::table('users')->where('id', '>', 1)->whereNull('created_by')->update(['created_by' => 1]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });
    }
};