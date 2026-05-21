<?php

namespace App\Imports;

use App\Imports\Sheets\BaseParcelasSheet;
use App\Imports\Sheets\RegrasContratuaisSheet;
use App\Models\ContractImport;
use App\Support\ContractImportRegistry;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Importador "guarda-chuva" da planilha completa do cliente.
 *
 * A planilha tem ~18 abas, mas só processamos duas:
 *   - "Regras_Contratuais" (cabeçalhos+contratos) -> RegrasContratuaisSheet
 *   - "Base_Parcelas"      (cronograma de parcelas) -> BaseParcelasSheet
 *
 * As demais abas (Dashboard, Auditoria, abas individuais por contrato, etc.)
 * são automaticamente IGNORADAS porque não constam em sheets().
 *
 * Ordem de execução: as abas são processadas na ordem que aparecem no array,
 * portanto Regras_Contratuais SEMPRE roda primeiro para popular o Registry
 * com os contractIds que a aba de parcelas precisa para o foreign key.
 */
class CarteiraContratosImport implements WithMultipleSheets
{
    public function __construct(
        private readonly ContractImport $import,
        private readonly ContractImportRegistry $registry,
        private readonly bool $dryRun = false,
    ) {
        $this->registry->reset();
    }

    public function sheets(): array
    {
        return [
            RegrasContratuaisSheet::SHEET_NAME => new RegrasContratuaisSheet(
                $this->import, $this->registry, $this->dryRun
            ),
            BaseParcelasSheet::SHEET_NAME      => new BaseParcelasSheet(
                $this->import, $this->registry, $this->dryRun
            ),
        ];
    }
}
