<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class PaymentsExport implements FromCollection, WithHeadings
{
    public function __construct(
        private readonly Collection $rows,
    ) {}

    public function collection(): Collection
    {
        return $this->rows->map(function (array $r) {
            return [
                $r['code'],
                $r['clientName'],
                $this->formatDate($r['contractDate'] ?? null),
                $r['creditorName'],
                $r['principalAmount'],
                $r['financedTotal'],
                $r['installmentCount'],
                $r['installmentAmount'],
                $r['paidInstallments'],
                $r['overdueInstallments'],
                $r['maxDaysOverdue'],
                $r['toReceive'],
                $r['totalInterest'],
                isset($r['cetMonthly']) ? round((float) $r['cetMonthly'] * 100, 2) . '%' : '',
                $r['status'],
                $this->formatDate($r['firstDueDate'] ?? null),
            ];
        });
    }

    public function headings(): array
    {
        return [
            'Código',
            'Cliente',
            'Data',
            'Credor',
            'Principal',
            'Financiado',
            'Parcelas',
            'Vl. Parcela',
            'Pagas',
            'Em Aberto',
            'Dias Atr.',
            'Vl. Receber',
            'Juros Totais',
            'CET Mensal',
            'Status',
            '1º Venc.',
        ];
    }

    private function formatDate(?string $date): string
    {
        if (empty($date)) {
            return '';
        }

        $ts = strtotime($date);

        return $ts ? date('d/m/Y', $ts) : '';
    }
}
