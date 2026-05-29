<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            // Confissão de Dívida (Guia Garantias e Fiadores)
            $table->boolean('confessionOfDebt')->default(false)->nullable()->after('guarantors');

            // Foro (Guia Regras Contratuais)
            $table->string('forum', 255)->nullable()->after('accelerationAlternateThreshold');
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->dropColumn(['confessionOfDebt', 'forum']);
        });
    }
};
