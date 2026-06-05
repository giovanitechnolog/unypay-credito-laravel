<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class ClientsExport implements FromCollection, WithHeadings
{
    public function __construct(
        private readonly Collection $rows,
    ) {}

    public function collection(): Collection
    {
        return $this->rows->map(function (array $c) {
            $notes = $this->parseNotes($c['notes'] ?? null);

            $pixKey = '—';
            if (! empty($notes['bankAccounts']) && is_array($notes['bankAccounts'])) {
                foreach ($notes['bankAccounts'] as $acc) {
                    if (! empty($acc['hasPix']) && ! empty($acc['pixKey'])) {
                        $pixKey = $acc['pixKey'];
                        break;
                    }
                }
            }

            $vinculos = collect($c['guarantors'] ?? [])
                ->map(fn (array $g) => ($g['name'] ?? '') . ' (' . ($g['role'] ?? 'FIADOR') . ')')
                ->filter()
                ->implode('; ');

            return [
                $c['name'],
                $c['document'] ?? '',
                $c['personType'] ?? 'PF',
                $c['email'] ?? '',
                $c['phone'] ?? '',
                $c['address'] ?? '',
                $c['city'] ?? '',
                $c['state'] ?? '',
                $c['zipCode'] ?? '',
                $c['riskRating'] ?? '',
                $notes['profissao'] ?? '',
                $pixKey,
                $vinculos ?: '—',
                isset($c['createdAt']) ? date('d/m/Y', strtotime($c['createdAt'])) : '',
            ];
        });
    }

    public function headings(): array
    {
        return [
            'Nome',
            'Documento',
            'Tipo',
            'E-mail',
            'Telefone',
            'Endereço',
            'Cidade',
            'UF',
            'CEP',
            'Rating',
            'Profissão',
            'PIX',
            'Fiadores / Codevedores',
            'Cadastro',
        ];
    }

    /** @return array<string, mixed> */
    private function parseNotes(?string $notes): array
    {
        if (empty($notes)) {
            return [];
        }

        $decoded = json_decode($notes, true);

        return is_array($decoded) ? $decoded : [];
    }
}
