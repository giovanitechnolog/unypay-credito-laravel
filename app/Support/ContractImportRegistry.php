<?php

namespace App\Support;

/**
 * Registry compartilhado entre as duas sheets do import multi-aba.
 *
 * Responsabilidades:
 *  - Manter o mapa code(string) -> id(int) dos contratos criados/atualizados
 *    durante a primeira aba (Regras_Contratuais), para que a segunda aba
 *    (Base_Parcelas) localize o contractId sem ir ao banco a cada linha.
 *  - Acumular contadores e erros que serão gravados na tabela contract_imports
 *    e exibidos na UI.
 *  - Servir como "bucket" também no modo dry-run, onde nada é persistido.
 *
 * Registrado como singleton via container do Laravel (escopo do request/job).
 */
class ContractImportRegistry
{
    /** @var array<string,int> map code -> contractId */
    private array $codeToId = [];

    /** @var array<int,true> contratos cujas parcelas já foram limpas neste import */
    private array $clearedInstallments = [];

    public int $contractsCreated    = 0;
    public int $contractsUpdated    = 0;
    public int $clientsCreated      = 0;
    public int $installmentsCreated = 0;
    public int $paymentsCreated     = 0;
    public int $skippedRows         = 0;
    public int $errorRows           = 0;

    /** @var array<int,array{sheet:string,row:int,message:string,severity:string}> */
    public array $errors = [];

    /** @var array<int,true> ids únicos de contratos afetados (para recalc final) */
    private array $touchedContractIds = [];

    public function reset(): void
    {
        $this->codeToId            = [];
        $this->clearedInstallments = [];
        $this->contractsCreated    = 0;
        $this->contractsUpdated    = 0;
        $this->clientsCreated      = 0;
        $this->installmentsCreated = 0;
        $this->paymentsCreated     = 0;
        $this->skippedRows         = 0;
        $this->errorRows           = 0;
        $this->errors              = [];
        $this->touchedContractIds  = [];
    }

    public function bind(string $code, int $contractId, bool $wasCreated): void
    {
        $this->codeToId[$code] = $contractId;
        // contractId === 0 é a sentinela do modo dry-run; nesse caso usamos o
        // próprio code como chave única no Set de "tocados", para o resumo
        // mostrar o número correto de contratos que SERIAM afetados.
        if ($contractId > 0) {
            $this->touchedContractIds[$contractId] = true;
        }
        if ($wasCreated) {
            $this->contractsCreated++;
        } else {
            $this->contractsUpdated++;
        }
    }

    public function resolve(string $code): ?int
    {
        return $this->codeToId[$code] ?? null;
    }

    public function markInstallmentsCleared(int $contractId): void
    {
        $this->clearedInstallments[$contractId] = true;
    }

    public function areInstallmentsCleared(int $contractId): bool
    {
        return isset($this->clearedInstallments[$contractId]);
    }

    public function touchContract(int $contractId): void
    {
        $this->touchedContractIds[$contractId] = true;
    }

    /** @return int[] */
    public function touchedContractIds(): array
    {
        return array_keys($this->touchedContractIds);
    }

    public function logError(string $sheet, int $rowIndex, string $message): void
    {
        $this->errors[] = [
            'sheet'    => $sheet,
            'row'      => $rowIndex,
            'message'  => $message,
            'severity' => 'error',
        ];
        $this->errorRows++;
    }

    public function logSkip(string $sheet, int $rowIndex, string $message): void
    {
        $this->errors[] = [
            'sheet'    => $sheet,
            'row'      => $rowIndex,
            'message'  => $message,
            'severity' => 'skipped',
        ];
        $this->skippedRows++;
    }

    /**
     * Resumo compactável para guardar em contract_imports.summaryJson
     * e também para devolver no endpoint de status / dry-run.
     */
    public function summary(): array
    {
        return [
            'contractsCreated'    => $this->contractsCreated,
            'contractsUpdated'    => $this->contractsUpdated,
            'clientsCreated'      => $this->clientsCreated,
            'installmentsCreated' => $this->installmentsCreated,
            'paymentsCreated'     => $this->paymentsCreated,
            'skippedRows'         => $this->skippedRows,
            'errorRows'           => $this->errorRows,
            // Em modo real = contratos cujas parcelas foram inseridas/atualizadas.
            // Em modo dry-run = mesma soma de criados+atualizados (ver bind()).
            'touchedContracts'    => max(count($this->touchedContractIds),
                                          $this->contractsCreated + $this->contractsUpdated),
        ];
    }
}
