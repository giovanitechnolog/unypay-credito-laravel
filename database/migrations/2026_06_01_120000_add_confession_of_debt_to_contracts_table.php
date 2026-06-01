<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            // 🚀 Confissão de Dívida (Guia "Garantias e Fiadores" do CRUD de Contratos).
            // Convive com os campos já criados pela develop (chosenBankAccount, paymentMethod,
            // forumLocation) — adiciona apenas a flag jurídica de confissão.
            if (!Schema::hasColumn('contracts', 'confessionOfDebt')) {
                $table->boolean('confessionOfDebt')->default(false)->nullable()->after('guarantors');
            }
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            if (Schema::hasColumn('contracts', 'confessionOfDebt')) {
                $table->dropColumn('confessionOfDebt');
            }
        });
    }
};
