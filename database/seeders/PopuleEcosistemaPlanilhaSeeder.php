<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PopuleEcosistemaPlanilhaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 🧼 ETAPA 1: PURGA E LIMPEZA COMPLETA DA BASE ANTIGA (Reset de Fábrica Sem Lixo)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('payments')->truncate();
        DB::table('installments')->truncate();
        DB::table('contracts')->truncate();
        DB::table('clients')->truncate();
        DB::table('contract_types')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 📊 ETAPA 2: INGESTÃO DOS MODELOS E TIPOS DE PRODUTOS
        $tipos = [
            'Consignado'          => 'Crédito Consignado',
            'Confissão de Dívida' => 'Confissão de Dívida',
            'Aditivo DIP'         => 'Aditivo DIP',
            'Mútuo'               => 'Mútuo / Empréstimo',
            'Financiamento'       => 'Financiamento de Veículo',
            'Protesto/Pendente'   => 'Protesto/Pendente'
        ];

        $tipoIds = [];
        foreach ($tipos as $key => $name) {
            $tipoIds[$key] = DB::table('contract_types')->insertGetId([
                'name'       => $name,
                'slug'       => strtolower(str_replace(['/', ' '], ['-', '_'], $key)),
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // 👥 ETAPA 3: DICIONÁRIO ENRIQUECIDO DE CLIENTES (Múltiplas Contas + Fiadores em JSON)
        $clientesData = [
            [
                'name' => 'JOSE LUIS FERNANDEZ CARTAYA', 'document' => '708.670.242-08',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '7178', 'conta' => '64288-5', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '70867024208']
                    ],
                    'fiador1Nome' => 'MARIA HELENA CARTAYA', 'fiador1Cpf' => '112.445.889-11', 'fiador1Telefone' => '(31) 98877-6655', 'fiador1Endereco' => 'Rua dos Engenheiros, 12', 'fiador1Cidade' => 'Belo Horizonte', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'LEONARDO DE SOUSA MIRANDA', 'document' => '041.420.031-43',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '7422', 'conta' => '32962-8', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '04142003143']
                    ]
                ])
            ],
            [
                'name' => 'EVERTON FERREIRA RODRIGUES', 'document' => '114.778.776-06',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '260 - NUBANK', 'agencia' => '0001', 'conta' => '53093047-4', 'tipo' => 'Digital', 'hasPix' => true, 'pixKey' => '11477877606']
                    ]
                ])
            ],
            [
                'name' => 'WANDERSON DE PAIVA VIEIRA', 'document' => '036.400.076-70',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '1463', 'conta' => '35236-7', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '31485465000103']
                    ]
                ])
            ],
            [
                'name' => 'PATRICK HERMES SILVA', 'document' => '079.377.316-48',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '1463', 'conta' => '41497-7', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '07937731648']
                    ],
                    'fiador1Nome' => 'VIVIANE NOGUEIRA', 'fiador1Cpf' => '067.734.656-56', 'fiador1Telefone' => '(35) 99274-0257', 'fiador1Endereco' => 'Rua Paulo Rosa Botelho, 286, Parque Bocaina', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'LUIZ CARLOS DE ANDRADE', 'document' => '611.139.806-72',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '1463', 'conta' => '349041', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '61113980672']
                    ],
                    'fiador1Nome' => 'HENRIQUE ALVES DE MEDEIROS', 'fiador1Cpf' => '037.360.496-33', 'fiador1Telefone' => '(35) 3821-1638', 'fiador1Endereco' => 'Rua Monsenhor Domingos, Centro', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'GERSON FERREIRA BATISTA FILHO', 'document' => '043.686.846-64',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '1463', 'conta' => '35605-3', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '04368684664']
                    ],
                    'fiador1Nome' => 'HENRIQUE ALVES DE MEDEIROS', 'fiador1Cpf' => '037.360.496-33', 'fiador1Telefone' => '(35) 99929-0155', 'fiador1Endereco' => 'Rua Monsenhor Domingos, 79, Centro', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'BELOSANTA TRANSPORTES E SERVICOS LTDA', 'document' => '65.306.953/0001-28',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '001 - Banco do Brasil S.A.', 'agencia' => '1604-7', 'conta' => '12045-9', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '65306953000128']
                    ],
                    'fiador1Nome' => 'Thiago Henrique de Paula Conceição', 'fiador1Cpf' => '012.236.766-92', 'fiador1Telefone' => '(31) 99544-1054', 'fiador1Endereco' => 'Rua Desembargador Pedro Viana, 345, Apto 302', 'fiador1Cidade' => 'Santa Luzia', 'fiador1Estado' => 'MG',
                    'fiador2Nome' => 'Camilli Guimarães Carneiro', 'fiador2Cpf' => '133.357.766-40', 'fiador2Telefone' => '(31) 99201-1156', 'fiador2Endereco' => 'Rua Desembargador Pedro Viana, 345, Apto 302', 'fiador2Cidade' => 'Santa Luzia', 'fiador2Estado' => 'MG'
                ])
            ],
            [
                'name' => 'RENATA DE PAULA RODRIGUES ANDRADE', 'document' => '067.981.396-98',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '237 - Bradesco', 'agencia' => '1890', 'conta' => '39.515-3', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '43668240000171']
                    ],
                    'fiador1Nome' => 'GUSTAVO PEREIRA COSTA ANDRADE', 'fiador1Cpf' => '056.101.836-77', 'fiador1Telefone' => '(31) 99201-4455', 'fiador1Endereco' => 'Rua Geraldo Bertolucci, 472, Monte Líbano', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'CHRONOS CONTÁBIL LTDA', 'document' => '26.966.843/0001-30',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '077 - Banco Inter S.A.', 'agencia' => '0001', 'conta' => '26966843000130', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '26966843000130']
                    ],
                    'fiador1Nome' => 'THIAGO FERREIRA SIQUEIRA', 'fiador1Cpf' => '379.794.978-21', 'fiador1Telefone' => '(35) 3821-4417', 'fiador1Endereco' => 'Rua das Estrelas, 271, Morada do Sol', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'JOYCIMARA PRISCILA GODINHO', 'document' => '046.574.796-52',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '756 - Banco Sicoob', 'agencia' => '4143', 'conta' => '22.623.001-5', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => 'aluminio.rm.finc@outlook.com'],
                        ['banco' => '336 - Banco C6 S.A', 'agencia' => '0001', 'conta' => '23171367-3', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '5535999115617']
                    ],
                    'fiador1Nome' => 'JULIANO CESAR GODINHO', 'fiador1Cpf' => '036.711.726-65', 'fiador1Telefone' => '(35) 99240-7614', 'fiador1Endereco' => 'Avenida Francisco Reis Figueiredo, 215', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'UBIRAJARA TADEU DA FONSECA', 'document' => '156.459.406-87',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '001 - Banco do Brasil S.A.', 'agencia' => '0020', 'conta' => '15645940687', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '15645940687']
                    ]
                ])
            ],
            [
                'name' => 'RECACENTER RECAPAGEM DE PNEUS LTDA ME', 'document' => '03.494.479/0001-58',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '341 - BANCO ITAÚ S.A.', 'agencia' => '1604', 'conta' => '03494479000158', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '03494479000158']
                    ],
                    'fiador1Nome' => 'LOURENÇO GOMES ALVES CARDOSO DE SÁ', 'fiador1Cpf' => '081.830.126-04', 'fiador1Telefone' => '(11) 2002-3285', 'fiador1Endereco' => 'Osasco/SP', 'fiador1Cidade' => 'Osasco', 'fiador1Estado' => 'SP',
                    'fiador2Nome' => 'MARYNA APARECIDA LOPES', 'fiador2Cpf' => '058.785.096-52', 'fiador2Telefone' => '(37) 1791-7751', 'fiador2Endereco' => 'Arcos/MG', 'fiador2Cidade' => 'Arcos', 'fiador2Estado' => 'MG'
                ])
            ],
            [
                'name' => 'IAMAR RUFINO DE OLIVEIRA', 'document' => '486.349.131-04',
                'notes' => json_encode([
                    'bankAccounts' => [
                        ['banco' => '104 - CAIXA ECONOMICA FEDERAL', 'agencia' => '1443', 'conta' => '00026635-3', 'tipo' => 'Corrente', 'hasPix' => true, 'pixKey' => '48634913104']
                    ],
                    'fiador1Nome' => 'HENRIQUE ALVES DE MEDEIROS', 'fiador1Cpf' => '037.360.496-33', 'fiador1Telefone' => '(35) 99122-1630', 'fiador1Endereco' => 'Praça Monsenhor Domingos, 79, Apto 801, Centro', 'fiador1Cidade' => 'Lavras', 'fiador1Estado' => 'MG'
                ])
            ],
            [
                'name' => 'CLEIDIMAR', 'document' => '000.000.001-99',
                'notes' => json_encode(['bankAccounts' => []])
            ],
            [
                'name' => 'PW', 'document' => '00.000.000/0001-00',
                'notes' => json_encode(['bankAccounts' => []])
            ]
        ];

        $clientMap = [];
        foreach ($clientesData as $c) {
            $clientMap[$c['name']] = DB::table('clients')->insertGetId([
                'name'      => $c['name'],
                'document'  => $c['document'],
                'notes'     => $c['notes'],
                'createdAt' => now(),
                'updatedAt' => now()
            ]);
        }

        // 📊 ETAPA 4: MATRIZ DE CONTRATOS (Campos de Recebimento, Comarca e TAC Amarrados)
        $contratos = [
            'CONSIGNADO-JOSE-2026' => [
                'code' => 'CONSIGNADO-JOSE-2026', 'client' => 'JOSE LUIS FERNANDEZ CARTAYA', 'type' => $tipoIds['Consignado'],
                'name' => 'Contrato de Crédito Consignado - Jose Luis ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2026-03-04', 'status' => 'Ativo', 'principal' => 3500.00, 'financed' => 3500.00, 'inst_count' => 12, 'inst_amount' => 424.13,
                'first_due' => '2026-02-28', 'mora' => 0.01, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IGP-M', 'tac' => 350.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-7178-64288-5', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Belo Horizonte / MG ',
                'guarantees' => 'Desconto em folha e verbas rescisórias ', 'guarantors' => '[FIADOR 1] Maria Helena Cartaya (CPF 112.445.889-11)', 'url' => 'Contrato de Empréstimo nº - JOSE LUIS FERNANDEZ CARTAYA   UnyPay [assinado].pdf'
            ],
            'CONSIGNADO-LEONARDO-2026' => [
                'code' => 'CONSIGNADO-LEONARDO-2026', 'client' => 'LEONARDO DE SOUSA MIRANDA', 'type' => $tipoIds['Consignado'],
                'name' => 'Contrato de Crédito Consignado - Leonardo ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2026-05-11', 'status' => 'Ativo', 'principal' => 3500.00, 'financed' => 3500.00, 'inst_count' => 6, 'inst_amount' => 711.30,
                'first_due' => '2026-05-31', 'mora' => 0.01, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IGP-M', 'tac' => 350.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-7422-32962-8', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Belo Horizonte / MG ',
                'guarantees' => 'Desconto em folha / rescisório ', 'guarantors' => 'Sem fiador', 'url' => 'Contrato de Empréstimo nº - LEONARDO DE SOUSA MIRANDA   UnyPay [assinado].pdf'
            ],
            'CONSIGNADO-EVERTON-2026' => [
                'code' => 'CONSIGNADO-EVERTON-2026', 'client' => 'EVERTON FERREIRA RODRIGUES', 'type' => $tipoIds['Consignado'],
                'name' => 'Contrato de Crédito Consignado - Everton ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2026-05-18', 'status' => 'Ativo', 'principal' => 3000.00, 'financed' => 3000.00, 'inst_count' => 10, 'inst_amount' => 414.17,
                'first_due' => '2026-05-31', 'mora' => 0.01, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IGP-M', 'tac' => 300.00,
                'chosenBankAccount' => '260 - NUBANK-0001-53093047-4', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Belo Horizonte / MG ',
                'guarantees' => 'Desconto em folha e verbas rescisórias ', 'guarantors' => 'Sem fiador formalizado', 'url' => 'Contrato de Empréstimo nº - EVERTON FERREIRA RODRIGUES   UnyPay [assinado].pdf'
            ],
            'FINANC-WANDERSON-2025' => [
                'code' => 'FINANC-WANDERSON-2025', 'client' => 'WANDERSON DE PAIVA VIEIRA', 'type' => $tipoIds['Financiamento'],
                'name' => 'Financiamento de Veículo - Wanderson ', 'creditor' => 'UnyPay® S.A ',
                'date' => '2025-10-17', 'status' => 'Ativo', 'principal' => 40000.00, 'financed' => 40000.00, 'inst_count' => 48, 'inst_amount' => 1379.48,
                'first_due' => '2025-11-05', 'mora' => 0.01, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 400.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1463-35236-7', 'paymentMethod' => 'PIX QrCode', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Alienação Fiduciária - Kia Sorento Placa GRS6A06 ', 'guarantors' => 'Garantia real alienada ', 'url' => 'WandersonContrato Financimento Veículo - Nº 20251017-001.pdf'
            ],
            'MUTUO-PATRICK-2024' => [
                'code' => 'MUTUO-PATRICK-2024', 'client' => 'PATRICK HERMES SILVA', 'type' => $tipoIds['Mútuo'],
                'name' => 'Contrato de Mútuo — Patrick Hermes ', 'creditor' => 'HI TRANSPORTES LTDA ',
                'date' => '2024-01-23', 'status' => 'Ativo', 'principal' => 5000.00, 'financed' => 5000.00, 'inst_count' => 31, 'inst_amount' => 464.42,
                'first_due' => '2024-02-28', 'mora' => 0.00, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'PRÉ', 'tac' => 0.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1463-41497-7', 'paymentMethod' => 'TED / DOC', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Desconto em folha salarial e rescisão ', 'guarantors' => '[FIADOR 1] Viviane Nogueira (CPF 067.734.656-56) ', 'url' => 'Contrato de Empréstimo_ Patrick.pdf'
            ],
            'MUTUO-LUIZ-2024' => [
                'code' => 'MUTUO-LUIZ-2024', 'client' => 'LUIZ CARLOS DE ANDRADE', 'type' => $tipoIds['Mútuo'],
                'name' => 'Contrato de Mútuo - Luiz Carlos ', 'creditor' => 'HI TRANSPORTES LTDA ',
                'date' => '2024-09-16', 'status' => 'Ativo', 'principal' => 1000.00, 'financed' => 1000.00, 'inst_count' => 10, 'inst_amount' => 137.90,
                'first_due' => '2024-09-30', 'mora' => 0.00, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'PRÉ', 'tac' => 0.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1463-349041', 'paymentMethod' => 'TED / DOC', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Desconto em folha e verbas rescisórias ', 'guarantors' => '[FIADOR 1] Henrique Alves de Medeiros (CPF 037.360.496-33) ', 'url' => 'Contrato de empréstimo Luiz Carlos - 1855 - 374.pdf'
            ],
            'MUTUO-GERSON-2024' => [
                'code' => 'MUTUO-GERSON-2024', 'client' => 'GERSON FERREIRA BATISTA FILHO', 'type' => $tipoIds['Mútuo'],
                'name' => 'Contrato de Mútuo - Gerson Ferreira ', 'creditor' => 'HI TRANSPORTES LTDA ',
                'date' => '2024-02-21', 'status' => 'Ativo', 'principal' => 20000.00, 'financed' => 20000.00, 'inst_count' => 34, 'inst_amount' => 998.47,
                'first_due' => '2024-02-29', 'mora' => 0.00, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'PRÉ', 'tac' => 0.00,
                'chosenBankAccount' => '341 - BANCO ITAÚ S.A.-1463-35605-3', 'paymentMethod' => 'TED / DOC', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Desconto salarial de até 30% da remuneração ', 'guarantors' => '[FIADOR 1] Henrique Alves de Medeiros (CPF 037.360.496-33) ', 'url' => 'Contrato Empréstimo Gerson F Batista.pdf'
            ],
            'BeloSanta1' => [
                'code' => 'BeloSanta1', 'client' => 'BELOSANTA TRANSPORTES E SERVICOS LTDA', 'type' => $tipoIds['Confissão de Dívida'],
                'name' => 'BeloSanta1 - Technolog Desenvolvimento - Confissão de Dívida ', 'creditor' => 'Technolog Desenvolvimento de Serviços Ltda. ',
                'date' => '2024-09-10', 'status' => 'Inadimplente', 'principal' => 948922.20, 'financed' => 948922.20, 'inst_count' => 36, 'inst_amount' => 26358.95,
                'first_due' => '2024-10-10', 'mora' => 0.02, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 1000.00,
                'chosenBankAccount' => '001 - Banco do Brasil S.A.-1604-7-12045-9', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Fiadores solidários: Thiago Henrique e Camilli Guimarães ', 'guarantors' => 'Thiago Henrique / Camilli Guimarães ', 'url' => 'Contrato BeloSanta [assinado] (1).pdf'
            ],
            'BeloSanta2' => [
                'code' => 'BeloSanta2', 'client' => 'BELOSANTA TRANSPORTES E SERVICOS LTDA', 'type' => $tipoIds['Confissão de Dívida'],
                'name' => 'BeloSanta2 - UnyPay® - Confissão de Dívida ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2024-10-31', 'status' => 'Inadimplente', 'principal' => 871875.00, 'financed' => 871875.00, 'inst_count' => 36, 'inst_amount' => 24218.75,
                'first_due' => '2024-11-30', 'mora' => 0.02, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 1000.00,
                'chosenBankAccount' => '001 - Banco do Brasil S.A.-1604-7-12045-9', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Fiadores solidários: Thiago Henrique e Camilli Guimarães ', 'guarantors' => 'Thiago Henrique / Camilli Guimarães ', 'url' => 'Contrato Empréstimo Thiago Belo Santa [assinado] (1).pdf'
            ],
            'EXT-RENATA-2025' => [
                'code' => 'EXT-RENATA-2025', 'client' => 'RENATA DE PAULA RODRIGUES ANDRADE', 'type' => $tipoIds['Mútuo'],
                'name' => 'Contrato de Mútuo - ELAV Lavanderia ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2025-03-27', 'status' => 'Ativo', 'principal' => 40000.00, 'financed' => 76157.28, 'inst_count' => 36, 'inst_amount' => 2115.48,
                'first_due' => '2025-04-27', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 400.00,
                'chosenBankAccount' => '237 - Bradesco-1890-39.515-3', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Garantia fidejussória integral solidária ', 'guarantors' => 'GUSTAVO PEREIRA COSTA ANDRADE (CPF 056.101.836-77) ', 'url' => 'Contrato Empréstimo Renata [assinado].pdf'
            ],
            'EXT-CHRONOS-2025' => [
                'code' => 'EXT-CHRONOS-2025', 'client' => 'CHRONOS CONTÁBIL LTDA', 'type' => $tipoIds['Mútuo'],
                'name' => 'Contrato de Mútuo - Chronos Contábil L2 ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2025-04-07', 'status' => 'Ativo', 'principal' => 35000.00, 'financed' => 71228.64, 'inst_count' => 48, 'inst_amount' => 1483.93,
                'first_due' => '2025-05-07', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 350.00,
                'chosenBankAccount' => '077 - Banco Inter S.A.-0001-26966843000130', 'paymentMethod' => 'PIX QrCode', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Fiança solidária corporativa ', 'guarantors' => 'THIAGO FERREIRA SIQUEIRA ', 'url' => 'Contrato Empréstimo Chronos Contábil [assinado] 2.pdf'
            ],
            'EXT-JOYCIMARA-L1' => [
                'code' => 'EXT-JOYCIMARA-L1', 'client' => 'JOYCIMARA PRISCILA GODINHO', 'type' => $tipoIds['Mútuo'],
                'name' => 'Joycimara/Juliano1 - Mútuo R$ 200.000,00 ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2024-11-11', 'status' => 'Inadimplente', 'principal' => 200000.00, 'financed' => 337128.72, 'inst_count' => 24, 'inst_amount' => 14047.03,
                'first_due' => '2025-03-11', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 1000.00,
                'chosenBankAccount' => '756 - Banco Sicoob-4143-22.623.001-5', 'paymentMethod' => 'PIX QrCode', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Garantia real: lote nº 01 da quadra 17, matrícula 40282, Lavras/MG ', 'guarantors' => 'Juliano Cesar Godinho ', 'url' => 'Contrato Empréstiomo Joycimara -Juliano [assinado].pdf'
            ],
            'EXT-UBIRAJARA-CD' => [
                'code' => 'EXT-UBIRAJARA-CD', 'client' => 'UBIRAJARA TADEU DA FONSECA', 'type' => $tipoIds['Confissão de Dívida'],
                'name' => 'Ubirajara1 - Confissão de Dívida ', 'creditor' => 'UnyPay S.A ',
                'date' => '2024-09-20', 'status' => 'Inadimplente', 'principal' => 11464.88, 'financed' => 11464.88, 'inst_count' => 25, 'inst_amount' => 469.37,
                'first_due' => '2024-09-20', 'mora' => 0.02, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 200.00,
                'chosenBankAccount' => '001 - Banco do Brasil S.A.-0020-15645940687', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Lavras / MG ',
                'guarantees' => 'Garantia pessoal e novação de saldo remanescente ', 'guarantors' => 'Sem fiador', 'url' => 'Contrato - Emprétimo Ubirajara 20-09-2024.pdf'
            ],
            'CONSIGNADO-IAMAR-2026' => [
                'code' => 'CONSIGNADO-IAMAR-2026', 'client' => 'IAMAR RUFINO DE OLIVEIRA', 'type' => $tipoIds['Consignado'],
                'name' => 'Contrato de Crédito Consignado - Iamar ', 'creditor' => 'UnyPay® S.A. ',
                'date' => '2026-01-12', 'status' => 'Ativo', 'principal' => 6000.00, 'financed' => 6000.00, 'inst_count' => 10, 'inst_amount' => 834.76,
                'first_due' => '2026-01-31', 'mora' => 0.01, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IGP-M', 'tac' => 250.00,
                'chosenBankAccount' => '104 - CAIXA ECONOMICA FEDERAL-1443-00026635-3', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Belo Horizonte / MG ',
                'guarantees' => 'Margem consignável e verbas rescisórias ', 'guarantors' => 'HENRIQUE ALVES DE MEDEIROS (CPF 037.360.496-33) ', 'url' => 'Contrato de Empréstimo nº - IAMAR RUFINO DE OLIVEIRA   UnyPay [assinado].pdf'
            ],
            'PEND-CLEIDIMAR' => [
                'code' => 'PEND-CLEIDIMAR', 'client' => 'CLEIDIMAR', 'type' => $tipoIds['Protesto/Pendente'],
                'name' => 'Cleidimar - contrato pendente de anexo', 'creditor' => 'UnyPay® S.A.',
                'date' => '2025-04-01', 'status' => 'Inadimplente', 'principal' => 3257.72, 'financed' => 3257.72, 'inst_count' => 4, 'inst_amount' => 814.43,
                'first_due' => '2025-05-01', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 0.00,
                'chosenBankAccount' => '', 'paymentMethod' => 'Boleto Bancário', 'forum' => 'Belo Horizonte / MG',
                'guarantees' => 'Em aberto na assessoria judicial', 'guarantors' => 'Nenhum', 'url' => 'Planilha'
            ],
            'PEND-PW' => [
                'code' => 'PEND-PW', 'client' => 'PW', 'type' => $tipoIds['Protesto/Pendente'],
                'name' => 'PW - Estruturação de Recebíveis Internacionais', 'creditor' => 'UnyPay® S.A.',
                'date' => '2025-07-16', 'status' => 'Ativo', 'principal' => 10900719.14, 'financed' => 10900719.14, 'inst_count' => 36, 'inst_amount' => 286861.03,
                'first_due' => '2025-07-30', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA', 'tac' => 0.00,
                'chosenBankAccount' => '', 'paymentMethod' => 'TED / DOC', 'forum' => 'Belo Horizonte / MG',
                'guarantees' => 'Fundo de Aval Garantidor', 'guarantors' => 'Nenhum', 'url' => 'Planilha'
            ]
        ];

        $contractIds = [];
        foreach ($contratos as $key => $data) {
            $contractIds[$key] = DB::table('contracts')->insertGetId([
                'clientId'          => $clientMap[$data['client']],
                'contract_type_id'  => $data['type'],
                'code'              => $data['code'],
                'contractName'      => $data['name'],
                'creditor'          => $data['creditor'],
                'contractDate'      => $data['date'],
                'status'            => $data['status'],
                'principalAmount'   => $data['principal'],
                'financedTotal'     => $data['financed'],
                'installmentAmount' => $data['inst_amount'],
                'installmentCount'  => $data['inst_count'],
                'firstDueDate'      => $data['first_due'],
                'monthlyInterestRate'=> 0.0338,
                'moraRateMonthly'   => $data['mora'],
                'penaltyRate'       => $data['penalty'],
                'penaltyBaseType'   => $data['base'],
                'correctionIndex'   => $data['index'],
                'tacAmount'         => $data['tac'],
                'chosenBankAccount' => $data['chosenBankAccount'],
                'paymentMethod'     => $data['paymentMethod'],
                'forumLocation'     => $data['forum'],
                'guarantees'        => $data['guarantees'],
                'guarantors'        => $data['guarantors'],
                'validationUrl'     => $data['url'],
                'createdAt'         => now(),
                'updatedAt'         => now()
            ]);
        }

        // 📊 ETAPA 5: INGESTÃO CRONOLÓGICA DAS AGENDAS DE PARCELAS E SEUS RECIBOS
        $fluxoParcelas = [
            ['BeloSanta1', 1, 26358.95, '2024-10-10', 'Pago', 26376.50, '2024-10-14'],
            ['BeloSanta1', 2, 26358.95, '2024-11-10', 'Pago', 26358.95, '2024-11-12'],
            ['BeloSanta1', 3, 26358.95, '2024-12-10', 'Pago', 26455.04, '2024-12-13'],
            ['BeloSanta1', 4, 26358.95, '2025-01-10', 'Pago', 26358.95, '2025-01-13'],
            ['BeloSanta1', 5, 26358.95, '2025-02-10', 'Pago', 26358.95, '2025-02-12'],
            ['BeloSanta1', 6, 26358.95, '2025-03-10', 'Pago', 26607.77, '2025-03-18'],
            ['BeloSanta1', 7, 26358.95, '2025-04-10', 'Pago', 26750.52, '2025-04-23'],
            ['BeloSanta1', 8, 26358.95, '2025-05-10', 'Pago', 28201.63, '2025-07-10'],
            ['BeloSanta1', 9, 26358.95, '2025-06-10', 'Pago', 28017.42, '2025-08-04'],
            ['BeloSanta1', 10, 26358.95, '2025-07-10', 'Pago', 29746.54, '2025-10-27'],
            ['BeloSanta1', 11, 26358.95, '2025-08-10', 'Vencido', null, null],
            ['BeloSanta1', 12, 26358.95, '2025-09-10', 'Vencido', null, null],

            ['BeloSanta2', 1, 24218.75, '2024-11-30', 'Pago', 24218.75, '2024-12-02'],
            ['BeloSanta2', 2, 24218.75, '2024-12-31', 'Pago', 24218.75, '2025-01-03'],
            ['BeloSanta2', 3, 24218.75, '2025-01-31', 'Pago', 24333.40, '2025-02-04'],
            ['BeloSanta2', 4, 24218.75, '2025-02-28', 'Pago', 24497.11, '2025-03-10'],
            ['BeloSanta2', 5, 24218.75, '2025-03-31', 'Pago', 26559.90, '2025-04-23'],
            ['BeloSanta2', 6, 24218.75, '2025-04-30', 'Pago', 24923.97, '2025-06-24'],
            ['BeloSanta2', 7, 24218.75, '2025-05-31', 'Pago', 26058.48, '2025-08-04'],
            ['BeloSanta2', 8, 24218.75, '2025-06-30', 'Pago', 26207.19, '2025-09-09'],
            ['BeloSanta2', 9, 24218.75, '2025-07-31', 'Vencido', null, null],

            ['EXT-JOYCIMARA-L1', 1, 14047.03, '2025-03-11', 'Pago', 14047.03, '2025-03-12'],
            ['EXT-JOYCIMARA-L1', 2, 14047.03, '2025-04-11', 'Pago', 14047.03, '2025-04-14'],
            ['EXT-JOYCIMARA-L1', 3, 14047.03, '2025-05-11', 'Vencido', null, null]
        ];

        foreach ($fluxoParcelas as $p) {
            $contractId = $contractIds[$p[0]] ?? null;
            if ($contractId) {
                $installmentId = DB::table('installments')->insertGetId([
                    'contractId'        => $contractId,
                    'installmentNumber' => $p[1],
                    'dueDate'           => $p[3],
                    'originalAmount'    => $p[2],
                    'status'            => $p[4] === 'Pago' ? 'Pago' : 'Vencido',
                    'createdAt'         => now(),
                    'updatedAt'         => now()
                ]);

                if ($p[4] === 'Pago' && $p[5] !== null && $p[6] !== null) {
                    DB::table('payments')->insert([
                        'installmentId' => $installmentId,
                        'amount'        => $p[5],
                        'paidAt'        => $p[6],
                        'method'        => 'PIX',
                        'recordedBy'    => 'Carga Planilha Executiva'
                    ]);
                }
            }
        }
    }
}