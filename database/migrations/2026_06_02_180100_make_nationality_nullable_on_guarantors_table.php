<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Para Pessoa Jurídica, nationality não se aplica.
     * Tornamos a coluna nullable e removemos o default 'Brasileiro' a nível de DB
     * (o default agora é controlado apenas no formulário PF).
     */
    public function up(): void
    {
        Schema::table('guarantors', function (Blueprint $table) {
            $table->string('nationality', 80)->nullable()->default(null)->change();
        });
    }

    public function down(): void
    {
        // Volta ao estado original: NOT NULL com default 'Brasileiro'
        // Antes precisamos garantir que não há linhas com NULL.
        \DB::table('guarantors')
            ->whereNull('nationality')
            ->update(['nationality' => 'Brasileiro']);

        Schema::table('guarantors', function (Blueprint $table) {
            $table->string('nationality', 80)->default('Brasileiro')->change();
        });
    }
};
