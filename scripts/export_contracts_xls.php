<?php

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Client;

// Eager-load também os fiadores (NxN — tabela contract_guarantor) para
// listá-los nominalmente na coluna "Fiadores" da planilha.
$clients = Client::with([
    'contracts' => function ($q) { $q->where('status', 'Ativo'); },
    'contracts.guarantors:id,name,personType,tradeName',
])->get();

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();

$headers = [
    'Cliente', 'Documento', 'Email', 'Telefone', 'Contrato', 'Código', 'Credor',
    'Tipo Contrato', 'Valor Principal', 'Valor Financiado', 'TAC', 'IOF', 'Parcelas',
    'Valor Parcela', 'Primeiro Vencimento', 'Juros Mensal', 'Juros Mora Mensal',
    'Penalidade', 'Base Penalidade', 'Escopo Penalidade', 'Indice Correção', 'Honorários',
    'Garantias', 'Fiadores', 'Observações', 'Status', 'Validado'
];

$col = 1;
foreach ($headers as $h) {
    $sheet->setCellValueByColumnAndRow($col++, 1, $h);
}

$row = 2;
foreach ($clients as $client) {
    foreach ($client->contracts as $contract) {
        $col = 1;
        $sheet->setCellValueByColumnAndRow($col++, $row, $client->name);
        $sheet->setCellValueByColumnAndRow($col++, $row, $client->document);
        $sheet->setCellValueByColumnAndRow($col++, $row, $client->email);
        $sheet->setCellValueByColumnAndRow($col++, $row, $client->phone);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->contractName);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->code);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->creditor);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->contractType);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->principalAmount);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->financedTotal);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->tacAmount);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->iofAmount);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->installmentCount);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->installmentAmount);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->firstDueDate);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->monthlyInterestRate);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->moraRateMonthly);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->penaltyRate);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->penaltyBaseType);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->penaltyScope);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->correctionIndex);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->honoraryRate);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->guarantees);

        // Lista os fiadores reais (NxN). Se o contrato é antigo e não tem
        // vínculo na pivot, ainda assim cai no fallback do texto legado.
        $guarantorNames = $contract->guarantors
            ->map(fn ($g) => $g->personType === 'PJ' ? ($g->tradeName ?: $g->name) : $g->name)
            ->filter()
            ->implode(', ');
        if ($guarantorNames === '') {
            $guarantorNames = (string) ($contract->getRawOriginal('guarantors') ?? '');
        }
        $sheet->setCellValueByColumnAndRow($col++, $row, $guarantorNames);

        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->observations);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->status);
        $sheet->setCellValueByColumnAndRow($col++, $row, $contract->validated ? 'Sim' : 'Não');

        $row++;
    }
}

$exportDir = __DIR__ . '/../storage/app/exports';
if (!is_dir($exportDir)) {
    mkdir($exportDir, 0755, true);
}

$filePath = $exportDir . '/contracts_active_by_client.xlsx';
$writer = new Xlsx($spreadsheet);
$writer->save($filePath);

echo "Arquivo gerado: " . $filePath . PHP_EOL;
