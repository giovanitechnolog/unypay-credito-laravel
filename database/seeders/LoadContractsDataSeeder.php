<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LoadContractsDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $payload = [
            [
                'client' => [
                    'name' => 'IAMAR RUFINO DE OLIVEIRA',
                    'document' => '486.349.131-04',
                ],
                'contract' => [
                    'code' => 'CONSIGNADO-IAMAR-2026',
                    'contractName' => 'Contrato de Crédito Consignado - Iamar',
                    'creditor' => 'UnyPay® S.A.',
                    'contract_type_id' => 1,
                    'contractDate' => '2026-01-12',
                    'status' => 'Ativo',
                    'principalAmount' => 6000.00,
                    'financedTotal' => 6000.00,
                    'installmentCount' => 10,
                    'installmentAmount' => 834.76,
                    'firstDueDate' => '2026-01-31',
                    'moraRateMonthly' => 0.01,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'IGP-M',
                    'honoraryRate' => 0.20,
                    'accelerates' => true,
                    'accelerationRule' => 'A dívida vencerá antecipadamente na infringência de cláusulas contratuais ou rescisão do contrato de trabalho.',
                    'accelerationConsecutiveThreshold' => 1,
                    'guarantees' => 'Margem consignável e verbas rescisórias/férias/13º',
                    'guarantors' => 'HENRIQUE ALVES DE MEDEIROS (CPF 037.360.496-33)',
                    'validationUrl' => 'https://valida.ae/c36b226985bae968c0f8fd9e411277b1421b9170a9c82857a?sv',
                ]
            ],
            [
                'client' => [
                    'name' => 'JOSE LUIS FERNANDEZ CARTAYA',
                    'document' => '708.670.242-08',
                ],
                'contract' => [
                    'code' => 'CONSIGNADO-JOSE-2026',
                    'contractName' => 'Contrato de Crédito Consignado - Jose Luis',
                    'creditor' => 'UnyPay® S.A.',
                    'contract_type_id' => 1,
                    'contractDate' => '2026-02-26',
                    'status' => 'Ativo',
                    'principalAmount' => 3500.00,
                    'financedTotal' => 3500.00,
                    'installmentCount' => 12,
                    'installmentAmount' => 424.13,
                    'firstDueDate' => '2026-02-28',
                    'moraRateMonthly' => 0.01,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'IGP-M',
                    'honoraryRate' => 0.20,
                    'accelerates' => true,
                    'accelerationRule' => 'A dívida vencerá antecipadamente na infringência de cláusulas contratuais ou rescisão do contrato de trabalho.',
                    'accelerationConsecutiveThreshold' => 1,
                    'guarantees' => 'Desconto em folha e verbas rescisórias',
                    'guarantors' => 'Sem fiador listado diretamente',
                    'validationUrl' => 'https://valida.ae/11fdb57044e43e669445e2cb969ea2f919054ba64232705f9?sv',
                ]
            ],
            [
                'client' => [
                    'name' => 'LUCAS ALVES DE ALMEIDA',
                    'document' => '020.422.021-18',
                ],
                'contract' => [
                    'code' => 'CONSIGNADO-LUCAS-2026',
                    'contractName' => 'Contrato de Crédito Consignado - Lucas',
                    'creditor' => 'UnyPay® S.A.',
                    'contract_type_id' => 1,
                    'contractDate' => '2026-03-11',
                    'status' => 'Ativo',
                    'principalAmount' => 4000.00,
                    'financedTotal' => 4000.00,
                    'installmentCount' => 12,
                    'installmentAmount' => 496.17,
                    'firstDueDate' => '2026-05-31',
                    'moraRateMonthly' => 0.01,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'IGP-M',
                    'honoraryRate' => 0.20,
                    'accelerates' => true,
                    'accelerationRule' => 'Vencimento antecipado em caso de rescisão ou quebra contratual.',
                    'accelerationConsecutiveThreshold' => 1,
                    'guarantees' => 'Desconto em folha e verbas rescisórias',
                    'guarantors' => 'Sem fiador formalizado',
                    'validationUrl' => 'https://valida.ae/ea5f585602bc39d74174a2297c7879bd31335e34e19356993?sv',
                ]
            ],
            [
                'client' => [
                    'name' => 'LEONARDO DE SOUSA MIRANDA',
                    'document' => '041.420.031-43',
                ],
                'contract' => [
                    'code' => 'CONSIGNADO-LEONARDO-2026',
                    'contractName' => 'Contrato de Crédito Consignado - Leonardo',
                    'creditor' => 'UnyPay® S.A.',
                    'contract_type_id' => 1,
                    'contractDate' => '2026-05-11',
                    'status' => 'Ativo',
                    'principalAmount' => 3500.00,
                    'financedTotal' => 3500.00,
                    'installmentCount' => 6,
                    'installmentAmount' => 711.30,
                    'firstDueDate' => '2026-05-31',
                    'moraRateMonthly' => 0.01,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'IGP-M',
                    'honoraryRate' => 0.20,
                    'accelerates' => true,
                    'accelerationRule' => 'Vencimento antecipado em até 48 horas após desligamento.',
                    'accelerationConsecutiveThreshold' => 1,
                    'guarantees' => 'Desconto em folha / rescisório',
                    'guarantors' => 'Sem fiador',
                    'validationUrl' => 'https://valida.ae/5863af6991a869c81b7897ec8910ef8f9b80599bae97e9a78',
                ]
            ],
            [
                'client' => [
                    'name' => 'EVERTON FERREIRA RODRIGUES',
                    'document' => '114.778.776-06',
                ],
                'contract' => [
                    'code' => 'CONSIGNADO-EVERTON-2026',
                    'contractName' => 'Contrato de Crédito Consignado - Everton',
                    'creditor' => 'UnyPay® S.A.',
                    'contract_type_id' => 1,
                    'contractDate' => '2026-05-18',
                    'status' => 'Ativo',
                    'principalAmount' => 3000.00,
                    'financedTotal' => 3000.00,
                    'installmentCount' => 10,
                    'installmentAmount' => 414.17,
                    'firstDueDate' => '2026-05-31',
                    'moraRateMonthly' => 0.01,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'IGP-M',
                    'honoraryRate' => 0.20,
                    'accelerates' => true,
                    'accelerationRule' => 'Aceleração de saldo remanescente em 48 horas.',
                    'guarantees' => 'Desconto em folha de pagamento e verbas rescisórias',
                    'guarantors' => 'Sem fiador formalizado',
                    'validationUrl' => 'https://valida.ae/91e54924f42bec4cb79617e7766faa7c9b301a3a9a280bc87',
                ]
            ],
            [
                'client' => [
                    'name' => 'PATRICK HERMES SILVA',
                    'document' => '079.377.316-48',
                ],
                'contract' => [
                    'code' => 'MUTUO-PATRICK-2024',
                    'contractName' => 'Contrato de Mútuo - Patrick Hermes',
                    'creditor' => 'HI TRANSPORTES LTDA',
                    'contract_type_id' => 2,
                    'contractDate' => '2024-01-23',
                    'status' => 'Ativo',
                    'principalAmount' => 5000.00,
                    'financedTotal' => 5000.00,
                    'installmentCount' => 31,
                    'installmentAmount' => 464.42,
                    'firstDueDate' => '2024-02-28',
                    'moraRateMonthly' => 0.00,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'Nenhuma',
                    'honoraryRate' => 0.00,
                    'accelerates' => true,
                    'accelerationRule' => 'Em caso de rescisão, o saldo remanescente deve ser pago em até 30 dias sob multa de 10%.',
                    'guarantees' => 'Desconto em folha salarial e rescisão de contrato de trabalho',
                    'guarantors' => 'VIVIANE NOGUEIRA (CPF 067.734.656-56)',
                    'validationUrl' => 'https://valida.ae/a7820c68f7352c142cc4dbbfa806708455a60df19a4acb6be',
                ]
            ],
            [
                'client' => [
                    'name' => 'GERSON FERREIRA BATISTA FILHO',
                    'document' => '043.686.846-64',
                ],
                'contract' => [
                    'code' => 'MUTUO-GERSON-2024',
                    'contractName' => 'Contrato de Mútuo - Gerson Ferreira',
                    'creditor' => 'HI TRANSPORTES LTDA',
                    'contract_type_id' => 2,
                    'contractDate' => '2024-02-21',
                    'status' => 'Ativo',
                    'principalAmount' => 20000.00,
                    'financedTotal' => 20000.00,
                    'installmentCount' => 34,
                    'installmentAmount' => 998.47,
                    'firstDueDate' => '2024-02-29',
                    'moraRateMonthly' => 0.00,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'Nenhuma',
                    'honoraryRate' => 0.00,
                    'accelerates' => true,
                    'accelerationRule' => 'Quitação em 30 dias após rescisão de contrato sob multa de 10%.',
                    'guarantees' => 'Desconto salarial de até 30% da remuneração e 13º/férias.',
                    'guarantors' => 'HENRIQUE ALVES DE MEDEIROS (CPF 037.360.496-33)',
                    'validationUrl' => 'https://valida.ae/aa0b7be7ffdf7d221cc31c4fde970dc3ed7006d76c846c293',
                ]
            ],
            [
                'client' => [
                    'name' => 'LUIZ CARLOS DE ANDRADE',
                    'document' => '611.139.806-72',
                ],
                'contract' => [
                    'code' => 'MUTUO-LUIZ-2024',
                    'contractName' => 'Contrato de Mútuo - Luiz Carlos',
                    'creditor' => 'HI TRANSPORTES LTDA',
                    'contract_type_id' => 2,
                    'contractDate' => '2024-09-16',
                    'status' => 'Ativo',
                    'principalAmount' => 1000.00,
                    'financedTotal' => 1000.00,
                    'installmentCount' => 10,
                    'installmentAmount' => 137.90,
                    'firstDueDate' => '2024-09-30',
                    'moraRateMonthly' => 0.00,
                    'penaltyRate' => 0.10,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'Nenhuma',
                    'honoraryRate' => 0.00,
                    'accelerates' => true,
                    'accelerationRule' => 'Desconto permitido em lei na rescisão contratual.',
                    'guarantees' => 'Desconto em folha e verbas rescisórias / 13º e férias',
                    'guarantors' => 'HENRIQUE ALVES DE MEDEIROS (CPF 037.360.496-33)',
                    'validationUrl' => 'https://valida.ae/ec6f8741dd632b8fbf33bec82b021810b6e194e987f8ff96d',
                ]
            ],
            [
                'client' => [
                    'name' => 'WANDERSON DE PAIVA VIEIRA',
                    'document' => '036.400.076-70',
                ],
                'contract' => [
                    'code' => 'FINANC-WANDERSON-2025',
                    'contractName' => 'Financiamento de Veículo - Wanderson',
                    'creditor' => 'UnyPay® S.A',
                    'contract_type_id' => 2,
                    'contractDate' => '2025-10-17',
                    'status' => 'Ativo',
                    'principalAmount' => 40000.00,
                    'financedTotal' => 40000.00,
                    'installmentCount' => 48,
                    'installmentAmount' => 1379.48,
                    'firstDueDate' => '2025-11-05',
                    'moraRateMonthly' => 0.01,
                    'penaltyRate' => 0.02,
                    'penaltyBaseType' => 'installment',
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => 'IPCA',
                    'honoraryRate' => 0.00,
                    'accelerates' => true,
                    'accelerationRule' => 'Vencimento antecipado em caso de atraso superior a 15 dias ou fraude.',
                    'guarantees' => 'Alienação Fiduciária - Kia Sorento EX2 Placa GRS6A06',
                    'guarantors' => 'Garantia real alienada',
                    'validationUrl' => 'https://valida.ae/33f649ce149924598676087677180001906559f8abab04da4',
                ]
            ]
        ];

        foreach ($payload as $item) {
            // 🛠️ CORREÇÃO INTERNA: Ajustado para usar createdAt e updatedAt no padrão CamelCase do banco
            DB::table('clients')->updateOrInsert(
                ['document' => $item['client']['document']],
                [
                    'name' => $item['client']['name'],
                    'createdAt' => now(),
                    'updatedAt' => now()
                ]
            );

            $clientDb = DB::table('clients')->where('document', $item['client']['document'])->first();

            DB::table('contracts')->updateOrInsert(
                ['code' => $item['contract']['code']],
                [
                    'clientId' => $clientDb->id,
                    'contractName' => $item['contract']['contractName'],
                    'creditor' => $item['contract']['creditor'],
                    'contract_type_id' => $item['contract']['contract_type_id'],
                    'contractDate' => $item['contract']['contractDate'],
                    'status' => $item['contract']['status'],
                    'principalAmount' => $item['contract']['principalAmount'],
                    'financedTotal' => $item['contract']['financedTotal'],
                    'installmentCount' => $item['contract']['installmentCount'],
                    'installmentAmount' => $item['contract']['installmentAmount'],
                    'firstDueDate' => $item['contract']['firstDueDate'],
                    'monthlyInterestRate' => 0.0338, 
                    'moraRateMonthly' => $item['contract']['moraRateMonthly'],
                    'penaltyRate' => $item['contract']['penaltyRate'],
                    'penaltyBaseType' => $item['contract']['penaltyBaseType'],
                    'penaltyScope' => $item['contract']['penaltyScope'],
                    'correctionIndex' => $item['contract']['correctionIndex'],
                    'honoraryRate' => $item['contract']['honoraryRate'],
                    'accelerates' => $item['contract']['accelerates'],
                    'accelerationRule' => $item['contract']['accelerationRule'],
                    'accelerationConsecutiveThreshold' => $item['contract']['accelerationConsecutiveThreshold'] ?? null,
                    'guarantees' => $item['contract']['guarantees'],
                    'guarantors' => $item['contract']['guarantors'],
                    'validationUrl' => $item['contract']['validationUrl'],
                    'observations' => 'Carga de auditoria automatizada via Seeder.',
                    'createdAt' => now(), // Mapeado no padrão correto
                    'updatedAt' => now()  // Mapeado no padrão correto
                ]
            );
        }
    }
}