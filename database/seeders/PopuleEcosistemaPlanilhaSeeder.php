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
        // 🛠️ 1. Ingestão Segura dos Tipos de Contrato (Padrão com underline detectado)
        $tipos = [
            'Confissão de Dívida' => 'Confissão de Dívida',
            'Aditivo DIP' => 'Aditivo DIP',
            'Mútuo' => 'Mútuo',
            'Protesto/Pendente' => 'Protesto/Pendente'
        ];

        $tipoIds = [];
        foreach ($tipos as $key => $name) {
            $id = DB::table('contract_types')->where('name', $name)->value('id');
            if (!$id) {
                $id = DB::table('contract_types')->insertGetId([
                    'name' => $name,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
            $tipoIds[$key] = $id;
        }

        // 👥 2. Ingestão Segura de Clientes (Padrão CamelCase 'createdAt')
        $clientesData = [
            ['name' => 'BELOSANTA TRANSPORTES E SERVICOS LTDA', 'document' => '65.306.953/0001-28'],
            ['name' => 'JOYCIMARA PRISCILA GODINHO', 'document' => '046.574.796-52'],
            ['name' => 'ENG ONLINE PROJETOS E DESENHOS TECNICOS LTDA', 'document' => '41.188.322/0001-93'],
            ['name' => 'UBIRAJARA TADEU DA FONSECA', 'document' => '156.459.406-87'],
            ['name' => 'CLEIDIMAR', 'document' => '000.000.001-99'],
            ['name' => 'PW', 'document' => '00.000.000/0001-00'],
        ];

        $clientMap = [];
        foreach ($clientesData as $c) {
            DB::table('clients')->updateOrInsert(
                ['document' => $c['document']],
                ['name' => $c['name'], 'createdAt' => now(), 'updatedAt' => now()]
            );
            $clientMap[$c['name']] = DB::table('clients')->where('document', $c['document'])->value('id');
        }

        // 📊 3. Dicionário Operacional de Contratos (Campos ENUM travados como 'installment')
        $contratos = [
            'BeloSanta1' => [
                'code' => 'BeloSanta1', 'client' => 'BELOSANTA TRANSPORTES E SERVICOS LTDA', 'type' => $tipoIds['Confissão de Dívida'],
                'name' => 'BeloSanta1 - Technolog Desenvolvimento - Confissão de Dívida 10/09/2024', 'creditor' => 'Technolog Desenvolvimento de Serviços Ltda.',
                'date' => '2024-09-10', 'status' => 'Inadimplente', 'principal' => 948922.20, 'financed' => 948922.20, 'inst_count' => 36, 'inst_amount' => 26358.95,
                'first_due' => '2024-10-10', 'mora' => 0.02, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Fiadores solidários: Thiago Henrique de Paula Conceição e Camilli Guimarães Carneiro', 'guarantors' => 'Thiago Henrique / Camilli Guimarães', 'url' => 'Contrato BeloSanta [assinado] (1).pdf'
            ],
            'BeloSanta2' => [
                'code' => 'BeloSanta2', 'client' => 'BELOSANTA TRANSPORTES E SERVICOS LTDA', 'type' => $tipoIds['Confissão de Dívida'],
                'name' => 'BeloSanta2 - UnyPay® - Confissão de Dívida 31/10/2024', 'creditor' => 'UnyPay® S.A.',
                'date' => '2024-10-31', 'status' => 'Inadimplente', 'principal' => 871875.00, 'financed' => 871875.00, 'inst_count' => 36, 'inst_amount' => 24218.75,
                'first_due' => '2024-11-30', 'mora' => 0.02, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Fiadores solidários: Thiago Henrique de Paula Conceição e Camilli Guimarães Carneiro', 'guarantors' => 'Thiago Henrique / Camilli Guimarães', 'url' => 'Contrato Empréstimo Thiago Belo Santa [assinado] (1).pdf'
            ],
            'BeloSanta3' => [
                'code' => 'BeloSanta3', 'client' => 'BELOSANTA TRANSPORTES E SERVICOS LTDA', 'type' => $tipoIds['Aditivo DIP'],
                'name' => 'BeloSanta3 - Aditivo DIP UnyPay® 25/06/2025', 'creditor' => 'UnyPay® S.A.',
                'date' => '2025-06-25', 'status' => 'Inadimplente', 'principal' => 468241.92, 'financed' => 468241.92, 'inst_count' => 24, 'inst_amount' => 19510.08,
                'first_due' => '2025-07-10', 'mora' => 0.01, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Crédito DIP/extraconcursal conforme aditivo judicial', 'guarantors' => 'Thiago Henrique / Camilli Guimarães', 'url' => 'Aditivo ao Contrato de Mútuo UnyPay - BeloSanta [assinado] (1).pdf'
            ],
            'Juliano1' => [
                'code' => 'EXT-JOYCIMARA-L1', 'client' => 'JOYCIMARA PRISCILA GODINHO', 'type' => $tipoIds['Mútuo'],
                'name' => 'Joycimara/Juliano1 - Mútuo R$ 200.000,00 - 11/11/2024', 'creditor' => 'UnyPay® S.A.',
                'date' => '2024-11-11', 'status' => 'Inadimplente', 'principal' => 200000.00, 'financed' => 337128.72, 'inst_count' => 24, 'inst_amount' => 14047.03,
                'first_due' => '2025-03-11', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Garantia real: lote nº 01 da quadra 17, matrícula 40282, Lavras/MG', 'guarantors' => 'Juliano Cesar Godinho', 'url' => 'Contrato Empréstiomo Joycimara -Juliano [assinado].pdf'
            ],
            'Juliano2' => [
                'code' => 'EXT-JOYCIMARA-L2', 'client' => 'JOYCIMARA PRISCILA GODINHO', 'type' => $tipoIds['Mútuo'],
                'name' => 'Joycimara/Juliano2 - Mútuo R$ 180.000,00 - 19/12/2024', 'creditor' => 'UnyPay® S.A.',
                'date' => '2024-12-19', 'status' => 'Inadimplente', 'principal' => 180000.00, 'financed' => 303415.92, 'inst_count' => 24, 'inst_amount' => 12642.33,
                'first_due' => '2025-04-19', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Garantia real: lote nº 01 da quadra 17, matrícula 40282, Lavras/MG', 'guarantors' => 'Juliano Cesar Godinho', 'url' => 'Contrato Empréstimo Joycecimara -Juliano [assinado]2.pdf'
            ],
            'Lucas Eng' => [
                'code' => 'EXT-ENGONLINE-2025', 'client' => 'ENG ONLINE PROJETOS E DESENHOS TECNICOS LTDA', 'type' => $tipoIds['Mútuo'],
                'name' => 'ENG Online - Lucas - Mútuo R$ 60.000,00 - 03/02/2025', 'creditor' => 'UnyPay® S.A.',
                'date' => '2025-02-03', 'status' => 'Inadimplente', 'principal' => 60000.00, 'financed' => 88546.32, 'inst_count' => 24, 'inst_amount' => 3689.43,
                'first_due' => '2025-03-05', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Fiadores solidários: Lucas Rodrigo de Almeida Souza e Maria Paula Mesquita Rodarte', 'guarantors' => 'Lucas Rodrigo / Maria Paula Mesquita', 'url' => 'Contrato Empréstimo Eng Online - Lucas [assinado].pdf'
            ],
            'Ubirajara1' => [
                'code' => 'EXT-UBIRAJARA-CD', 'client' => 'UBIRAJARA TADEU DA FONSECA', 'type' => $tipoIds['Confissão de Dívida'],
                'name' => 'Ubirajara1 - Confissão de Dívida 20/09/2024', 'creditor' => 'UnyPay® S.A.',
                'date' => '2024-09-20', 'status' => 'Inadimplente', 'principal' => 11464.88, 'financed' => 11464.88, 'inst_count' => 25, 'inst_amount' => 469.37,
                'first_due' => '2024-09-20', 'mora' => 0.02, 'penalty' => 0.10, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Sem fiador/garantia específica identificada no instrumento anexado.', 'guarantors' => 'Sem fiador', 'url' => 'Contrato - Emprétimo Ubirajara 20-09-2024.pdf'
            ],
            'Ubirajara2' => [
                'code' => 'EXT-UBIRAJARA-MUT', 'client' => 'UBIRAJARA TADEU DA FONSECA', 'type' => $tipoIds['Mútuo'],
                'name' => 'Ubirajara2 - Mútuo R$ 4.000,00 - 12/12/2024', 'creditor' => 'UnyPay® S.A.',
                'date' => '2024-12-12', 'status' => 'Inadimplente', 'principal' => 4000.00, 'financed' => 5296.80, 'inst_count' => 24, 'inst_amount' => 220.70,
                'first_due' => '2025-01-13', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'Sem fiador/garantia específica identificada no instrumento anexado.', 'guarantors' => 'Sem fiador', 'url' => 'Contrato Empréstimo Ubirajara [assinado] (1).pdf'
            ],
            'Cleidimar' => [
                'code' => 'PEND-CLEIDIMAR', 'client' => 'CLEIDIMAR', 'type' => $tipoIds['Protesto/Pendente'],
                'name' => 'Cleidimar - contrato não anexado nesta rodada', 'creditor' => 'UnyPay® S.A.',
                'date' => '2025-04-01', 'status' => 'Inadimplente', 'principal' => 3257.72, 'financed' => 3257.72, 'inst_count' => 4, 'inst_amount' => 814.43,
                'first_due' => '2025-05-01', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'PENDENTE: contrato não anexado', 'guarantors' => 'Nenhum', 'url' => 'Planilha'
            ],
            'PW' => [
                'code' => 'PEND-PW', 'client' => 'PW', 'type' => $tipoIds['Protesto/Pendente'],
                'name' => 'PW - contrato não anexado nesta rodada', 'creditor' => 'UnyPay® S.A.',
                'date' => '2025-07-16', 'status' => 'Ativo', 'principal' => 10900719.14, 'financed' => 10900719.14, 'inst_count' => 36, 'inst_amount' => 286861.03,
                'first_due' => '2025-07-30', 'mora' => 0.02, 'penalty' => 0.02, 'base' => 'installment', 'index' => 'IPCA',
                'guarantees' => 'PENDENTE: contrato não anexado', 'guarantors' => 'Nenhum', 'url' => 'Planilha'
            ]
        ];

        $contractIds = [];
        foreach ($contratos as $key => $data) {
            DB::table('contracts')->updateOrInsert(
                ['code' => $data['code']],
                [
                    'clientId' => $clientMap[$data['client']],
                    'contract_type_id' => $data['type'],
                    'contractName' => $data['name'],
                    'creditor' => $data['creditor'],
                    'contractDate' => $data['date'],
                    'status' => $data['status'],
                    'principalAmount' => $data['principal'],
                    'financedTotal' => $data['financed'],
                    'installmentAmount' => $data['inst_amount'],
                    'installmentCount' => $data['inst_count'],
                    'firstDueDate' => $data['first_due'],
                    'moraRateMonthly' => $data['mora'],
                    'penaltyRate' => $data['penalty'],
                    'penaltyBaseType' => $data['base'],
                    'correctionIndex' => $data['index'],
                    'guarantees' => $data['guarantees'],
                    'guarantors' => $data['guarantors'],
                    'validationUrl' => $data['url'],
                    'createdAt' => now(),
                    'updatedAt' => now()
                ]
            );
            $contractIds[$key] = DB::table('contracts')->where('code', $data['code'])->value('id');
        }

        // 📊 4. Ingestão Nativa do Fluxo de Parcelas (Tabela installments) e Baixas Reais (Tabela payments)
        $fluxoParcelas = [
            // [Aba Origem, Parcela, Valor Nominal, Vencimento, Status, Valor Real Pago, Data Pagamento]
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
            ['BeloSanta1', 13, 26358.95, '2025-10-10', 'Vencido', null, null],
            ['BeloSanta1', 14, 26358.95, '2025-11-10', 'Vencido', null, null],
            ['BeloSanta1', 15, 26358.95, '2025-12-10', 'Vencido', null, null],
            ['BeloSanta1', 16, 26358.95, '2026-01-10', 'Vencido', null, null],
            ['BeloSanta1', 17, 26358.95, '2026-02-10', 'Vencido', null, null],
            ['BeloSanta1', 18, 26358.95, '2026-03-10', 'Vencido', null, null],
            ['BeloSanta1', 19, 26358.95, '2026-04-10', 'Vencido', null, null],
            ['BeloSanta1', 20, 26358.95, '2026-05-10', 'Vencido', null, null],

            ['BeloSanta2', 1, 24218.75, '2024-11-30', 'Pago', 24218.75, '2024-12-02'],
            ['BeloSanta2', 2, 24218.75, '2024-12-31', 'Pago', 24218.75, '2025-01-03'],
            ['BeloSanta2', 3, 24218.75, '2025-01-31', 'Pago', 24333.40, '2025-02-04'],
            ['BeloSanta2', 4, 24218.75, '2025-02-28', 'Pago', 24497.11, '2025-03-10'],
            ['BeloSanta2', 5, 24218.75, '2025-03-31', 'Pago', 26559.90, '2025-04-23'],
            ['BeloSanta2', 6, 24218.75, '2025-04-30', 'Pago', 24923.97, '2025-06-24'],
            ['BeloSanta2', 7, 24218.75, '2025-05-31', 'Pago', 26058.48, '2025-08-04'],
            ['BeloSanta2', 8, 24218.75, '2025-06-30', 'Pago', 26207.19, '2025-09-09'],
            ['BeloSanta2', 9, 24218.75, '2025-07-31', 'Vencido', null, null],
            ['BeloSanta2', 10, 24218.75, '2025-08-31', 'Vencido', null, null],
            ['BeloSanta2', 11, 24218.75, '2025-09-30', 'Vencido', null, null],
            ['BeloSanta2', 12, 24218.75, '2025-10-31', 'Vencido', null, null],
            ['BeloSanta2', 13, 24218.75, '2025-11-30', 'Vencido', null, null],
            ['BeloSanta2', 14, 24218.75, '2025-12-31', 'Vencido', null, null],
            ['BeloSanta2', 15, 24218.75, '2026-01-31', 'Vencido', null, null],
            ['BeloSanta2', 16, 24218.75, '2026-02-28', 'Vencido', null, null],
            ['BeloSanta2', 17, 24218.75, '2026-03-31', 'Vencido', null, null],
            ['BeloSanta2', 18, 24218.75, '2026-04-30', 'Vencido', null, null],

            ['BeloSanta3', 1, 19510.08, '2025-07-10', 'Vencido', null, null],
            ['BeloSanta3', 2, 19510.08, '2025-08-10', 'Vencido', null, null],
            ['BeloSanta3', 3, 19510.08, '2025-09-10', 'Vencido', null, null],
            ['BeloSanta3', 4, 19510.08, '2025-10-10', 'Vencido', null, null],
            ['BeloSanta3', 5, 19510.08, '2025-11-10', 'Vencido', null, null],
            ['BeloSanta3', 6, 19510.08, '2025-12-10', 'Vencido', null, null],
            ['BeloSanta3', 7, 19510.08, '2026-01-10', 'Vencido', null, null],
            ['BeloSanta3', 8, 19510.08, '2026-02-10', 'Vencido', null, null],
            ['BeloSanta3', 9, 19510.08, '2026-03-10', 'Vencido', null, null],
            ['BeloSanta3', 10, 19510.08, '2026-04-10', 'Vencido', null, null],
            ['BeloSanta3', 11, 19510.08, '2026-05-10', 'Vencido', null, null],

            ['Juliano1', 1, 14047.03, '2025-03-11', 'Pago', 14047.03, '2025-03-12'],
            ['Juliano1', 2, 14047.03, '2025-04-11', 'Pago', 14047.03, '2025-04-14'],
            ['Juliano1', 3, 14047.03, '2025-05-11', 'Vencido', null, null],
            ['Juliano1', 4, 14047.03, '2025-06-11', 'Vencido', null, null],
            ['Juliano1', 5, 14047.03, '2025-07-11', 'Vencido', null, null],
            ['Juliano1', 6, 14047.03, '2025-08-11', 'Vencido', null, null],
            ['Juliano1', 7, 14047.03, '2025-09-11', 'Vencido', null, null],
            ['Juliano1', 8, 14047.03, '2025-10-11', 'Vencido', null, null],
            ['Juliano1', 9, 14047.03, '2025-11-11', 'Vencido', null, null],
            ['Juliano1', 10, 14047.03, '2025-12-11', 'Vencido', null, null],
            ['Juliano1', 11, 14047.03, '2026-01-11', 'Vencido', null, null],
            ['Juliano1', 12, 14047.03, '2026-02-11', 'Vencido', null, null],
            ['Juliano1', 13, 14047.03, '2026-03-11', 'Vencido', null, null],
            ['Juliano1', 14, 14047.03, '2026-04-11', 'Vencido', null, null],
            ['Juliano1', 15, 14047.03, '2026-05-11', 'Vencido', null, null],

            ['Juliano2', 1, 12642.33, '2025-04-19', 'Vencido', null, null],
            ['Juliano2', 2, 12642.33, '2025-05-19', 'Vencido', null, null],
            ['Juliano2', 3, 12642.33, '2025-06-19', 'Vencido', null, null],
            ['Juliano2', 4, 12642.33, '2025-07-19', 'Vencido', null, null],
            ['Juliano2', 5, 12642.33, '2025-08-19', 'Vencido', null, null],
            ['Juliano2', 6, 12642.33, '2025-09-19', 'Vencido', null, null],
            ['Juliano2', 7, 12642.33, '2025-10-19', 'Vencido', null, null],
            ['Juliano2', 8, 12642.33, '2025-11-19', 'Vencido', null, null],
            ['Juliano2', 9, 12642.33, '2025-12-19', 'Vencido', null, null],
            ['Juliano2', 10, 12642.33, '2026-01-19', 'Vencido', null, null],
            ['Juliano2', 11, 12642.33, '2026-02-19', 'Vencido', null, null],
            ['Juliano2', 12, 12642.33, '2026-03-19', 'Vencido', null, null],
            ['Juliano2', 13, 12642.33, '2026-04-19', 'Vencido', null, null],
            ['Juliano2', 14, 12642.33, '2026-05-19', 'Vencido', null, null],

            ['Lucas Eng', 1, 3689.43, '2025-03-05', 'Pago', 3765.66, '2025-03-06'],
            ['Lucas Eng', 2, 3689.43, '2025-04-05', 'Pago', 3773.01, '2025-04-09'],
            ['Lucas Eng', 3, 3689.43, '2025-05-05', 'Pago', 3765.66, '2025-05-07'],
            ['Lucas Eng', 4, 3689.43, '2025-06-05', 'Pago', 4088.10, '2025-10-15'],
            ['Lucas Eng', 5, 3689.43, '2025-07-05', 'Pago', 4010.66, '2025-10-15'],
            ['Lucas Eng', 6, 3689.43, '2025-08-05', 'Vencido', null, null],
            ['Lucas Eng', 7, 3689.43, '2025-09-05', 'Vencido', null, null],
            ['Lucas Eng', 8, 3689.43, '2025-10-05', 'Vencido', null, null],
            ['Lucas Eng', 9, 3689.43, '2025-11-05', 'Vencido', null, null],
            ['Lucas Eng', 10, 3689.43, '2025-12-05', 'Vencido', null, null],
            ['Lucas Eng', 11, 3689.43, '2026-01-05', 'Vencido', null, null],
            ['Lucas Eng', 12, 3689.43, '2026-02-05', 'Vencido', null, null],
            ['Lucas Eng', 13, 3689.43, '2026-03-05', 'Vencido', null, null],
            ['Lucas Eng', 14, 3689.43, '2026-04-05', 'Vencido', null, null],
            ['Lucas Eng', 15, 3689.43, '2026-05-05', 'Vencido', null, null],

            ['Ubirajara1', 1, 200.00, '2024-09-20', 'Pago', 200.00, '2024-09-24'], 
            ['Ubirajara1', 2, 469.37, '2024-10-20', 'Pago', 469.37, '2024-10-22'],
            ['Ubirajara1', 3, 469.37, '2024-11-20', 'Pago', 469.37, '2024-11-22'],
            ['Ubirajara1', 4, 469.37, '2024-12-20', 'Pago', 521.62, '2025-01-07'],
            ['Ubirajara1', 5, 469.37, '2025-01-20', 'Pago', 539.59, '2025-02-28'],
            ['Ubirajara1', 6, 469.37, '2025-02-20', 'Pago', 562.99, '2025-04-16'],
            ['Ubirajara1', 7, 469.37, '2025-03-20', 'Pago', 495.91, '2025-04-01'],
            ['Ubirajara1', 8, 469.37, '2025-04-20', 'Pago', 506.83, '2025-05-08'],
            ['Ubirajara1', 9, 469.37, '2025-05-20', 'Pago', 494.35, '2025-06-02'],
            ['Ubirajara1', 10, 469.37, '2025-06-20', 'Pago', 489.67, '2025-06-27'],
            ['Ubirajara1', 11, 469.37, '2025-07-20', 'Pago', 486.55, '2025-07-28'],
            ['Ubirajara1', 12, 469.37, '2025-08-20', 'Pago', 538.24, '2025-10-29'],
            ['Ubirajara1', 13, 469.37, '2025-09-20', 'Pago', 528.51, '2025-10-29'],
            ['Ubirajara1', 14, 469.37, '2025-10-20', 'Vencido', null, null],
            ['Ubirajara1', 15, 469.37, '2025-11-20', 'Vencido', null, null],
            ['Ubirajara1', 16, 469.37, '2025-12-20', 'Vencido', null, null],
            ['Ubirajara1', 17, 469.37, '2026-01-20', 'Vencido', null, null],
            ['Ubirajara1', 18, 469.37, '2026-02-20', 'Vencido', null, null],
            ['Ubirajara1', 19, 469.37, '2026-03-20', 'Vencido', null, null],
            ['Ubirajara1', 20, 469.37, '2026-04-20', 'Vencido', null, null],

            ['Ubirajara2', 1, 220.70, '2025-01-13', 'Pago', 228.19, '2025-02-04'],
            ['Ubirajara2', 2, 220.70, '2025-02-13', 'Pago', 249.93, '2025-03-20'],
            ['Ubirajara2', 3, 220.70, '2025-03-13', 'Pago', 229.87, '2025-04-16'],
            ['Ubirajara2', 4, 220.70, '2025-04-13', 'Pago', 226.79, '2025-04-25'],
            ['Ubirajara2', 5, 220.70, '2025-05-13', 'Pago', 226.37, '2025-05-22'],
            ['Ubirajara2', 6, 220.70, '2025-06-13', 'Pago', 225.53, '2025-06-17'],
            ['Ubirajara2', 7, 220.70, '2025-07-13', 'Pago', 220.70, '2025-07-15'],
            ['Ubirajara2', 8, 220.70, '2025-08-13', 'Pago', 236.44, '2025-10-29'],
            ['Ubirajara2', 9, 220.70, '2025-09-13', 'Pago', 231.88, '2025-10-29'],
            ['Ubirajara2', 10, 220.70, '2025-10-13', 'Vencido', null, null],
            ['Ubirajara2', 11, 220.70, '2025-11-13', 'Vencido', null, null],
            ['Ubirajara2', 12, 220.70, '2025-12-13', 'Vencido', null, null],
            ['Ubirajara2', 13, 220.70, '2026-01-13', 'Vencido', null, null],
            ['Ubirajara2', 14, 220.70, '2026-02-13', 'Vencido', null, null],
            ['Ubirajara2', 15, 220.70, '2026-03-13', 'Vencido', null, null],
            ['Ubirajara2', 16, 220.70, '2026-04-13', 'Vencido', null, null],
            ['Ubirajara2', 17, 220.70, '2026-05-13', 'Vencido', null, null],

            ['Cleidimar', 1, 814.43, '2025-05-01', 'Vencido', null, null],
            ['Cleidimar', 2, 814.43, '2025-06-01', 'Vencido', null, null],
            ['Cleidimar', 3, 814.43, '2025-07-01', 'Vencido', null, null],
            ['Cleidimar', 4, 814.43, '2025-08-01', 'Vencido', null, null],

            ['PW', 1, 286861.03, '2025-07-30', 'Pago', 286861.03, '2025-07-30'],
            ['PW', 2, 286861.03, '2025-08-30', 'Pago', 286861.03, '2025-09-01'],
            ['PW', 3, 286861.03, '2025-09-30', 'Pago', 286861.03, '2025-09-30'],
            ['PW', 4, 286861.03, '2025-10-30', 'Pago', 286861.03, '2025-10-30'],
            ['PW', 5, 286861.03, '2025-11-30', 'Pago', 286861.03, '2025-12-01'],
            ['PW', 6, 286861.03, '2025-12-30', 'Pago', 286861.03, '2025-12-30'],
            ['PW', 7, 286861.03, '2026-01-30', 'Pago', 95620.34, '2026-01-12'],
            ['PW', 8, 286861.03, '2026-02-28', 'Vencido', null, null],
            ['PW', 9, 286861.03, '2026-03-30', 'Vencido', null, null],
            ['PW', 10, 286861.03, '2026-04-30', 'Vencido', null, null],
            ['PW', 11, 286861.03, '2026-05-30', 'A vencer', null, null],
        ];

        foreach ($fluxoParcelas as $p) {
            $contractId = $contractIds[$p[0]] ?? null;
            if ($contractId) {
                // 🚀 ETAPA A: Cria a Parcela Padrão da Agenda
                DB::table('installments')->updateOrInsert(
                    ['contractId' => $contractId, 'installmentNumber' => $p[1]],
                    [
                        'dueDate' => $p[3],
                        'originalAmount' => $p[2],
                        'status' => $p[4] === 'Pago' ? 'Pago' : 'Vencido',
                        'createdAt' => now(),
                        'updatedAt' => now()
                    ]
                );

                // Captura o ID gerado da parcela para amarrar o pagamento
                $installmentId = DB::table('installments')
                    ->where('contractId', $contractId)
                    ->where('installmentNumber', $p[1])
                    ->value('id');

                // 🚀 ETAPA B: Ingestão Real da baixa usando 'PIX' (Estritamente aceito pelo ENUM 'method' do banco)
                if ($p[4] === 'Pago' && $p[5] !== null && $p[6] !== null) {
                    DB::table('payments')->updateOrInsert(
                        ['installmentId' => $installmentId],
                        [
                            'amount' => $p[5],      // VALOR REAL PAGO DA PLANILHA
                            'paidAt' => $p[6],      // DATA REAL DE LIQUIDAÇÃO DA PLANILHA
                            'method' => 'PIX',      // 🚀 CORRIGIDO: Forçado estritamente para 'PIX' para validar o ENUM do MySQL
                            'recordedBy' => 'Carga Planilha Executiva'
                        ]
                    );
                }
            }
        }
    }
}