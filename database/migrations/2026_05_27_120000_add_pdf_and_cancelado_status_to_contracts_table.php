<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adiciona a coluna `contractPdfPath` (caminho relativo do PDF no disk "public")
 * e amplia o enum de `status` para incluir 'Cancelado', permitindo o
 * cancelamento de contratos sem perda de histórico.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            if (! Schema::hasColumn('contracts', 'contractPdfPath')) {
                $table->string('contractPdfPath', 2048)
                    ->nullable()
                    ->after('sourcePdfName');
            }
        });

        DB::statement("ALTER TABLE contracts MODIFY status ENUM('Ativo','Quitado','Inadimplente','Renegociado','Cancelado') NOT NULL DEFAULT 'Ativo'");
    }

    public function down(): void
    {
        DB::statement("UPDATE contracts SET status = 'Ativo' WHERE status = 'Cancelado'");
        DB::statement("ALTER TABLE contracts MODIFY status ENUM('Ativo','Quitado','Inadimplente','Renegociado') NOT NULL DEFAULT 'Ativo'");

        Schema::table('contracts', function (Blueprint $table) {
            if (Schema::hasColumn('contracts', 'contractPdfPath')) {
                $table->dropColumn('contractPdfPath');
            }
        });
    }
};
