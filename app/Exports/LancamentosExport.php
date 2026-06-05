<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class LancamentosExport implements FromCollection, WithHeadings
{
    public function __construct(
        private readonly Collection $rows,
    ) {}

    public function collection(): Collection
    {
        return $this->rows->map(function (array $c) {
            return [
                $c['code'],
                $c['clientName'],
                $c['contractType'] ?? 'Outro',
                $c['status'],
                $c['principalAmount'],
                $c['financedTotal'],
                $c['openBalanceTotal'],
                $c['installmentCount'],
                $c['installmentAmount'],
                $c['contractDate'],
                $c['creditor'],
                $c['paidInstallmentsCount'],
                $c['overdueInstallmentsCount'],
                $c['maxDaysOverdue'],
                $c['openBalanceTotal'],
                $c['interestAccumulated'],
                $c['moraRateMonthly'],
                $c['penaltyRate'],
                $c['firstDueDate'],
                ($c['validated'] ?? false) ? 'Sim' : 'Não',
            ];
        });
    }

    public function headings(): array
    {
        return [
            'Classif.',
            'Cliente',
            'Tipo',
            'Status',
            'Principal',
            'Total c/ Juros',
            'Total a Receber',
            'Parc.',
            'Vl. Parcela',
            'Data',
            'Credor',
            'Pagas',
            'Em Aberto',
            'Dias Atr.',
            'Vl. Receber',
            'Juros Totais',
            'CET Mensal',
            'CET Anual',
            '1ª Venc.',
            'Valid.',
        ];
    }
}
