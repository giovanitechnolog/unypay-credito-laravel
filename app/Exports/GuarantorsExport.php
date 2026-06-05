<?php

namespace App\Exports;

use App\Models\Guarantor;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class GuarantorsExport implements FromCollection, WithHeadings
{
    public function __construct(
        private readonly Collection $rows,
    ) {}

    public function collection(): Collection
    {
        return $this->rows->map(function (Guarantor $g) {
            $isPj = $g->personType === 'PJ';

            $clientes = collect($g->clients ?? [])
                ->pluck('name')
                ->filter()
                ->implode('; ');

            return [
                $g->name,
                $g->personType ?? 'PF',
                $isPj ? ($g->cnpj ?? '') : ($g->cpf ?? ''),
                $isPj ? ($g->stateRegistration ?? '') : ($g->rg ?? ''),
                $isPj ? ($g->tradeName ?? '') : ($g->nationality ?? ''),
                $isPj ? '' : ($g->maritalStatus ?? ''),
                $g->city ?? '',
                $g->state ?? '',
                $g->neighborhood ?? '',
                $clientes ?: '—',
                (int) ($g->fiadores_count ?? 0),
                (int) ($g->codevedores_count ?? 0),
            ];
        });
    }

    public function headings(): array
    {
        return [
            'Fiador',
            'Tipo',
            'Documento',
            'RG / IE',
            'Nacionalidade / Nome Fantasia',
            'Estado Civil',
            'Cidade',
            'UF',
            'Bairro',
            'Clientes Vinculados',
            'Vínculo Fiador',
            'Vínculo Codevedor',
        ];
    }
}
