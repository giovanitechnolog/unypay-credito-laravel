<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LoadExternalContractsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 🛠️ 1. Garante a criação dos tipos de contratos usando o padrão correto de cada tabela
        $tipoInternoId = DB::table('contract_types')->where('name', 'Mútuo / Empréstimo Interno')->value('id');
        if (!$tipoInternoId) {
            $tipoInternoId = DB::table('contract_types')->insertGetId([
                'name' => 'Mútuo / Empréstimo Interno',
                'created_at' => now(), 
                'updated_at' => now()  
            ]);
        }

        $tipoExternoId = DB::table('contract_types')->where('name', 'Empréstimo Externo')->value('id');
        if (!$tipoExternoId) {
            $tipoExternoId = DB::table('contract_types')->insertGetId([
                'name' => 'Empréstimo Externo',
                'created_at' => now(), 
                'updated_at' => now()  
            ]);
        }

        // 📊 2. Payload Unificado: 14 Ativos Únicos da Auditoria de Crédito
        $payload = [
            // --- GRUPO: CONSIGNADOS / MERCADO (UNYPAY S.A.) ---
            [
                'client' => ['name' => 'IAMAR RUFINO DE OLIVEIRA', 'document' => '486.349.131-04'],
                'contract' => [
                    'code' => 'CONSIGNADO-IAMAR-2026', 'contractName' => 'Contrato de Crédito Consignado - Iamar',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2026-01-12',
                    'status' => 'Ativo', 'principalAmount' => 6000.00, 'financedTotal' => 6000.00,
                    'installmentCount' => 10, 'installmentAmount' => 834.76, 'firstDueDate' => '2026-01-31',
                    'moraRateMonthly' => 0.01, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IGP-M', 'guarantees' => 'Margem consignável e verbas rescisórias',
                    'guarantors' => 'HENRIQUE ALVES DE MEDEIROS', 'validationUrl' => 'https://valida.ae/c36b226985bae968c0f8fd9e411277b1421b9170a9c82857a?sv'
                ]
            ],
            [
                'client' => ['name' => 'JOSE LUIS FERNANDEZ CARTAYA', 'document' => '708.670.242-08'],
                'contract' => [
                    'code' => 'CONSIGNADO-JOSE-2026', 'contractName' => 'Contrato de Crédito Consignado - Jose Luis',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2026-02-26',
                    'status' => 'Ativo', 'principalAmount' => 3500.00, 'financedTotal' => 3500.00,
                    'installmentCount' => 12, 'installmentAmount' => 424.13, 'firstDueDate' => '2026-02-28',
                    'moraRateMonthly' => 0.01, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IGP-M', 'guarantees' => 'Desconto em folha e rescisórias',
                    'guarantors' => 'Sem fiador listado', 'validationUrl' => 'https://valida.ae/11fdb57044e43e669445e2cb969ea2f919054ba64232705f9?sv'
                ]
            ],
            [
                'client' => ['name' => 'LUCAS ALVES DE ALMEIDA', 'document' => '020.422.021-18'],
                'contract' => [
                    'code' => 'CONSIGNADO-LUCAS-2026', 'contractName' => 'Contrato de Crédito Consignado - Lucas Alves',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2026-03-11',
                    'status' => 'Ativo', 'principalAmount' => 4000.00, 'financedTotal' => 5296.80,
                    'installmentCount' => 12, 'installmentAmount' => 496.17, 'firstDueDate' => '2026-05-31',
                    'moraRateMonthly' => 0.01, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IGP-M', 'guarantees' => 'Desconto em folha e verbas rescisórias',
                    'guarantors' => 'Sem fiador formalizado', 'validationUrl' => 'https://valida.ae/ea5f585602bc39d74174a2297c7879bd31335e34e19356993?sv'
                ]
            ],
            [
                'client' => ['name' => 'LEONARDO DE SOUSA MIRANDA', 'document' => '041.420.031-43'],
                'contract' => [
                    'code' => 'CONSIGNADO-LEONARDO-2026', 'contractName' => 'Contrato de Crédito Consignado - Leonardo',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2026-05-11',
                    'status' => 'Ativo', 'principalAmount' => 3500.00, 'financedTotal' => 3500.00,
                    'installmentCount' => 6, 'installmentAmount' => 711.30, 'firstDueDate' => '2026-05-31',
                    'moraRateMonthly' => 0.01, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IGP-M', 'guarantees' => 'Desconto em folha / rescisório',
                    'guarantors' => 'Sem fiador', 'validationUrl' => 'https://valida.ae/5863af6991a869c81b7897ec8910ef8f9b80599bae97e9a78'
                ]
            ],
            [
                'client' => ['name' => 'EVERTON FERREIRA RODRIGUES', 'document' => '114.778.776-06'],
                'contract' => [
                    'code' => 'CONSIGNADO-EVERTON-2026', 'contractName' => 'Contrato de Crédito Consignado - Everton',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2026-05-18',
                    'status' => 'Ativo', 'principalAmount' => 3000.00, 'financedTotal' => 3000.00,
                    'installmentCount' => 10, 'installmentAmount' => 414.17, 'firstDueDate' => '2026-05-31',
                    'moraRateMonthly' => 0.01, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IGP-M', 'guarantees' => 'Desconto em folha de pagamento e verbas rescisórias',
                    'guarantors' => 'Sem fiador formalizado', 'validationUrl' => 'https://valida.ae/91e54924f42bec4cb79617e7766faa7c9b301a3a9a280bc87'
                ]
            ],

            // --- GRUPO: INTERNOS COM AVALISTA (HI TRANSPORTES LTDA) ---
            [
                'client' => ['name' => 'PATRICK HERMES SILVA', 'document' => '079.377.316-48'],
                'contract' => [
                    'code' => 'MUTUO-PATRICK-2024', 'contractName' => 'Contrato de Mútuo - Patrick Hermes',
                    'creditor' => 'HI TRANSPORTES LTDA', 'contract_type_id' => $tipoInternoId, 'contractDate' => '2024-01-23',
                    'status' => 'Ativo', 'principalAmount' => 5000.00, 'financedTotal' => 5000.00,
                    'installmentCount' => 31, 'installmentAmount' => 464.42, 'firstDueDate' => '2024-02-28',
                    'moraRateMonthly' => 0.00, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'Nenhuma', 'guarantees' => 'Desconto em folha salarial e rescisão contratual',
                    'guarantors' => 'VIVIANE NOGUEIRA (CPF 067.734.656-56)', 'validationUrl' => 'https://valida.ae/a7820c68f7352c142cc4dbbfa806708455a60df19a4acb6be'
                ]
            ],
            [
                'client' => ['name' => 'GERSON FERREIRA BATISTA FILHO', 'document' => '043.686.846-64'],
                'contract' => [
                    'code' => 'MUTUO-GERSON-2024', 'contractName' => 'Contrato de Mútuo - Gerson Ferreira',
                    'creditor' => 'HI TRANSPORTES LTDA', 'contract_type_id' => $tipoInternoId, 'contractDate' => '2024-02-21',
                    'status' => 'Ativo', 'principalAmount' => 20000.00, 'financedTotal' => 20000.00,
                    'installmentCount' => 34, 'installmentAmount' => 998.47, 'firstDueDate' => '2024-02-29',
                    'moraRateMonthly' => 0.00, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'Nenhuma', 'guarantees' => 'Desconto salarial de até 30% da remuneração',
                    'guarantors' => 'HENRIQUE ALVES DE MEDEIROS (CPF 037.360.496-33)', 'validationUrl' => 'https://valida.ae/aa0b7be7ffdf7d221cc31c4fde970dc3ed7006d76c846c293'
                ]
            ],
            [
                'client' => ['name' => 'LUIZ CARLOS DE ANDRADE', 'document' => '611.139.806-72'],
                'contract' => [
                    'code' => 'MUTUO-LUIZ-2024', 'contractName' => 'Contrato de Mútuo - Luiz Carlos',
                    'creditor' => 'HI TRANSPORTES LTDA', 'contract_type_id' => $tipoInternoId, 'contractDate' => '2024-09-16',
                    'status' => 'Ativo', 'principalAmount' => 1000.00, 'financedTotal' => 1000.00,
                    'installmentCount' => 10, 'installmentAmount' => 137.90, 'firstDueDate' => '2024-09-30',
                    'moraRateMonthly' => 0.00, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'Nenhuma', 'guarantees' => 'Desconto em folha e verbas rescisórias',
                    'guarantors' => 'HENRIQUE ALVES DE MEDEIROS (CPF 037.360.496-33)', 'validationUrl' => 'https://valida.ae/ec6f8741dd632b8fbf33bec82b021810b6e194e987f8ff96d'
                ]
            ],
            [
                'client' => ['name' => 'WANDERSON DE PAIVA VIEIRA', 'document' => '036.400.076-70'],
                'contract' => [
                    'code' => 'FINANC-WANDERSON-2025', 'contractName' => 'Financiamento de Veículo - Wanderson',
                    'creditor' => 'UnyPay® S.A', 'contract_type_id' => $tipoInternoId, 'contractDate' => '2025-10-17',
                    'status' => 'Ativo', 'principalAmount' => 40000.00, 'financedTotal' => 40000.00,
                    'installmentCount' => 48, 'installmentAmount' => 1379.48, 'firstDueDate' => '2025-11-05',
                    'moraRateMonthly' => 0.01, 'penaltyRate' => 0.02, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IPCA', 'guarantees' => 'Alienação Fiduciária - Kia Sorento EX2 Placa GRS6A06',
                    'guarantors' => 'Garantia real alienada', 'validationUrl' => 'https://valida.ae/33f649ce149924598676087677180001906559f8abab04da4'
                ]
            ],

            // --- GRUPO: EMPRÉSTIMOS EXTERNOS EXCLUSIVOS (NOVOS DO LOTE) ---
            [
                'client' => ['name' => 'RENATA DE PAULA RODRIGUES ANDRADE', 'document' => '067.981.396-98'],
                'contract' => [
                    'code' => 'EXT-RENATA-2025', 'contractName' => 'Contrato de Mútuo - ELAV Lavanderia',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2025-03-27',
                    'status' => 'Ativo', 'principalAmount' => 40000.00, 'financedTotal' => 76157.28,
                    'installmentCount' => 36, 'installmentAmount' => 2115.48, 'firstDueDate' => '2025-04-27',
                    'moraRateMonthly' => 0.02, 'penaltyRate' => 0.02, 'penaltyBaseType' => 'installment', // 🚀 CORRIGIDO: Forçado para 'installment' para passar no ENUM do banco
                    'correctionIndex' => 'IPCA', 'guarantees' => 'Garantia fidejussória integral solidária',
                    'guarantors' => 'GUSTAVO PEREIRA COSTA ANDRADE (CPF 056.101.836-77)', 'validationUrl' => 'https://valida.ae/19de74a97d25e2543617fd572cee1ea713b32e904f805996e'
                ]
            ],
            [
                'client' => ['name' => 'ENG OLINE PROJETOS E DESENHOS TECNICOS', 'document' => '41.188.322/0001-93'],
                'contract' => [
                    'code' => 'EXT-ENGONLINE-2025', 'contractName' => 'Contrato de Mútuo - Eng Online',
                    'creditor' => 'UNYPAY® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2025-02-03',
                    'status' => 'Ativo', 'principalAmount' => 6000.00, 'financedTotal' => 88546.32,
                    'installmentCount' => 24, 'installmentAmount' => 3689.43, 'firstDueDate' => '2025-03-05',
                    'moraRateMonthly' => 0.02, 'penaltyRate' => 0.02, 'penaltyBaseType' => 'installment', // 🚀 CORRIGIDO: Forçado para 'installment' para passar no ENUM do banco
                    'correctionIndex' => 'IPCA', 'guarantees' => 'Fiança ilimitada e solidária dos sócios vinculados',
                    'guarantors' => 'LUCAS RODRIGO DE ALMEIDA SOUZA / MARIA PAULA MESQUITA RODARTE', 'validationUrl' => 'https://valida.ae/46b2f4d53ff214cf7035003922b4cc198d049c727000063e9'
                ]
            ],
            [
                'client' => ['name' => 'UBIRAJARA TADEU DA FONSECA', 'document' => '156.459.406-87'],
                'contract' => [
                    'code' => 'EXT-UBIRAJARA-2024', 'contractName' => 'Confissão de Dívida e Novação - Ubirajara',
                    'creditor' => 'UNYPAY S.A', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2024-09-20',
                    'status' => 'Ativo', 'principalAmount' => 3000.00, 'financedTotal' => 11264.88,
                    'installmentCount' => 24, 'installmentAmount' => 469.37, 'firstDueDate' => '2024-10-20',
                    'moraRateMonthly' => 0.02, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IPCA', 'guarantees' => 'Garantia pessoal e novação de saldo remanescente',
                    'guarantors' => 'Contrato assinado sob testemunhas', 'validationUrl' => 'https://valida.ae/75f14619d01c63bcc9bebb17bcac5a772d40789b686be7972'
                ]
            ],
            [
                'client' => ['name' => 'JOYCIMARA PRISCILA GODINHO', 'document' => '046.574.796-52'],
                'contract' => [
                    'code' => 'EXT-JOYCIMARA-L1', 'contractName' => 'Contrato de Mútuo - Joycimara L1',
                    'creditor' => 'UNYPAY® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2024-11-11',
                    'status' => 'Ativo', 'principalAmount' => 200000.00, 'financedTotal' => 337128.72,
                    'installmentCount' => 24, 'installmentAmount' => 14047.03, 'firstDueDate' => '2025-03-11',
                    'moraRateMonthly' => 0.02, 'penaltyRate' => 0.10, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IPCA', 'guarantees' => 'Lote 01 da quadra 17 no Bairro Ouro Branco em Lavras/MG (Matrícula 40282)',
                    'guarantors' => 'JULIANO CESAR GODINHO', 'validationUrl' => 'https://valida.ae/46b2f4d53ff214cf7035003922b4cc198d049c727000063e9'
                ]
            ],
            [
                'client' => ['name' => 'CHRONOS CONTÁBIL LTDA', 'document' => '26.966.843/0001-30'],
                'contract' => [
                    'code' => 'EXT-CHRONOS-2025', 'contractName' => 'Contrato de Mútuo - Chronos Contábil',
                    'creditor' => 'UnyPay® S.A.', 'contract_type_id' => $tipoExternoId, 'contractDate' => '2025-04-07',
                    'status' => 'Ativo', 'principalAmount' => 35000.00, 'financedTotal' => 71228.64,
                    'installmentCount' => 48, 'installmentAmount' => 1483.93, 'firstDueDate' => '2025-05-07',
                    'moraRateMonthly' => 0.02, 'penaltyRate' => 0.02, 'penaltyBaseType' => 'installment',
                    'correctionIndex' => 'IPCA', 'guarantees' => 'Fiança solidária corporativa',
                    'guarantors' => 'THIAGO FERREIRA SIQUEIRA', 'validationUrl' => 'https://valida.ae/3a6e5f4bce3e8b75e0fdc447e423d60c56b5b8f92441afbf3'
                ]
            ]
        ];

        // 🔄 3. Processador Executivo de Ingestão Pura
        foreach ($payload as $item) {
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
                    'penaltyScope' => 'per_installment',
                    'correctionIndex' => $item['contract']['correctionIndex'],
                    'honoraryRate' => 0.00,
                    'accelerates' => true,
                    'accelerationRule' => 'O inadimplemento gera vencimento antecipado imediato das obrigações vincendas.',
                    'guarantees' => $item['contract']['guarantees'],
                    'guarantors' => $item['contract']['guarantors'],
                    'validationUrl' => $item['contract']['validationUrl'],
                    'observations' => 'Auditoria unificada e higienizada via Database Seeder.',
                    'createdAt' => now(), 
                    'updatedAt' => now()  
                ]
            );
        }
    }
}