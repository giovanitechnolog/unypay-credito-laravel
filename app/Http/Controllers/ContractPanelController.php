<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon; // 🚀 Utilizado para o cálculo do filtro temporal das faturas
use Inertia\Inertia;
use Inertia\Response;

class ContractPanelController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->input('search');
        $situation = $request->input('situation');

        // Captura a data base atual (Hoje) com horário zerado para comparação de atrasos
        $baseDate = Carbon::now()->startOfDay();

        // 1. Query Mestre de Clientes vinculados a contratos
        $query = DB::table('contracts')
            ->join('clients', 'contracts.clientId', '=', 'clients.id')
            ->select('clients.id as client_id', 'clients.document as cnpj_cpf', 'clients.name as cliente_nome')
            ->groupBy('clients.id', 'clients.document', 'clients.name');

        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('clients.name', 'like', "%{$search}%")
                  ->orWhere('clients.document', 'like', "%{$search}%");
            });
        }

        $clients = $query->get();
        $records = [];

        // Inicializa acumuladores macros dos cards de topo (Garante sincronia 100% com as linhas)
        $faturamentoGlobal = 0;
        $pagoGlobal = 0;
        $saldoGlobal = 0;
        $atrasoGlobal = 0;

        foreach ($clients as $c) {
            $myContracts = DB::table('contracts')->where('clientId', $c->client_id)->get();
            if ($myContracts->isEmpty()) continue;

            $totalFaturamento = 0;
            $totalSaldo = 0;
            $totalPago = 0;
            $totalAtraso = 0;
            $statusGeral = 'Ativo';

            $detalhes = $myContracts->map(function($ct) use (&$totalFaturamento, &$totalSaldo, &$totalPago, &$totalAtraso, &$statusGeral, $baseDate) {
                $fat = (float)$ct->financedTotal;
                
                // Busca todas as faturas físicas cadastradas na tabela 'installments'
                $parcelas = DB::table('installments')->where('contractId', $ct->id)->get();
                
                $pago = 0;
                $saldoDev = 0;
                $atraso = 0;

                foreach ($parcelas as $p) {
                    $vlrParcela = (float)($p->originalAmount ?? 0);
                    $pStatus = trim(strtolower((string)($p->status ?? '')));
                    
                    // Verifica se a parcela está liquidada
                    $isPaga = ($pStatus === 'pago' || $pStatus === 'liquidado');

                    if ($isPaga) {
                        // 🚀 Regra 2: Total pago são todas as parcelas pagas
                        $pago += $vlrParcela;
                    } else {
                        // 🚀 Regra 1: Saldo devedor (Pendente) é tudo o que NÃO foi pago
                        $saldoDev += $vlrParcela;

                        // 🚀 Regra 3: Em atraso são todas as não pagas com vencimento anterior à data atual
                        if (!empty($p->dueDate)) {
                            try {
                                // Trata de forma segura o formato VARCHAR brasileiro (dd/mm/aaaa) vindo do seu Schema
                                $dataVencimento = str_contains($p->dueDate, '/') 
                                    ? Carbon::createFromFormat('d/m/Y', $p->dueDate)->startOfDay()
                                    : Carbon::parse($p->dueDate)->startOfDay();

                                // Se a data da parcela é estritamente menor (anterior) a hoje, ela está em atraso
                                if ($dataVencimento->isBefore($baseDate)) {
                                    $atraso += $vlrParcela;
                                }
                            } catch (\Exception $e) {
                                // Fallback caso o status do banco já esteja explicitado como vencido
                                if ($pStatus === 'vencido' || $pStatus === 'atrasado') {
                                    $atraso += $vlrParcela;
                                }
                            }
                        }
                    }
                }

                // Se a tabela de parcelas estiver vazia para o contrato de teste, roda a matemática macro de fallback
                if ($parcelas->count() === 0) {
                    if ($ct->status === 'Quitado') {
                        $pago = $fat;
                        $saldoDev = 0;
                        $atraso = 0;
                    } else {
                        $saldoDev = $ct->principalAmount > 0 ? (float)$ct->principalAmount : $fat;
                        $pago = max(0, $fat - $saldoDev);
                        
                        if ($ct->status === 'Em Atraso') {
                            $atraso = $saldoDev;
                        }
                    }
                }

                // Acumuladores locais da linha do Cliente
                $totalFaturamento += $fat;
                $totalPago += $pago;
                $totalSaldo += $saldoDev;
                $totalAtraso += $atraso;

                $ctStatus = $ct->status;
                if ($atraso > 0) {
                    $ctStatus = 'Em Atraso';
                    $statusGeral = 'Em Atraso';
                } elseif ($saldoDev == 0 && $fat > 0) {
                    $ctStatus = 'Quitado';
                }

                return [
                    'id' => $ct->id,
                    'code' => $ct->code,
                    'tipo' => $ct->contractType ?? 'Consignado',
                    'descricao' => 'Contrato ID: ' . $ct->code . ($ct->guarantees ? ' • ' . $ct->guarantees : ''),
                    'dt_emissao' => $ct->contractDate,
                    'dt_vencimento' => $ct->firstDueDate,
                    'vlr_compra' => $fat,
                    'vlr_pago' => $pago,
                    'saldo_dev' => $saldoDev, // Exibe o total pendente real do contrato
                    'em_atraso' => $atraso,   // Exibe apenas as faturas vencidas anteriores a hoje
                    'status' => $ctStatus
                ];
            });

            // Filtros de situação da interface
            if ($situation && $situation !== 'Todas') {
                if ($situation === 'Em Atraso' && $totalAtraso == 0) continue;
                if ($situation === 'Quitado' && $totalSaldo > 0) continue;
                if ($situation === 'Ativo' && $statusGeral === 'Em Atraso') continue;
            }

            // Acumula nos totais dos Cards baseado estritamente no que foi faturado e tratado nas linhas
            $faturamentoGlobal += $totalFaturamento;
            $pagoGlobal += $totalPago;
            $saldoGlobal += $totalSaldo;
            $atrasoGlobal += $totalAtraso;

            $records[] = [
                'client_id' => $c->client_id,
                'cliente_nome' => $c->cliente_nome,
                'cnpj_cpf' => $c->cnpj_cpf,
                'qtd_contratos' => $myContracts->count(),
                'total_faturamento' => $totalFaturamento,
                'saldo_devedor' => $totalSaldo,    // Total Pendente Consolidado do Cliente
                'total_pago' => $totalPago,        // Total Pago Consolidado do Cliente
                'em_atraso' => $totalAtraso,        // Total Em Atraso Consolidado do Cliente
                'prox_vencimento' => $myContracts->min('firstDueDate'),
                'pct_pago' => $totalFaturamento > 0 ? round(($totalPago / $totalFaturamento) * 100, 1) : 0,
                'pct_saldo' => $totalFaturamento > 0 ? round(($totalSaldo / $totalFaturamento) * 100, 1) : 100,
                'situacao_geral' => $totalAtraso > 0 ? 'Em Atraso' : ($totalSaldo == 0 ? 'Quitado' : 'Ativo'),
                'contratos_detalhe' => $detalhes
            ];
        }

        // Montagem final matemática espelhada dos Cards Superiores
        $cards = [
            'clientes_qtd' => count($records),
            'faturamento_global' => $faturamentoGlobal,
            'pago_global' => $pagoGlobal,
            'saldo_global' => $saldoGlobal,    // Card reflete a soma de todos os saldos pendentes na tela
            'atraso_global' => $atrasoGlobal,  // Card reflete a soma de todas as parcelas vencidas na tela
        ];

        return Inertia::render('ContractPanel', [
            'records' => $records,
            'cards' => $cards,
            'filters' => $request->only(['search', 'situation'])
        ]);
    }
}