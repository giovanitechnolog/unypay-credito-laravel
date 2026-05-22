<?php

namespace App\Imports\Sheets;

use App\Models\Client;
use App\Models\Contract;
use App\Models\ContractImport;
use App\Support\ContractImportRegistry;
use App\Support\SpreadsheetSanitizer as S;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithStartRow;
use Maatwebsite\Excel\Row;
use Throwable;

/**
 * Processa a aba "Regras_Contratuais": cabeçalho na linha 3, dados a partir da 4.
 *
 * Para cada linha:
 *  1. Upsert do Client por nome normalizado (algumas linhas compartilham cliente).
 *  2. updateOrCreate do Contract usando "Aba" como code (chave única).
 *  3. Registra o code -> id no Registry para a BaseParcelasSheet usar depois.
 *
 * No modo dry-run, apenas valida e conta, sem tocar no banco.
 */
class RegrasContratuaisSheet implements OnEachRow, WithHeadingRow, WithStartRow, SkipsEmptyRows, SkipsOnError, SkipsOnFailure
{
    public const SHEET_NAME = 'Regras_Contratuais';

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

    public function onRow(Row $row): void
    {
        $rowIndex = $row->getIndex();
        $data = $row->toArray();

        // O slug-formatter do Maatwebsite vai gerar as chaves abaixo a partir
        // dos cabeçalhos: Aba, Cliente, Contrato, Credor, Data contrato, etc.
        $code = trim((string) ($data['aba'] ?? ''));

        if ($code === '' || mb_strtolower($code) === 'totais') {
            return; // linha de rodapé ou vazia
        }

        try {
            $payload = $this->normalize($data);

            if ($this->dryRun) {
                // Apenas conta como sucesso e mantém o code num "fake" id
                $this->registry->bind($code, 0, wasCreated: true);
                $this->bumpProcessed();
                return;
            }

            DB::transaction(function () use ($code, $payload) {
                $client = $this->upsertClient($payload['clientName']);
                $contract = $this->upsertContract($code, $client->id, $payload);
                $this->registry->bind($code, $contract->id, wasCreated: $contract->wasRecentlyCreated);
            });

            $this->bumpProcessed();
        } catch (Throwable $e) {
            $this->registry->logError(self::SHEET_NAME, $rowIndex, $e->getMessage());
            Log::warning("Import Regras_Contratuais L{$rowIndex}: {$e->getMessage()}");
            $this->bumpProcessed(isError: true);
        }
    }

    /**
     * Recebe o array bruto da linha e devolve os campos prontos para inserir.
     */
    private function normalize(array $row): array
    {
        $clientName    = trim((string) ($row['cliente'] ?? ''));
        $contractName  = trim((string) ($row['contrato'] ?? ''));
        $creditor      = trim((string) ($row['credor'] ?? ''));
        $contractDate  = S::toDate($row['data_contrato'] ?? null);
        $valorContrato = S::toDecimal($row['valor_contrato'] ?? null, 0.0);
        $juros         = S::toRate($row['juros_mora_a_m'] ?? null, 0.0);
        $multa         = S::toRate($row['multa'] ?? null, 0.0);
        $baseMulta     = S::mapPenaltyBase($row['base_multa'] ?? null);
        $honorarios    = S::toRate($row['honorarios'] ?? null, 0.0);
        $accelerates   = S::toBool($row['venc_antecipado'] ?? null, false);
        $rule          = trim((string) ($row['regra_clausula_atraso'] ?? ''));
        $guarantors    = trim((string) ($row['garantias'] ?? ''));
        $fonte         = trim((string) ($row['fonte'] ?? ''));
        $validated     = S::toBool($row['validado'] ?? null, false);

        if ($clientName === '') {
            throw new \RuntimeException('Coluna "Cliente" vazia.');
        }
        if ($contractName === '') {
            throw new \RuntimeException('Coluna "Contrato" vazia.');
        }

        return [
            'clientName'      => $clientName,
            'contractName'    => $contractName,
            'creditor'        => $creditor !== '' ? $creditor : 'UnyPay® S.A.',
            'contractDate'    => $contractDate,
            'principalAmount' => $valorContrato, // fallback conforme decidido no plano
            'financedTotal'   => $valorContrato,
            'monthlyInterestRate' => 0.0,        // a planilha só traz mora; juros normais ficam zero
            'moraRateMonthly' => $juros,
            'penaltyRate'     => $multa,
            'penaltyBaseType' => $baseMulta,
            'honoraryRate'    => $honorarios,
            'accelerates'     => $accelerates,
            'accelerationRule'=> $rule !== '' ? $rule : null,
            'guarantors'      => $guarantors !== '' ? $guarantors : null,
            'sourcePdfName'   => $fonte !== '' ? $fonte : null,
            'validated'       => $validated,
        ];
    }

    private function upsertClient(string $clientName): Client
    {
        // Match por nome exato. Caso a mesma carteira venha com pequenas
        // variações de grafia no futuro, basta evoluir esta lógica.
        $existing = Client::where('name', $clientName)->first();
        if ($existing) {
            return $existing;
        }

        $client = Client::create([
            'name'       => $clientName,
            'personType' => S::inferPersonType($clientName),
            'riskRating' => 'A',
        ]);
        $this->registry->clientsCreated++;
        return $client;
    }

    private function upsertContract(string $code, int $clientId, array $payload): Contract
    {
        return Contract::updateOrCreate(
            ['code' => $code],
            [
                'clientId'           => $clientId,
                'contractName'       => $payload['contractName'],
                'creditor'           => $payload['creditor'],
                'contractType'       => 'Mútuo/Confissão de dívida',
                'contractDate'       => $payload['contractDate'],
                'status'             => 'Ativo',
                'validated'          => $payload['validated'],
                'principalAmount'    => $payload['principalAmount'],
                'financedTotal'      => $payload['financedTotal'],
                'tacAmount'          => 0,
                'iofAmount'          => 0,
                // installmentCount / installmentAmount / firstDueDate serão
                // recalculados pelo job após a importação das parcelas.
                'monthlyInterestRate'=> $payload['monthlyInterestRate'],
                'moraRateMonthly'    => $payload['moraRateMonthly'],
                'penaltyRate'        => $payload['penaltyRate'],
                'penaltyBaseType'    => $payload['penaltyBaseType'],
                'penaltyScope'       => 'per_installment',
                'correctionIndex'    => 'IPCA',
                'honoraryRate'       => $payload['honoraryRate'],
                'accelerates'        => $payload['accelerates'],
                'accelerationRule'   => $payload['accelerationRule'],
                'guarantors'         => $payload['guarantors'],
                'sourcePdfName'      => $payload['sourcePdfName'],
            ]
        );
    }

    private function bumpProcessed(bool $isError = false): void
    {
        // Mantemos o contador "processedRows" do ContractImport sempre atualizado
        // para que o polling de status no frontend reflita progresso real.
        $this->import->processedRows += 1;
        if ($isError) {
            $this->import->errorRows += 1;
        } else {
            $this->import->successRows += 1;
        }
        $this->import->saveQuietly();
    }

    // SkipsOnError + SkipsOnFailure: capturam erros sem derrubar o batch inteiro.
    public function onError(Throwable $e): void
    {
        $this->registry->logError(self::SHEET_NAME, 0, 'onError: ' . $e->getMessage());
        Log::error('Import Regras_Contratuais onError: ' . $e->getMessage());
    }

    public function onFailure(\Maatwebsite\Excel\Validators\Failure ...$failures): void
    {
        foreach ($failures as $f) {
            $this->registry->logError(self::SHEET_NAME, $f->row(), implode('; ', $f->errors()));
        }
    }
}
