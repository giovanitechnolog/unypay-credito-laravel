<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class LoadAdicionaisAuditoriaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 🧼 LIMPEZA FOCADA APENAS NOS CONTRATOS DESTE LOTE (Evita Duplicidade sem apagar os outros)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('contracts')->whereIn('code', [
            'MUTUO-RECACENTER-ADIT', 'EXT-CHRONOS-2025', 'EXT-JOYCIMARA-L2', 
            'EXT-ENGONLINE-2025', 'EXT-UBIRAJARA-MUT', 'CONFISSAO-PW-ARCOS', 'ADITIVO-PW-CONSOLIDADO'
        ])->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 📊 Captura os IDs dos tipos de contratos para não quebrar a chave estrangeira
        $tipoMutuoId    = DB::table('contract_types')->where('name', 'Mútuo / Empréstimo')->value('id') ?? 4;
        $tipoAditivoId  = DB::table('contract_types')->where('name', 'Aditivo DIP')->value('id') ?? 3;
        $tipoConfissaoId = DB::table('contract_types')->where('name', 'Confissão de Dívida')->value('id') ?? 2;

        // 👥 1. CADASTRO DE CLIENTES COM METADADOS COMPLEXOS (Múltiplas Contas + Fiadores em JSON)
        $clientesLote = [
            [
                'name' => 'P&W ARCOS TRANSPORTES LTDA', 'document' => '08.183.084/0001-58',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '1604', 'conta' => '08183084000158', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '08183084000158']
                    ],
                    'fiador1Nome' => 'ROBERTO CARLOS CARDOSO', 'fiador1Cpf' => '547.157.176-20', 'fiador1Telefone' => '(37) 99845-2211', 'fiador1Endereco' => 'Rod. BR 354, KM 476', 'fiador1Cidade' => 'Arcos', 'fiador1Estado' => 'MG',
                    'fiador2Nome' => 'CAMILLA TERENCIA PASSOS SOUZA', 'fiador2Cpf' => '047.601.256-20', 'fiador2Telefone' => '(37) 99122-3344', 'fiador2Endereco' => 'Vila Calcita', 'fiador2Cidade' => 'Arcos', 'fiador2Estado' => 'MG'
                ])
            ],
            [
                'name' => 'TRANS START COMERCIO E TRANSPORTES LTDA', 'document' => '24.682.082/0001-60',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '001 - Banco do Brasil S.A.', 'agencia' => '4120', 'conta' => '24682082000160', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => 'nfe@pwtransportes.com.br']
                    ]
                ])
            ]
        ];

        // Cadastra os clientes novos e mapeia os IDs de todos os envolvidos neste lote
        foreach ($clientesLote as $c) {
            DB::table('clients')->updateOrInsert(
                ['document' => $c['document']],
                ['name' => $c['name'], 'notes' => $c['notes'], 'createdAt' => now(), 'updatedAt' => now()]
            );
        }

        // Dicionário de IDs de clientes necessários para amarrar os contratos
        $clientMap = [
            'RECACENTER RECAPAGEM DE PNEUS LTDA ME' => DB::table('clients')->where('document', '03.494.479/0001-58')->value('id'),
            'BELOSANTA TRANSPORTES E SERVICOS LTDA' => DB::table('clients')->where('document', '65.306.953/0001-28')->value('id'),
            'ENG OLINE PROJETOS E DESENHOS TECNICOS' => DB::table('clients')->where('document', '41.188.322/0001-93')->value('id'),
            'CHRONOS CONTÁBIL LTDA'                 => DB::table('clients')->where('document', '26.966.843/0001-30')->value('id'),
            'JOYCIMARA PRISCILA GODINHO'            => DB::table('clients')->where('document', '046.574.796-52')->value('id'),
            'UBIRAJARA TADEU DA FONSECA'            => DB::table('clients')->where('document', '156.459.406-87')->value('id'),
            'P&W ARCOS TRANSPORTES LTDA'            => DB::table('clients')->where('document', '08.183.084/0001-58')->value('id'),
        ];

        // 📊 2. ESTRUTURAÇÃO DOS CONTRATOS ADICIONAIS FALTANTES
        $contratosAdicionais = [
            [
                'clientId'          => $clientMap['RECACENTER RECAPAGEM DE PNEUS LTDA ME'],
                'contract_type_id'  => $tipoAditivoId,
                'code'              => 'MUTUO-RECACENTER-ADIT',
                'contractName'      => '2º Termo Aditivo de Mútuo - Recacenter [Aditivo]',
                'creditor'          => 'TECHNOLOG DESENVOLVIMENTO DE SERVIÇOS LTDA.',
                'contractDate'      => '2025-05-20',
                'status'            => 'Ativo',
                'principalAmount'   => 50000.00,
                'financedTotal'     => 50000.00,
                'installmentAmount' => 2450.00,
                'installmentCount'  => 24,
                'firstDueDate'      => '2025-06-20',
                'monthlyInterestRate'=> 0.0300,
                'moraRateMonthly'   => 0.02,
                'penaltyRate'       => 0.10,
                'penaltyBaseType'   => 'installment',
                'correctionIndex'   => 'IPCA',
                'tacAmount'         => 600.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1604-03494479000158',
                'paymentMethod'     => 'Boleto Bancário',
                'forumLocation'     => 'Lavras / MG',
                'guarantees'        => 'L&L Empreendimentos e Participações LTDA interveniente garantidora',
                'guarantors'        => 'LOURENÇO GOMES ALVES / MARYNA APARECIDA LOPES',
                'url'               => '2ª Aditivo Contrato Recacenter PDF [assinado].pdf',
            ],
            [
                'clientId'          => $clientMap['BELOSANTA TRANSPORTES E SERVICOS LTDA'],
                'contract_type_id'  => $tipoAditivoId,
                'code'              => 'BeloSanta-Aditivo-DIP',
                'contractName'      => 'Primeiro Aditivo de Mútuo - BeloSanta [Financiamento DIP]',
                'creditor'          => 'UnyPay® S.A.',
                'contractDate'      => '2025-06-15',
                'status'            => 'Inadimplente',
                'principalAmount'   => 150000.00,
                'financedTotal'     => 150000.00,
                'installmentAmount' => 6250.00,
                'installmentCount'  => 24,
                'firstDueDate'      => '2025-07-15',
                'monthlyInterestRate'=> 0.0338,
                'moraRateMonthly'   => 0.02,
                'penaltyRate'       => 0.10,
                'penaltyBaseType'   => 'installment',
                'correctionIndex'   => 'IPCA',
                'tacAmount'         => 1500.00,
                'chosenBankAccount' => '001 - Banco do Brasil S.A.-1604-7-12045-9',
                'paymentMethod'     => 'Boleto Bancário',
                'forumLocation'     => 'Lavras / MG',
                'guarantees'        => 'Fiança DIP com superprioridade de recebimento judicial',
                'guarantors'        => 'Thiago Henrique de Paula / Camilli Guimarães Carneiro',
                'url'               => 'Aditivo ao Contrato de Mútuo UnyPay  - BeloSanta [assinado] (1).pdf',
            ],
            [
                'clientId'          => $clientMap['CHRONOS CONTÁBIL LTDA'],
                'contract_type_id'  => $tipoMutuoId,
                'code'              => 'EXT-CHRONOS-L1',
                'contractName'      => 'Contrato de Mútuo - Chronos Contábil L1',
                'creditor'          => 'UnyPay® S.A.',
                'contractDate'      => '2024-12-06',
                'status'            => 'Ativo',
                'principalAmount'   => 25000.00,
                'financedTotal'     => 48200.00,
                'installmentAmount' => 1004.16,
                'installmentCount'  => 48,
                'firstDueDate'      => '2025-01-06',
                'monthlyInterestRate'=> 0.0338,
                'moraRateMonthly'   => 0.02,
                'penaltyRate'       => 0.02,
                'penaltyBaseType'   => 'installment',
                'correctionIndex'   => 'IPCA',
                'tacAmount'         => 350.00,
                'chosenBankAccount' => '077 - Banco Inter S.A.-0001-26966843000130',
                'paymentMethod'     => 'PIX QrCode',
                'forumLocation'     => 'Lavras / MG',
                'guarantees'        => 'Aval e responsabilidade patrimonial dos sócios cotistas',
                'guarantors'        => 'THIAGO FERREIRA SIQUEIRA',
                'url'               => 'Contrato Empréstimo Chronos Contábil [assinado] (1).pdf',
            ],
            [
                'clientId'          => $clientMap['JOYCIMARA PRISCILA GODINHO'],
                'contract_type_id'  => $tipoMutuoId,
                'code'              => 'EXT-JOYCIMARA-L2',
                'contractName'      => 'Joycimara/Juliano2 - Mútuo Complementar',
                'creditor'          => 'UnyPay® S.A.',
                'contractDate'      => '2024-11-20',
                'status'            => 'Inadimplente',
                'principalAmount'   => 50000.00,
                'financedTotal'     => 84120.00,
                'installmentAmount' => 3505.00,
                'installmentCount'  => 24,
                'firstDueDate'      => '2025-03-20',
                'monthlyInterestRate'=> 0.0338,
                'moraRateMonthly'   => 0.02,
                'penaltyRate'       => 0.02,
                'penaltyBaseType'   => 'installment',
                'correctionIndex'   => 'IPCA',
                'tacAmount'         => 500.00,
                'chosenBankAccount' => '336 - Banco C6 S.A-0001-23171367-3',
                'paymentMethod'     => 'PIX QrCode',
                'forumLocation'     => 'Lavras / MG',
                'guarantees'        => 'Fiança solidária acoplada e aval dos bens construídos',
                'guarantors'        => 'JULIANO CESAR GODINHO',
                'url'               => 'Contrato Empréstimo Joycecimara -Juliano [assinado]2.pdf',
            ],
            [
                'clientId'          => $clientMap['UBIRAJARA TADEU DA FONSECA'],
                'contract_type_id'  => $tipoMutuoId,
                'code'              => 'EXT-UBIRAJARA-MUT',
                'contractName'      => 'Contrato de Mútuo Operacional - Ubirajara',
                'creditor'          => 'UnyPay® S.A.',
                'contractDate'      => '2024-12-12',
                'status'            => 'Inadimplente',
                'principalAmount'   => 4000.00,
                'financedTotal'     => 4000.00,
                'installmentAmount' => 4000.00,
                'installmentCount'  => 1,
                'firstDueDate'      => '2025-01-12',
                'monthlyInterestRate'=> 0.0338,
                'moraRateMonthly'   => 0.02,
                'penaltyRate'       => 0.10,
                'penaltyBaseType'   => 'installment',
                'correctionIndex'   => 'IPCA',
                'tacAmount'         => 0.00,
                'chosenBankAccount' => '001 - Banco do Brasil S.A.-0020-15645940687',
                'paymentMethod'     => 'Boleto Bancário',
                'forumLocation'     => 'Lavras / MG',
                'guarantees'        => 'Vinculação de recebíveis futuros da administração',
                'guarantors'        => 'Sem fiador',
                'url'               => 'Contrato Empréstimo Ubirajara [assinado] (1).pdf',
            ],
            [
                'clientId'          => $clientMap['P&W ARCOS TRANSPORTES LTDA'],
                'contract_type_id'  => $tipoConfissaoId,
                'code'              => 'CONFISSAO-PW-ARCOS',
                'contractName'      => 'Instrumento Particular de Confissão de Dívida - P&W Arcos',
                'creditor'          => 'TECHNOLOG TRUCK SERVIÇOS LTDA.',
                'contractDate'      => '2025-03-09',
                'status'            => 'Inadimplente',
                'principalAmount'   => 380450.00,
                'financedTotal'     => 380450.00,
                'installmentAmount' => 15852.08,
                'installmentCount'  => 24,
                'firstDueDate'      => '2025-04-10',
                'monthlyInterestRate'=> 0.0300,
                'moraRateMonthly'   => 0.02,
                'penaltyRate'       => 0.10,
                'penaltyBaseType'   => 'installment',
                'correctionIndex'   => 'IPCA',
                'tacAmount'         => 2500.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1604-08183084000158',
                'paymentMethod'     => 'Boleto Bancário',
                'forumLocation'     => 'Lavras / MG',
                'guarantees'        => 'Codevedora solidária avalista: TRANS START COMERCIO E TRANSPORTES LTDA',
                'guarantors'        => 'ROBERTO CARLOS CARDOSO / CAMILLA TERENCIA PASSOS SOUZA',
                'url'               => '160725-INSTRUMENTO PARTICULAR DE CONFISSÃ_O DE DIVIDA [assinado].pdf',
            ],
            [
                'clientId'          => $clientMap['P&W ARCOS TRANSPORTES LTDA'],
                'contract_type_id'  => $tipoAditivoId,
                'code'              => 'ADITIVO-PW-CONSOLIDADO',
                'contractName'      => 'Primeiro Aditivo à Confissão de Dívida - P&W Arcos [Novação]',
                'creditor'          => 'TECHNOLOG TRUCK SERVIÇOS LTDA.',
                'contractDate'      => '2025-03-26',
                'status'            => 'Inadimplente',
                'principalAmount'   => 412000.00,
                'financedTotal'     => 412000.00,
                'installmentAmount' => 11444.44,
                'installmentCount'  => 36,
                'firstDueDate'      => '2025-05-10',
                'monthlyInterestRate'=> 0.0300,
                'moraRateMonthly'   => 0.02,
                'penaltyRate'       => 0.10,
                'penaltyBaseType'   => 'installment',
                'correctionIndex'   => 'IPCA',
                'tacAmount'         => 0.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1604-08183084000158',
                'paymentMethod'     => 'Boleto Bancário',
                'forumLocation'     => 'Lavras / MG',
                'guarantees'        => 'Novação e consolidação de saldo em atraso com manutenção de garantias reais',
                'guarantors'        => 'ROBERTO CARLOS CARDOSO / CAMILLA TERENCIA PASSOS SOUZA',
                'url'               => '260309 - Primeiro Aditivo ao Instrumento Particular de ConfissÃ£o de DÃ_vida e Outras AvenÃ§as [assinado].pdf',
            ]
        ];

        // Varre a matriz de contratos adicionais injetando com segurança no MySQL
        foreach ($contratosAdicionais as $data) {
            DB::table('contracts')->insert([
                'clientId'          => $data['clientId'],
                'contract_type_id'  => $data['contract_type_id'],
                'code'              => $data['code'],
                'contractName'      => $data['contractName'],
                'creditor'          => $data['creditor'],
                'contractDate'      => $data['date'] ?? $data['contractDate'],
                'status'            => $data['status'],
                'principalAmount'   => $data['principalAmount'],
                'financedTotal'     => $data['financedTotal'],
                'installmentAmount' => $data['installmentAmount'],
                'installmentCount'  => $data['installmentCount'],
                'firstDueDate'      => $data['firstDueDate'],
                'monthlyInterestRate'=> $data['monthlyInterestRate'],
                'moraRateMonthly'   => $data['moraRateMonthly'],
                'penaltyRate'       => $data['penaltyRate'],
                'penaltyBaseType'   => $data['penaltyBaseType'],
                'correctionIndex'   => $data['correctionIndex'],
                'tacAmount'         => $data['tacAmount'],
                'chosenBankAccount' => $data['chosenBankAccount'],
                'paymentMethod'     => $data['paymentMethod'],
                'forumLocation'     => $data['forumLocation'],
                'guarantees'        => $data['guarantees'],
                'guarantors'        => $data['guarantors'],
                'validationUrl'     => $data['url'],
                'observations'      => 'Carga incremental de auditoria complementar via Seeder dedicada.',
                'createdAt'         => now(),
                'updatedAt'         => now()
            ]);
        }
    }
}