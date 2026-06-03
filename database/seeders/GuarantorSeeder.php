<?php

namespace Database\Seeders;

use App\Models\Guarantor;
use Illuminate\Database\Seeder;

class GuarantorSeeder extends Seeder
{
    public function run(): void
    {
        $guarantors = [
            [
                'name'           => 'Wilson Matheus de Souza e Silva',
                'personType'     => 'PF',
                'nationality'    => 'Brasileiro',
                'maritalStatus'  => 'Casado(a)',
                // CPF e CEP são salvos sem máscara (apenas dígitos)
                'cpf'            => '05638403663',
                'rg'             => 'MG-8.421.530',
                'street'         => 'Rua Marataizes',
                'number'         => '377',
                'neighborhood'   => 'São Pedro',
                'city'           => 'Arcos',
                'state'          => 'MG',
                'zipCode'        => '35588000',
            ],
            [
                'name'           => 'Camilla Terencia Passos Souza',
                'personType'     => 'PF',
                'nationality'    => 'Brasileira',
                'maritalStatus'  => 'Casado(a)',
                'cpf'            => '04760125620',
                'rg'             => '13.259.643',
                'street'         => 'Rua Marataizes',
                'number'         => '377',
                'neighborhood'   => 'São Pedro',
                'city'           => 'Arcos',
                'state'          => 'MG',
                'zipCode'        => '35588000',
            ],
        ];

        foreach ($guarantors as $row) {
            Guarantor::updateOrCreate(
                ['cpf' => $row['cpf']],
                $row
            );
        }
    }
}
