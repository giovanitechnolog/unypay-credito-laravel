<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class ContractsExport implements FromCollection, WithHeadings
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
                $c['contractType'],
                $c['contractName'],
                $c['creditorName'],
                $c['principalAmount'],
                $c['financedTotal'],
                $c['installmentCount'],
                $c['installmentAmount'],
                $c['status'],
                $this->formatDate($c['contractDate'] ?? null),
                $this->formatDate($c['firstDueDate'] ?? null),
                isset($c['moraRateMonthly']) ? round((float) $c['moraRateMonthly'] * 100, 2) . '%' : '',
            ];
        });
    }

    public function headings(): array
    {
        return [
            'Código',
            'Cliente',
            'Tipo Contrato',
            'Nome do Contrato',
            'Credor',
            'Principal',
            'Financiado',
            'Parc.',
            'Vl. Parcela',
            'Status',
            'Emissão',
            '1ª Venc.',
            'Mora',
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
