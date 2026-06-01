<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            // 🚀 Injeta as colunas caso elas não existam no MySQL
            if (!Schema::hasColumn('contracts', 'chosenBankAccount')) {
                $table->string('chosenBankAccount', 255)->nullable()->after('accelerationAlternateThreshold');
            }
            if (!Schema::hasColumn('contracts', 'paymentMethod')) {
                $table->string('paymentMethod', 100)->nullable()->default('Boleto Bancário')->after('chosenBankAccount');
            }
            if (!Schema::hasColumn('contracts', 'forumLocation')) {
                $table->string('forumLocation', 255)->nullable()->default('Belo Horizonte / MG')->after('paymentMethod');
            }
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            // Caminho de volta (rollback) caso precise desfazer
            $table->dropColumn(['chosenBankAccount', 'paymentMethod', 'forumLocation']);
        });
    }
};