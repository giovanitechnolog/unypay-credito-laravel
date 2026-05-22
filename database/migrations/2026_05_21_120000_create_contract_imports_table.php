<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contract_imports', function (Blueprint $table) {
            $table->id();

            // Quando o m\u00f3dulo de autentica\u00e7\u00e3o estiver ativo, aproveitamos esse v\u00ednculo
            $table->unsignedBigInteger('userId')->nullable()->index();

            $table->string('originalFilename', 255);
            $table->string('storedPath', 512);

            $table->enum('status', [
                'queued',
                'processing',
                'done',
                'failed',
                'cancelled',
            ])->default('queued')->index();

            // Totais estimados (lidos rapidamente antes de processar) e contadores reais
            $table->unsignedInteger('totalContracts')->default(0);
            $table->unsignedInteger('totalInstallments')->default(0);
            $table->unsignedInteger('processedRows')->default(0);
            $table->unsignedInteger('successRows')->default(0);
            $table->unsignedInteger('errorRows')->default(0);

            // JSON com a coletânea de erros (sheet, linha, mensagem) e resumo final
            $table->longText('errorsJson')->nullable();
            $table->longText('summaryJson')->nullable();

            $table->timestamp('startedAt')->nullable();
            $table->timestamp('finishedAt')->nullable();

            $table->timestamp('createdAt')->useCurrent();
            $table->timestamp('updatedAt')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contract_imports');
    }
};
