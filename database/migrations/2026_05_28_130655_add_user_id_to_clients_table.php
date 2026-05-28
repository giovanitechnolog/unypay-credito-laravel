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
        // Se a coluna NÃO existir, ele cria. Se já existir, pula pacificamente sem dar erro!
            if (!Schema::hasColumn('clients', 'user_id')) {
                Schema::table('clients', function (Blueprint $table) {
                    $table->foreignId('user_id')
                        ->nullable()
                        ->after('id')
                        ->comment('Operador que cadastrou/atualizou o cliente')
                        ->constrained('users')
                        ->onDelete('restrict');
                });
            }

            DB::table('clients')->whereNull('user_id')->update(['user_id' => 1]);
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
    }
};