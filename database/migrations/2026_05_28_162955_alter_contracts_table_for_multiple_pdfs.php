<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. 🚀 HIGIENIZAÇÃO EM MASSA ULTRA BLINDADA
        $contracts = DB::table('contracts')->get(['id', 'contractPdfPath', 'sourcePdfName']);

        foreach ($contracts as $contract) {
            $newPath = trim($contract->contractPdfPath ?? '');
            $newName = trim($contract->sourcePdfName ?? '');

            // Trata a coluna do Caminho do PDF
            if ($newPath === '' || $newPath === '""') {
                // Se estiver vazio ou string de aspas vazias, vira um array JSON vazio limpo
                $newPath = '[]';
            } elseif (!str_starts_with($newPath, '[')) {
                // Se for um caminho de texto antigo (ex: contracts/pdfs/abc.pdf), encapsula no array
                $newPath = json_encode([$newPath]);
            }

            // Trata a coluna do Nome Original do PDF
            if ($newName === '' || $newName === '""') {
                $newName = '[]';
            } elseif (!str_starts_with($newName, '[')) {
                $newName = json_encode([$newName]);
            }

            // Atualiza a linha com strings que o MySQL GARANTE serem JSON válidos
            DB::table('contracts')->where('id', $contract->id)->update([
                'contractPdfPath' => $newPath,
                'sourcePdfName'   => $newName
            ]);
        }

        // 2. Agora que nenhuma linha possui "Invalid value", modificamos a tabela sem chateações
        Schema::table('contracts', function (Blueprint $table) {
            $table->json('contractPdfPath')->nullable()->change();
            $table->json('sourcePdfName')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('contracts', function (Blueprint $table) {
            $table->string('contractPdfPath', 255)->nullable()->change();
            $table->string('sourcePdfName', 255)->nullable()->change();
        });
    }
};