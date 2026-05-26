<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
   public function up()
    {
        Schema::table('contracts', function (Blueprint $table) {
            // Mudamos o 'after' de client_id para clientId para bater exatamente com o seu banco atual
            $table->foreignId('contract_type_id')
                ->nullable()
                ->after('clientId') // 👈 Correção aqui!
                ->constrained('contract_types')
                ->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropForeign(['contract_type_id']);
            $table->dropColumn('contract_type_id');
        });
    }
};
