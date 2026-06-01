<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LoadContratosPendentesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 🧼 ETAPA 1: HIGIENIZAÇÃO INDIVIDUAL DOS ATIVOS DESTE LOTE (Evita duplicidade)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('contracts')->whereIn('code', [
            'CONSIGNADO-LUCAS-2026', 'CONSIGNADO-PATRICK-NEW', 
            'EXT-CHRONOS-2025-V2', 'EXT-ENGONLINE-MÚTUO', 'CONFISSAO-RENATA-TRUCK'
        ])->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 📊 Captura dinâmica dos IDs dos tipos de contratos do banco
        $tipoConsignadoId = DB::table('contract_types')->where('slug', 'consignado')->value('id') ?? 1;
        $tipoMutuoId      = DB::table('contract_types')->where('slug', 'mutuo')->value('id') ?? 4;
        $tipoConfissaoId  = DB::table('contract_types')->where('slug', 'confissao_de_divida')->value('id') ?? 2;

        // 👥 ETAPA 2: CADASTRO COMPLETO DOS CLIENTES NOVOS (E atualização de contas para os existentes)
        
        // 1. Lucas Alves de Almeida (Novo)
        DB::table('clients')->updateOrInsert(
            ['document' => '020.422.021-18'],
            [
                'name' => 'LUCAS ALVES DE ALMEIDA', // 
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '4676', 'conta' => '31159-2', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '02042202118'] // 
                    ]
                ]),
                'createdAt' => now(), 'updatedAt' => now()
            ]
        );

        // 2. Eng Online Projetos (Novo)
        DB::table('clients')->updateOrInsert(
            ['document' => '41.188.322/0001-93'],
            [
                'name' => 'ENG OLINE PROJETOS E DESENHOS TECNICOS', // 
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '7422', 'conta' => '99874-5', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '41188322000193'] // 
                    ]
                ]),
                'createdAt' => now(), 'updatedAt' => now()
            ]
        );

        // Dicionário de IDs de clientes atualizados pós-ingestão
        $clientMap = [
            'LUCAS'    => DB::table('clients')->where('document', '020.422.021-18')->value('id'),
            'PATRICK'  => DB::table('clients')->where('document', '079.377.316-48')->value('id'),
            'CHRONOS'  => DB::table('clients')->where('document', '26.966.843/0001-30')->value('id'),
            'ENG_ON'   => DB::table('clients')->where('document', '41.188.322/0001-93')->value('id'),
            'RENATA'   => DB::table('clients')->where('document', '067.981.396-98')->value('id'),
        ];

        // 📊 ETAPA 3: INGESTÃO JURÍDICA E FINANCEIRA DOS ATIVOS DO LOTE
        $contratosPendentes = [
            // 1. Lucas Alves de Almeida - Consignado 
            [
                'clientId'          => $clientMap['LUCAS'],
                'contract_type_id'  => $tipoConsignadoId,
                'code'              => 'CONSIGNADO-LUCAS-2026',
                'contractName'      => 'Contrato de Crédito Consignado - Lucas Alves', // 
                'creditor'          => 'UnyPay® S.A.', // 
                'contractDate'      => '2026-03-11', // 
                'status'            => 'Ativo', // 
                'principalAmount'   => 4000.00, // 
                'financedTotal'     => 4000.00, // 
                'installmentAmount' => 496.17, // 
                'installmentCount'  => 12, // 
                'firstDueDate'      => '2026-05-31', // 
                'moraRateMonthly'   => 0.01, // 
                'penaltyRate'       => 0.10, // 
                'correctionIndex'   => 'IGP-M', // 
                'tacAmount'         => 200.00, // 👈 TAC Estimada de Consignados UnyPay
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-4676-31159-2', // 
                'paymentMethod'     => 'Boleto Bancário', // 
                'forumLocation'     => 'Belo Horizonte / MG', // 
                'guarantees'        => 'Desconto em folha e verbas rescisórias', // 
                'guarantors'        => 'Sem fiador formalizado', // 
                'url'               => 'Contrato de Empréstimo nº - LUCAS ALVES DE ALMEIDA   UnyPay [assinado].pdf',
            ],
            // 2. Patrick Hermes Silva - Segundo Contrato (Consignado) 
            [
                'clientId'          => $clientMap['PATRICK'],
                'contract_type_id'  => $tipoConsignadoId,
                'code'              => 'CONSIGNADO-PATRICK-NEW',
                'contractName'      => 'Contrato de Crédito Consignado - Patrick [2º Contrato]', // 
                'creditor'          => 'UnyPay® S.A.', // 
                'contractDate'      => '2026-02-26', // 
                'status'            => 'Ativo', // 
                'principalAmount'   => 3500.00, // 
                'financedTotal'     => 3500.00, // 
                'installmentAmount' => 437.95, // 
                'installmentCount'  => 12, // 
                'firstDueDate'      => '2026-02-28', // 
                'moraRateMonthly'   => 0.01, // 
                'penaltyRate'       => 0.10, // 
                'correctionIndex'   => 'IGP-M', // 
                'tacAmount'         => 350.00, // 👈 TAC padrão da esteira de consignados
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1463-41497-7', // 
                'paymentMethod'     => 'Boleto Bancário', // 
                'forumLocation'     => 'Belo Horizonte / MG', // 
                'guarantees'        => 'Margem de desconto consignável e verbas de rescisão', // 
                'guarantors'        => 'HENRIQUE ALVES DE MEDEIROS (CPF 037.360.496-33)', // 
                'url'               => 'Contrato de Empréstimo nº - PATRICK HERMES SILVA   UnyPay  (3) [assinado].pdf',
            ],
            // 3. Chronos Contábil LTDA - Segundo Contrato (Mútuo L2) 
            [
                'clientId'          => $clientMap['CHRONOS'],
                'contract_type_id'  => $tipoMutuoId,
                'code'              => 'EXT-CHRONOS-2025-V2',
                'contractName'      => 'Contrato de Mútuo - Chronos Contábil [Linha L2]', // 
                'creditor'          => 'UnyPay® S.A.', // 
                'contractDate'      => '2025-04-07', // 
                'status'            => 'Ativo', // 
                'principalAmount'   => 35000.00, // 
                'financedTotal'     => 71228.64, // 
                'installmentAmount' => 1483.93, // 
                'installmentCount'  => 48, // 
                'firstDueDate'      => '2025-05-07', // 
                'moraRateMonthly'   => 0.02, // 
                'penaltyRate'       => 0.02, // 
                'correctionIndex'   => 'IPCA', // 
                'tacAmount'         => 350.00, // 
                'chosenBankAccount' => '077 - Banco Inter S.A.-0001-26966843000130', // 
                'paymentMethod'     => 'PIX QrCode', // 
                'forumLocation'     => 'Lavras / MG', // 
                'guarantees'        => 'Fiança solidária corporativa e aval dos sócios', // 
                'guarantors'        => 'THIAGO FERREIRA SIQUEIRA (CPF 379.794.978-21)', // 
                'url'               => 'Contrato Empréstimo Chronos Contábil [assinado] 2.pdf',
            ],
            // 4. Eng Online Projetos - Mútuo R$ 60.000,00 
            [
                'clientId'          => $clientMap['ENG_ON'],
                'contract_type_id'  => $tipoMutuoId,
                'code'              => 'EXT-ENGONLINE-MÚTUO',
                'contractName'      => 'Contrato de Mútuo Comercial - Eng Online', // 
                'creditor'          => 'UNYPAY® S.A.', // 
                'contractDate'      => '2025-02-03', // 
                'status'            => 'Ativo', // 
                'principalAmount'   => 60000.00, // 
                'financedTotal'     => 88546.32, // 
                'installmentAmount' => 3689.43, // 
                'installmentCount'  => 24, // 
                'firstDueDate'      => '2025-03-05', // 
                'moraRateMonthly'   => 0.02, // 
                'penaltyRate'       => 0.02, // 
                'correctionIndex'   => 'IPCA', // 
                'tacAmount'         => 600.00, // 
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-7422-99874-5', // 
                'paymentMethod'     => 'Boleto Bancário', // 
                'forumLocation'     => 'Lavras / MG', // 
                'guarantees'        => 'Fiança ilimitada e solidária dos sócios vinculados', // 
                'guarantors'        => 'LUCAS RODRIGO DE ALMEIDA SOUZA / MARIA PAULA MESQUITA', // 
                'url'               => 'Contrato Empréstimo Eng Online - Lucas [assinado].pdf',
            ],
            // 5. Renata de Paula Rodrigues - Confissão de Dívida Technolog 
            [
                'clientId'          => $clientMap['RENATA'],
                'contract_type_id'  => $tipoConfissaoId,
                'code'              => 'CONFISSAO-RENATA-TRUCK',
                'contractName'      => 'Instrumento Particular de Confissão de Dívida - Renata', // 
                'creditor'          => 'TECHNOLOG TRUCK SERVIÇOS LTDA', // 
                'contractDate'      => '2024-05-28', // 
                'status'            => 'Ativo', // 
                'principalAmount'   => 35000.00, // 
                'financedTotal'     => 65303.60, // 
                'installmentAmount' => 1800.10, // 
                'installmentCount'  => 36, // 
                'firstDueDate'      => '2024-06-27', // 
                'moraRateMonthly'   => 0.02, // 
                'penaltyRate'       => 0.10, // 
                'correctionIndex'   => 'IGP-M', // 
                'tacAmount'         => 500.00, // 
                'chosenBankAccount' => '237 - Bradesco-1890-39.515-3', // 
                'paymentMethod'     => 'Boleto Bancário', // 
                'forumLocation'     => 'Lavras / MG', // 
                'guarantees'        => 'Desconto em acertos de saldos de fretes de subcontratações', // 
                'guarantors'        => 'RENATA DE PAULA RODRIGUES / GUSTAVO PEREIRA COSTA ANDRADE', // 
                'url'               => 'Contrato Technolog Truck x Renata [assinado].pdf',
            ]
        ];

        // Executa a ingestão final blindada no MySQL
        foreach ($contratosPendentes as $data) {
            DB::table('contracts')->insert([
                'clientId'            => $data['clientId'],
                'contract_type_id'    => $data['contract_type_id'],
                'code'                => $data['code'],
                'contractName'        => $data['contractName'],
                'creditor'            => $data['creditor'],
                'contractDate'        => $data['contractDate'],
                'status'              => $data['status'],
                'principalAmount'     => $data['principalAmount'],
                'financedTotal'       => $data['financedTotal'],
                'installmentAmount'   => $data['installmentAmount'],
                'installmentCount'    => $data['installmentCount'],
                'firstDueDate'        => $data['firstDueDate'],
                'monthlyInterestRate' => 0.0338,
                'moraRateMonthly'     => $data['moraRateMonthly'],
                'penaltyRate'         => $data['penaltyRate'],
                'penaltyBaseType'     => $data['penaltyBaseType'] ?? 'installment',
                'correctionIndex'     => $data['correctionIndex'],
                'tacAmount'           => $data['tacAmount'],
                'chosenBankAccount'   => $data['chosenBankAccount'],
                'paymentMethod'       => $data['paymentMethod'],
                'forumLocation'       => $data['forumLocation'],
                'guarantees'          => $data['guarantees'],
                'guarantors'          => $data['guarantors'],
                'validationUrl'       => $data['url'],
                'observations'        => 'Carga incremental de ativos pendentes via Seeder de Auditoria.',
                'createdAt'           => now(),
                'updatedAt'           => now()
            ]);
        }
    }
}