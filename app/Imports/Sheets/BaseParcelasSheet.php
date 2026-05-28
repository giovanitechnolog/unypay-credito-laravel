<?php

namespace App\Imports\Sheets;

use App\Models\ContractImport;
use App\Models\Installment;
use App\Models\Payment;
use App\Models\Contract;
use App\Support\ContractImportRegistry;
use App\Support\SpreadsheetSanitizer as S;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Row;
use Throwable;

/**
 * Processa a aba "Base_Parcelas": cabeçalho na linha 3, dados a partir da 4.
 *
 * Para cada linha:
 *  1. Resolve o contractId via Registry (cache) ou DB pelo código "Aba origem".
 *  2. Se for a primeira parcela vista deste contrato neste import, apaga as
 *     parcelas existentes do contrato (cenário de reimport).
 *  3. Cria o Installment.
 *  4. Se "Status origem" = Pago e "Total pago origem" > 0, cria também o
 *     registro em payments.
 *
 * Linhas órfãs (contractId não encontrado) são logadas e descartadas, sem
 * derrubar o batch.
 */
class BaseParcelasSheet implements OnEachRow, WithHeadingRow, WithStartRow, WithChunkReading, SkipsEmptyRows, SkipsOnError, SkipsOnFailure
{
    public const SHEET_NAME = 'Base_Parcelas';

    public function __construct(
        private readonly ContractImport $import,
        private readonly ContractImportRegistry $registry,
        private readonly bool $dryRun = false,
    ) {}

    public function headingRow(): int
    {
        return 3;
    }

    public function startRow(): int
    {
        return 4;
    }

    public function chunkSize(): int
    {
        return 500;
    }

    public function onRow(Row $row): void
    {
        $rowIndex = $row->getIndex();
        $data = $row->toArray();

        $code = trim((string) ($data['aba_origem'] ?? ''));
        if ($code === '' || mb_strtolower($code) === 'totais') {
            return;
        }

        try {
            $contractId = $this->registry->resolve($code);
            if ($contractId === null && !$this->dryRun) {
                // Fallback: consulta direta ao banco (caso o contrato já existisse
                // de uma importação anterior e a aba Regras_Contratuais não tenha
                // sido tocada nesta rodada por algum motivo).
                $contractId = Contract::where('code', $code)->value('id');
                if ($contractId) {
                    $this->registry->bind($code, $contractId, wasCreated: false);
                }
            }

            if ($contractId === null) {
                $this->registry->logSkip(self::SHEET_NAME, $rowIndex,
                    "Contrato '{$code}' não localizado; parcela ignorada.");
                $this->bumpProcessed(isError: true);
                return;
            }

            $payload = $this->normalize($data);

            if ($this->dryRun) {
                $this->registry->installmentsCreated++;
                if ($payload['paymentAmount'] > 0) {
                    $this->registry->paymentsCreated++;
                }
                $this->bumpProcessed();
                return;
            }

            DB::transaction(function () use ($contractId, $payload) {
                // Cenário de reimport: na primeira parcela deste contrato visto
                // neste job, apagamos as parcelas antigas para evitar duplicidade.
                if (!$this->registry->areInstallmentsCleared($contractId)) {
                    Installment::where('contractId', $contractId)->delete();
                    $this->registry->markInstallmentsCleared($contractId);
                }

                $installment = Installment::create([
                    'contractId'        => $contractId,
                    'installmentNumber' => $payload['installmentNumber'],
                    'dueDate'           => $payload['dueDate'],
                    'originalAmount'    => $payload['originalAmount'],
                    'status'            => $payload['status'],
                    'notes'             => $payload['notes'],
                ]);
                $this->registry->installmentsCreated++;
                $this->registry->touchContract($contractId);

                if ($payload['paymentAmount'] > 0 && $payload['paymentDate']) {
                    Payment::create([
                        'installmentId' => $installment->id,
                        'amount'        => $payload['paymentAmount'],
                        'paidAt'        => $payload['paymentDate'],
                        'method'        => 'PIX',
                        'notes'         => 'Importado via planilha',
                        'recordedBy'    => 'import',
                    ]);
                    $this->registry->paymentsCreated++;
                }
            });

            $this->bumpProcessed();
        } catch (Throwable $e) {
            $this->registry->logError(self::SHEET_NAME, $rowIndex, $e->getMessage());
            Log::warning("Import Base_Parcelas L{$rowIndex}: {$e->getMessage()}");
            $this->bumpProcessed(isError: true);
        }
    }

    private function normalize(array $row): array
    {
        $installmentNumber = (int) S::toDecimal($row['parcela'] ?? null, 0);
        if ($installmentNumber <= 0) {
            throw new \RuntimeException('Número de parcela inválido.');
        }

        $dueDate = S::toDate($row['vencimento_origem'] ?? null);
        if ($dueDate === null) {
            throw new \RuntimeException('Vencimento ausente ou inválido.');
        }

        $originalAmount = S::toDecimal($row['valor_parcela'] ?? null, 0.0);
        if ($originalAmount <= 0) {
            throw new \RuntimeException('Valor da parcela inválido (<= 0).');
        }

        $status = S::mapInstallmentStatus($row['status_origem'] ?? null);
        $paymentAmount = S::toDecimal($row['total_pago_origem'] ?? null, 0.0);
        $paymentDate   = S::toDate($row['data_pagamento_origem'] ?? null);
        $notes         = trim((string) ($row['observacao'] ?? '')) ?: null;

        return [
            'installmentNumber' => $installmentNumber,
            'dueDate'           => $dueDate,
            'originalAmount'    => $originalAmount,
            'status'            => $status,
            'notes'             => $notes,
            'paymentAmount'     => $paymentAmount,
            'paymentDate'       => $paymentDate,
        ];
    }

    private function bumpProcessed(bool $isError = false): void
    {
        $this->import->processedRows += 1;
        if ($isError) {
            $this->import->errorRows += 1;
        } else {
            $this->import->successRows += 1;
        }
        // Em modo validação a ContractImport recebida é uma instância "fantasma"
        // (nunca salva no banco). Persistir aqui criaria um registro indesejado
        // na tabela "Importações recentes".
        if ($this->dryRun) {
            return;
        }
        // Em sheets grandes, evitamos saveQuietly() a cada linha para não
        // martelar o banco. Salvamos a cada 25 linhas para ainda dar feedback
        // razoável ao polling do frontend.
        if (($this->import->processedRows % 25) === 0) {
            $this->import->saveQuietly();
        }
    }

    public function onError(Throwable $e): void
    {
        $this->registry->logError(self::SHEET_NAME, 0, 'onError: ' . $e->getMessage());
        Log::error('Import Base_Parcelas onError: ' . $e->getMessage());
    }

    public function onFailure(\Maatwebsite\Excel\Validators\Failure ...$failures): void
    {
        foreach ($failures as $f) {
            $this->registry->logError(self::SHEET_NAME, $f->row(), implode('; ', $f->errors()));
        }
    }
}
