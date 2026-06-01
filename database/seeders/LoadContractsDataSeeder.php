<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class LoadContractsDataSeeder extends Seeder
{
    public function run(): void
    {
        // 🔄 LIMPEZA DA BASE ANTES DA REINJEÇÃO (Reset de Legado)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('contracts')->whereIn('code', [
            'CONSIGNADO-IAMAR-2026', 'CONSIGNADO-JOSE-2026', 'CONSIGNADO-LUCAS-2026', 
            'CONSIGNADO-LEONARDO-2026', 'CONSIGNADO-EVERTON-2026', 'MUTUO-PATRICK-2024', 
            'MUTUO-GERSON-2024', 'MUTUO-LUIZ-2024', 'FINANC-WANDERSON-2025'
        ])->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $payload = [
            [
                'client' => [
                    'name' => 'IAMAR RUFINO DE OLIVEIRA',
                    'document' => '486.349.131-04',
                    'notes' => json_encode([
                        'bankAccounts' => [
                            ['banco' => '001 - Banco do Brasil S.A.', 'agencia' => '0142-2', 'conta' => '44120-5', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '48634913104'],
                            ['banco' => '260 - Nu Pagamentos S.A.', 'agencia' => '0001', 'conta' => '992145-8', 'tipo' => 'Digital', 'hasPix' => false, 'pixKey' => '']
                        ],
                        'fiador1Nome' => 'HENRIQUE ALVES DE MEDEIROS', 'fiador1Cpf' => '037.360.496-33', 'fiador1Telefone' => '(35) 99841-2233', 'fiador1Endereco' => 'Av. das Cidades, 450', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG',
                        'fiador2Nome' => '', 'fiador2Cpf' => '', 'fiador2Telefone' => '', 'fiador2Endereco' => '', 'fiador2Cidade' => '', 'fiador2Estado' => ''
                    ])
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
                    'tacAmount' => 250.00, // 👈 Injeção da TAC de Estruturação
                    'chosenBankAccount' => '001 - Banco do Brasil S.A.-0142-2-44120-5',
                    'paymentMethod' => 'Boleto Bancário',
                    'forumLocation' => 'Lavras / MG',
                    'accelerates' => true,
                    'accelerationRule' => 'A dívida vencerá antecipadamente na infringência de cláusulas contratuais ou rescisão do contrato de trabalho.',
                    'accelerationConsecutiveThreshold' => 1,
                    'guarantees' => 'Margem consignável e verbas rescisórias/férias/13º',
                    'guarantors' => '[FIADOR 1] Nome: HENRIQUE ALVES DE MEDEIROS, CPF: 037.360.496-33, Tel: (35) 99841-2233, Endereço: Av. das Cidades, 450, Lavras/MG',
                    'validationUrl' => 'https://valida.ae/c36b226985bae968c0f8fd9e411277b1421b9170a9c82857a?sv',
                ]
            ],
            [
                'client' => [
                    'name' => 'JOSE LUIS FERNANDEZ CARTAYA',
                    'document' => '708.670.242-08',
                    'notes' => json_encode([
                        'bankAccounts' => [
                            ['banco' => '104 - Caixa Econômica Federal', 'agencia' => '0045', 'conta' => '123844-0', 'tipo' => 'Poupança', 'hasPix' => true, 'pixKey' => '70867024208']
                        ],
                        'fiador1Nome' => 'MARIA HELENA CARTAYA', 'fiador1Cpf' => '112.445.889-11', 'fiador1Telefone' => '(31) 98877-6655', 'fiador1Endereco' => 'Rua dos Engenheiros, 12', 'fiador1Cidade' => 'Belo Horizonte', 'fiador1Estado' => 'MG'
                    ])
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
                    'tacAmount' => 150.00,
                    'chosenBankAccount' => '104 - Caixa Econômica Federal-0045-123844-0',
                    'paymentMethod' => 'Boleto Bancário',
                    'forumLocation' => 'Belo Horizonte / MG',
                    'accelerates' => true,
                    'accelerationRule' => 'A dívida vencerá antecipadamente na infringência de cláusulas contratuais ou rescisão do contrato de trabalho.',
                    'accelerationConsecutiveThreshold' => 1,
                    'guarantees' => 'Desconto em folha e verbas rescisórias',
                    'guarantors' => '[FIADOR 1] Nome: MARIA HELENA CARTAYA, CPF: 112.445.889-11, Tel: (31) 98877-6655, Endereço: Rua dos Engenheiros, 12, Belo Horizonte/MG',
                    'validationUrl' => 'https://valida.ae/11fdb57044e43e669445e2cb969ea2f919054ba64232705f9?sv',
                ]
            ],
            [
                'client' => [
                    'name' => 'LUCAS ALVES DE ALMEIDA',
                    'document' => '020.422.021-18',
                    'notes' => json_encode([
                        'bankAccounts' => [
                            ['banco' => '341 - Itaú Unibanco S.A.', 'agencia' => '2934', 'conta' => '11520-4', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => 'lucas.alves@gmail.com']
                        ]
                    ])
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
                    'tacAmount' => 200.00,
                    'chosenBankAccount' => '341 - Itaú Unibanco S.A.-2934-11520-4',
                    'paymentMethod' => 'Boleto Bancário',
                    'forumLocation' => 'Lavras / MG',
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
                    'name' => 'PATRICK HERMES SILVA',
                    'document' => '079.377.316-48',
                    'notes' => json_encode([
                        'bankAccounts' => [
                            ['banco' => '033 - Banco Santander (Brasil) S.A.', 'agencia' => '3301', 'conta' => '60554-1', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '07937731648']
                        ],
                        'fiador1Nome' => 'VIVIANE NOGUEIRA', 'fiador1Cpf' => '067.734.656-56', 'fiador1Telefone' => '(35) 98455-1122', 'fiador1Endereco' => 'Rua das Flores, 90', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                    ])
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
                    'correctionIndex' => 'PRE',
                    'honoraryRate' => 0.00,
                    'tacAmount' => 0.00,
                    'chosenBankAccount' => '033 - Banco Santander (Brasil) S.A.-3301-60554-1',
                    'paymentMethod' => 'TED / DOC',
                    'forumLocation' => 'Lavras / MG',
                    'accelerates' => true,
                    'accelerationRule' => 'Em caso de rescisão, o saldo remanescente deve ser pago em até 30 dias sob multa de 10%.',
                    'guarantees' => 'Desconto em folha salarial e rescisão de contrato de trabalho',
                    'guarantors' => '[FIADOR 1] Nome: VIVIANE NOGUEIRA, CPF: 067.734.656-56, Tel: (35) 98455-1122, Endereço: Rua das Flores, 90, Lavras/MG',
                    'validationUrl' => 'https://valida.ae/a7820c68f7352c142cc4dbbfa806708455a60df19a4acb6be',
                ]
            ],
            [
                'client' => [
                    'name' => 'WANDERSON DE PAIVA VIEIRA',
                    'document' => '036.400.076-70',
                    'notes' => json_encode([
                        'bankAccounts' => [
                            ['banco' => '077 - Banco Inter S.A.', 'agencia' => '0001', 'conta' => '441029-3', 'tipo' => 'Digital', 'hasPix' => true, 'pixKey' => 'wanderson.paiva@inter.co']
                        ]
                    ])
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
                    'tacAmount' => 1200.00,
                    'chosenBankAccount' => '077 - Banco Inter S.A.-0001-441029-3',
                    'paymentMethod' => 'PIX QrCode',
                    'forumLocation' => 'Belo Horizonte / MG',
                    'accelerates' => true,
                    'accelerationRule' => 'Vencimento antecipado em caso de atraso superior a 15 dias ou fraude.',
                    'guarantees' => 'Alienação Fiduciária - Kia Sorento EX2 Placa GRS6A06',
                    'guarantors' => 'Garantia real alienada',
                    'validationUrl' => 'https://valida.ae/33f649ce149924598676087677180001906559f8abab04da4',
                ]
            ]
        ];

        foreach ($payload as $item) {
            DB::table('clients')->updateOrInsert(
                ['document' => $item['client']['document']],
                [
                    'name' => $item['client']['name'],
                    'notes' => $item['client']['notes'] ?? null,
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
                    'tacAmount' => $item['contract']['tacAmount'],
                    'chosenBankAccount' => $item['contract']['chosenBankAccount'],
                    'paymentMethod' => $item['contract']['paymentMethod'],
                    'forumLocation' => $item['contract']['forumLocation'],
                    'accelerates' => $item['contract']['accelerates'],
                    'accelerationRule' => $item['contract']['accelerationRule'],
                    'accelerationConsecutiveThreshold' => $item['contract']['accelerationConsecutiveThreshold'] ?? null,
                    'guarantees' => $item['contract']['guarantees'],
                    'guarantors' => $item['contract']['guarantors'],
                    'validationUrl' => $item['contract']['validationUrl'],
                    'observations' => 'Carga de auditoria automatizada via Seeder enriquecido.',
                    'createdAt' => now(),
                    'updatedAt' => now()
                ]
            );
        }
    }
}