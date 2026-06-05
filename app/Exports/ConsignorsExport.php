<?php

namespace App\Exports;

use App\Models\Consignor;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class ConsignorsExport implements FromCollection, WithHeadings
{
    public function __construct(
        private readonly Collection $rows,
    ) {}

    public function collection(): Collection
    {
        return $this->rows->map(function (Consignor $c) {
            $accounts = $c->bankAccounts ?? collect();
            $firstPix = $accounts->first(fn ($a) => ! empty($a->pixKey));

            $address = trim(implode(', ', array_filter([
                $c->street,
                $c->number ? 'nº ' . $c->number : null,
                $c->neighborhood,
            ])));

            return [
                $c->id,
                $c->name,
                $this->personTypeFromDocument($c->document),
                $c->document ?? '',
                $c->email ?? '',
                $c->phone ?? '',
                $address,
                $c->city ?? '',
                $c->state ?? '',
                $c->zipCode ?? '',
                $accounts->count(),
                $firstPix?->pixKey ?? '—',
            ];
        });
    }

    public function headings(): array
    {
        return [
            'ID',
            'Nome / Razão Social',
            'Tipo',
            'Documento',
            'E-mail',
            'Telefone',
            'Endereço',
            'Cidade',
            'UF',
            'CEP',
            'Contas Bancárias',
            'PIX',
        ];
    }

    private function personTypeFromDocument(?string $document): string
    {
        $digits = preg_replace('/\D/', '', $document ?? '');

        return strlen($digits) > 11 ? 'PJ' : 'PF';
    }
}
