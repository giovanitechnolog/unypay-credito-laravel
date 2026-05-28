<?php

namespace App\Jobs;

use App\Imports\CarteiraContratosImport;
use App\Models\Contract;
use App\Models\ContractImport;
use App\Support\ContractImportRegistry;
use App\Support\ImportErrorTranslator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use Throwable;

/**
 * Job em background que executa o import multi-aba completo e, ao final,
 * recalcula campos derivados do contrato (installmentCount, installmentAmount,
 * firstDueDate) usando as parcelas recém-inseridas.
 */
class ImportContractsSpreadsheetJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;   // 30 min — planilhas grandes pode levar tempo
    public int $tries = 1;        // não queremos reimportar tudo se falhar

    public function __construct(public int $importId) {}

    public function handle(): void
    {
        /** @var ContractImport|null $import */
        $import = ContractImport::find($this->importId);
        if (!$import) {
            Log::error("[ImportJob] ContractImport id={$this->importId} não encontrado.");
            return;
        }

        $import->status     = ContractImport::STATUS_PROCESSING;
        $import->startedAt  = now();
        $import->save();

        $registry = app(ContractImportRegistry::class);

        try {
            $absolutePath = Storage::disk('local')->path($import->storedPath);

            if (!is_file($absolutePath)) {
                throw new \RuntimeException("Arquivo não encontrado: {$import->storedPath}");
            }

            Excel::import(new CarteiraContratosImport($import, $registry, dryRun: false), $absolutePath);

            $this->recalculateContractStats($registry->touchedContractIds());

            $import->summaryJson = $registry->summary();
            $import->errorsJson  = array_slice($registry->errors, 0, 500); // limita p/ JSON não explodir
            $import->status      = ContractImport::STATUS_DONE;
            $import->finishedAt  = now();
            $import->save();

            Log::info("[ImportJob] Importação {$import->id} concluída.", $registry->summary());
        } catch (Throwable $e) {
            Log::error("[ImportJob] Falha na importação {$import->id}: " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            $friendly = ImportErrorTranslator::friendly($e);
            $import->status      = ContractImport::STATUS_FAILED;
            $import->finishedAt  = now();
            $import->errorsJson  = array_merge(
                $registry->errors ?? [],
                [[
                    'sheet'    => 'arquivo',
                    'row'      => 0,
                    'message'  => $friendly,
                    'severity' => 'fatal',
                ]]
            );
            $import->summaryJson = $registry->summary();
            $import->save();
        }
    }

    /**
     * Pós-processamento: a planilha não traz installmentCount/firstDueDate/etc.
     * Calculamos diretamente a partir das parcelas recém-inseridas.
     *
     * @param int[] $contractIds
     */
    private function recalculateContractStats(array $contractIds): void
    {
        if ($contractIds === []) return;

        foreach (array_chunk($contractIds, 100) as $chunk) {
            $stats = DB::table('installments')
                ->select('contractId', DB::raw('COUNT(*) as cnt'), DB::raw('MAX(originalAmount) as max_amt'), DB::raw('MIN(dueDate) as min_due'))
                ->whereIn('contractId', $chunk)
                ->groupBy('contractId')
                ->get()
                ->keyBy('contractId');

            foreach ($chunk as $id) {
                $s = $stats->get($id);
                if (!$s) continue;

                Contract::where('id', $id)->update([
                    'installmentCount'  => (int) $s->cnt,
                    'installmentAmount' => (float) ($s->max_amt ?? 0),
                    'firstDueDate'      => $s->min_due,
                ]);
            }
        }
    }
}
