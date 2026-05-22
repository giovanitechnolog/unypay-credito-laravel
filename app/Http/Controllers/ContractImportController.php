<?php

namespace App\Http\Controllers;

use App\Imports\CarteiraContratosImport;
use App\Jobs\ImportContractsSpreadsheetJob;
use App\Models\ContractImport;
use App\Support\ContractImportRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Throwable;

class ContractImportController extends Controller
{
    /**
     * GET /sys/importar/importar-contratos
     * Renderiza a página interna do importador. Ela NÃO está linkada no menu.
     */
    public function page(): Response
    {
        $recent = ContractImport::orderByDesc('id')->limit(10)->get([
            'id', 'originalFilename', 'status',
            'totalContracts', 'totalInstallments',
            'processedRows', 'successRows', 'errorRows',
            'createdAt', 'finishedAt',
        ]);

        return Inertia::render('ContractImporter', [
            'recent' => $recent,
        ]);
    }

    /**
     * POST /sys/importar/contratos/validar
     * Dry-run: faz a leitura completa da planilha sem persistir nada e
     * devolve no Inertia o que SERIA importado (contagens + erros previstos).
     */
    public function validateSpreadsheet(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:51200', // 50 MB
        ]);

        $file = $request->file('file');
        $tmpPath = $file->getRealPath();

        // ContractImport "fantasma" — não é salvo no banco, só serve para
        // satisfazer o construtor das sheets que pedem essa dependência.
        $ghost = new ContractImport([
            'originalFilename' => $file->getClientOriginalName(),
            'storedPath'       => '',
            'status'           => ContractImport::STATUS_QUEUED,
        ]);

        $registry = app(ContractImportRegistry::class);

        try {
            Excel::import(new CarteiraContratosImport($ghost, $registry, dryRun: true), $tmpPath);

            return response()->json([
                'ok'      => true,
                'summary' => $registry->summary(),
                'errors'  => array_slice($registry->errors, 0, 200),
                'message' => 'Validação concluída. Nada foi gravado no banco.',
            ]);
        } catch (Throwable $e) {
            Log::warning('[ImportValidate] ' . $e->getMessage());
            return response()->json([
                'ok'      => false,
                'summary' => $registry->summary(),
                'errors'  => $registry->errors,
                'message' => 'Erro ao validar: ' . $e->getMessage(),
            ], 422);
        }
    }

    /**
     * POST /sys/importar/contratos
     * Upload + enfileiramento do job. Retorna o id da importação para o
     * frontend conseguir fazer polling de progresso.
     */
    public function store(Request $request): JsonResponse|RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv|max:51200',
        ]);

        $file = $request->file('file');
        $storedPath = $file->store('contract-imports', 'local');

        $import = ContractImport::create([
            'userId'           => $request->user()?->id,
            'originalFilename' => $file->getClientOriginalName(),
            'storedPath'       => $storedPath,
            'status'           => ContractImport::STATUS_QUEUED,
        ]);

        ImportContractsSpreadsheetJob::dispatch($import->id);

        return response()->json([
            'ok'       => true,
            'importId' => $import->id,
            'message'  => 'Importação enfileirada. Aguarde o processamento em background.',
        ]);
    }

    /**
     * GET /sys/importar/contratos/status/{import}
     * Endpoint JSON consumido pelo polling do frontend a cada 2s.
     */
    public function status(ContractImport $import): JsonResponse
    {
        return response()->json([
            'id'               => $import->id,
            'status'           => $import->status,
            'originalFilename' => $import->originalFilename,
            'processedRows'    => $import->processedRows,
            'successRows'      => $import->successRows,
            'errorRows'        => $import->errorRows,
            'totalContracts'   => $import->totalContracts,
            'totalInstallments'=> $import->totalInstallments,
            'summary'          => $import->summaryJson,
            'errors'           => is_array($import->errorsJson)
                ? array_slice($import->errorsJson, 0, 100)
                : [],
            'startedAt'        => $import->startedAt,
            'finishedAt'       => $import->finishedAt,
            'finished'         => $import->isFinished(),
        ]);
    }
}
