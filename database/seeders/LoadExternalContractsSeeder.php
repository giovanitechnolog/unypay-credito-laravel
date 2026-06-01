<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LoadExternalContractsSeeder extends Seeder
{
    public function run(): void
    {
        // 🚀 1. Garante a criação estruturada dos modelos de contratos
        $tipoInternoId = DB::table('contract_types')->where('name', 'Mútuo / Empréstimo Interno')->value('id');
        if (!$tipoInternoId) {
            $tipoInternoId = DB::table('contract_types')->insertGetId([
                'name' => 'Mútuo / Empréstimo Interno',
                'created_at' => now(), 'updated_at' => now()  
            ]);
        }

        $tipoExternoId = DB::table('contract_types')->where('name', 'Empréstimo Externo')->value('id');
        if (!$tipoExternoId) {
            $tipoExternoId = DB::table('contract_types')->insertGetId([
                'name' => 'Empréstimo Externo',
                'created_at' => now(), 'updated_at' => now()  
            ]);
        }

        // 🔄 LIMPEZA ANTES DE ATUALIZAR (Evita duplicados)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('contracts')->whereIn('code', [
            'EXT-RENATA-2025', 'EXT-ENGONLINE-2025', 'EXT-UBIRAJARA-2024', 'EXT-CHRONOS-2025'
        ])->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $payload = [
            [
                'client' => [
                    'name' => 'RENATA DE PAULA RODRIGUES ANDRADE', 
                    'document' => '067.981.396-98',
                    'notes' => json_encode([
                        'bankAccounts' => [
                            ['banco' => '033 - Banco Santander (Brasil) S.A.', 'agencia' => '1202', 'conta' => '440122-9', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => 'renata.paula@elav.com.br']
                        ],
                        'fiador1Nome' => 'GUSTAVO PEREIRA COSTA ANDRADE', 'fiador1Cpf' => '056.101.836-77', 'fiador1Telefone' => '(31) 99201-4455', 'fiador1Endereco' => 'Rua Paraíba, 1020', 'fiador1Cidade' => 'Belo Horizonte', 'fiador1Estado' => 'MG'
                    ])
                ],
                'contract' => [
                    'code' => 'EXT-RENATA-2025', 'contractName' => 'Contrato de Mútuo - ELAV Lavanderia',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2025-03-27',
                    'status' => 'Ativo', 'principalAmount' => 40000.00, 'financedTotal' => 76157.28,
                    'installmentCount' => 36, 'installmentAmount' => 2115.48, 'firstDueDate' => '2025-04-27',
                    'moraRateMonthly' => 0.02, 'penaltyRate' => 0.02, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IPCA', 'tacAmount' => 850.00,
                    'chosenBankAccount' => '033 - Banco Santander (Brasil) S.A.-1202-440122-9',
                    'paymentMethod' => 'Boleto Bancário', 'forumLocation' => 'Belo Horizonte / MG',
                    'guarantees' => 'Garantia fidejussória integral solidária',
                    'guarantors' => '[FIADOR 1] Nome: GUSTAVO PEREIRA COSTA ANDRADE, CPF: 056.101.836-77, Tel: (31) 99201-4455, Endereço: Rua Paraíba, 1020, Belo Horizonte/MG', 
                    'validationUrl' => 'https://valida.ae/19de74a97d25e2543617fd572cee1ea713b32e904f805996e'
                ]
            ],
            [
                'client' => [
                    'name' => 'ENG OLINE PROJETOS E DESENHOS TECNICOS', 
                    'document' => '41.188.322/0001-93',
                    'notes' => json_encode([
                        'bankAccounts' => [
                            ['banco' => '001 - Banco do Brasil S.A.', 'agencia' => '4120', 'conta' => '10294-8', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '41188322000193']
                        ],
                        'fiador1Nome' => 'LUCAS RODRIGO DE ALMEIDA SOUZA', 'fiador1Cpf' => '022.441.986-10', 'fiador1Telefone' => '(35) 98822-1100', 'fiador1Endereco' => 'Av. Jamil Khouri, 44', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG',
                        'fiador2Nome' => 'MARIA PAULA MESQUITA RODARTE', 'fiador2Cpf' => '088.341.026-44', 'fiador2Telefone' => '(35) 98811-2200', 'fiador2Endereco' => 'Rua Sant\'Ana, 500', 'fiador2Cidade' => 'Lavras', 'fiador2Estado' => 'MG'
                    ])
                ],
                'contract' => [
                    'code' => 'EXT-ENGONLINE-2025', 'contractName' => 'Contrato de Mútuo - Eng Online',
                    'creditor' => 'UNYPAY® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2025-02-03',
                    'status' => 'Ativo', 'principalAmount' => 6000.00, 'financedTotal' => 88546.32,
                    'installmentCount' => 24, 'installmentAmount' => 3689.43, 'firstDueDate' => '2025-03-05',
                    'moraRateMonthly' => 0.02, 'penaltyRate' => 0.02, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IPCA', 'tacAmount' => 500.00,
                    'chosenBankAccount' => '001 - Banco do Brasil S.A.-4120-10294-8',
                    'paymentMethod' => 'PIX QrCode', 'forumLocation' => 'Lavras / MG',
                    'guarantees' => 'Fiança ilimitada e solidária dos sócios vinculados',
                    'guarantors' => '[FIADOR 1] Nome: LUCAS RODRIGO, CPF: 022.441.986-10 / [FIADOR 2] Nome: MARIA PAULA, CPF: 088.341.026-44', 
                    'validationUrl' => 'https://valida.ae/46b2f4d53ff214cf7035003922b4cc198d049c727000063e9'
                ]
            ]
        ];

        foreach ($payload as $item) {
            DB::table('clients')->updateOrInsert(
                ['document' => $item['client']['document']],
                ['name' => $item['client']['name'], 'notes' => $item['client']['notes'], 'createdAt' => now(), 'updatedAt' => now()]
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
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => $item['contract']['correctionIndex'],
                    'honoraryRate' => 0.00,
                    'tacAmount' => $item['contract']['tacAmount'],
                    'chosenBankAccount' => $item['contract']['chosenBankAccount'],
                    'paymentMethod' => $item['contract']['paymentMethod'],
                    'forumLocation' => $item['contract']['forumLocation'],
                    'accelerates' => true,
                    'accelerationRule' => 'O inadimplemento gera vencimento antecipado imediato das obrigações vincendas.',
                    'guarantees' => $item['contract']['guarantees'],
                    'guarantors' => $item['contract']['guarantors'],
                    'validationUrl' => $item['contract']['validationUrl'],
                    'observations' => 'Auditoria unificada e higienizada via Database Seeder.',
                    'createdAt' => now(), 'updatedAt' => now()  
                ]
            );
        }
    }
}