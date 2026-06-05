<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consignor_bank_accounts', function (Blueprint $table) {
            $table->id();

            // FK 1:N — ao remover o credor, suas contas bancárias são apagadas em cascata.
            $table->foreignId('consignorId')
                ->constrained('consignors')
                ->cascadeOnDelete();

            $table->string('bankName',      255);
            $table->string('agency',         20)->nullable();
            $table->string('accountNumber',  30)->nullable();

            // Tipo de conta — restrito a Corrente / Poupança conforme briefing.
            $table->enum('accountType', ['corrente', 'poupanca'])->default('corrente');

            // Chave PIX — totalmente opcional (uma conta pode existir sem PIX).
            $table->string('pixKey', 140)->nullable();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();

            $table->index('consignorId');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consignor_bank_accounts');
    }
};
