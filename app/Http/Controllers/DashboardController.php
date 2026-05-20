<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Carbon\Carbon;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $baseDate = Carbon::now();

        // 1. CARREGA DADOS BRUTOS DO BANCO DE DADOS
        $contracts = DB::table('contracts')->get();
        $installments = DB::table('installments')->get();
        $payments = DB::table('payments')->get();
        $clients = DB::table('clients')->get();

        // Mapa auxiliar de nomes de clientes para uso em relatórios
        $clientMap = $clients->pluck('name', 'id')->toArray();

        // 2. CÁLCULO DE JUROS REAIS E RESUMO POR CONTRATO (EXTRATO PRICE/MANUS)
        $interestTable = $contracts->map(function($contract) use ($installments, $baseDate) {
            $contractInst = $installments->where('contractId', $contract->id);
            
            $totalInterest = 0;
            foreach ($contractInst as $inst) {
                if ($inst->status === 'Pago') {
                    continue;
                }
                
                $dueDate = Carbon::parse($inst->dueDate);
                if ($dueDate->isBefore($baseDate)) {
                    $days = $dueDate->diffInDays($baseDate);
                    $original = (double)($inst->originalAmount ?? $contract->installmentAmount);
                    
                    // Fórmulas exatas do seu contrato (Mora e Multa)
                    $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $days;
                    $multa = $original * ($contract->penaltyRate ?? 0.10);
                    $totalInterest += ($mora + $multa);
                }
            }

            $principal = (double)$contract->principalAmount;
            $financed = (double)$contract->financedTotal;
            $totalPayable = $financed + $totalInterest;
            $interestPct = $principal > 0 ? ($totalInterest / $principal) * 100 : 0;

            return [
                'contractId' => $contract->id,
                'code' => $contract->code,
                'status' => $contract->status,
                'clientId' => $contract->clientId ?? null,
                'principal' => $principal,
                'financed' => $financed,
                'totalInterest' => $totalInterest,
                'totalPayable' => $totalPayable,
                'interestPct' => $interestPct
            ];
        });

        // Agregadores Gerais de KPI básicos
        $totalPrincipal = $contracts->sum('principalAmount');
        $totalFinanced = $contracts->sum('financedTotal');
        $totalPaid = $payments->sum('amount');
        
        // ── 💡 LOGICA: VARREDURA CRONOLÓGICA VIRTUAL DE INADIMPLÊNCIA ──
        $totalOverdue = 0;
        $overdueCount = 0;
        
        // Estrutura para consolidar parcelas vencidas encontradas por mês para a tabela detalhada
        $virtualOverdueDetails = [];

        foreach ($contracts as $contract) {
            // Ignora contratos quitados ou cancelados
            if (in_array($contract->status, ['Quitado', 'Cancelado'])) {
                continue;
            }

            $totalCount = (int)($contract->installmentCount ?? 12);
            $firstDue = Carbon::parse($contract->firstDueDate ?? $contract->contractDate ?? now()->toDateString());
            $installmentAmount = (double)($contract->installmentAmount ?? 0);

            // Fallback caso o valor da parcela não esteja preenchido
            if ($installmentAmount <= 0 && $totalCount > 0) {
                $installmentAmount = (double)$contract->financedTotal / $totalCount;
            }

            // Filtra o que já existe fisicamente para este contrato no banco
            $contractPhysicalInst = $installments->where('contractId', $contract->id);

            // Projeta e percorre o cronograma teórico completo do contrato mês a mês
            for ($i = 1; $i <= $totalCount; $i++) {
                $theoreticalDueDate = $firstDue->copy()->addMonths($i - 1);

                // Se a data de vencimento projetada já passou em relação a hoje
                if ($theoreticalDueDate->isBefore($baseDate)) {
                    
                    // Procura se existe registro físico marcado como Pago na installments
                    $physicalInst = $contractPhysicalInst->where('installmentNumber', $i)->first();
                    
                    if ($physicalInst) {
                        if ($physicalInst->status === 'Pago') {
                            continue; // Já está liquidada no banco de dados, ignora
                        }
                        $originalAmount = (double)$physicalInst->originalAmount;
                        $instId = $physicalInst->id;
                    } else {
                        // Se não existir fisicamente, checa se há algum recibo avulso na payments
                        $hasPayment = $payments->where('installmentId', $i)->where('contractId', $contract->id)->isNotEmpty();
                        if ($hasPayment) {
                            continue; 
                        }
                        $originalAmount = $installmentAmount;
                        $instId = $i; // Fallback do contador da iteração virtual
                    }

                    // Se passou por todas as validações, a parcela está de fato vencida!
                    $overdueCount++;
                    $daysOverdue = $theoreticalDueDate->diffInDays($baseDate);

                    // Cálculos dinâmicos da Planilha Manus (Sem dados chumbados)
                    $moraRateDaily = ($contract->moraRateMonthly ?? 0.02) / 30;
                    $moraAmount = $originalAmount * $moraRateDaily * $daysOverdue;
                    $penaltyAmount = $originalAmount * ($contract->penaltyRate ?? 0.10);

                    // Acumula o valor total atualizado da inadimplência
                    $totalOverdue += ($originalAmount + $moraAmount + $penaltyAmount);

                    // Guarda em uma coleção para o filtro dinâmico de Inadimplência por Mês
                    $virtualOverdueDetails[] = [
                        'installmentId'     => $instId,
                        'contractId'        => $contract->id,
                        'contractCode'      => $contract->code,
                        'installmentNumber' => $i,
                        'dueDate'           => $theoreticalDueDate->toDateString(),
                        'originalAmount'    => $originalAmount,
                        'totalWithInterest' => ($originalAmount + $moraAmount + $penaltyAmount)
                    ];
                }
            }
        }

        // ── 🔄 RESOLUÇÃO DO ERRO: Inicializa explicitamente a variável somando os juros reais gerados ──
        $totalInterestReal = $interestTable->sum('totalInterest');
        $totalPayableReal = $interestTable->sum('totalPayable');

        $kpis = [
            'totalPrincipal'       => $totalPrincipal,
            'totalFinanced'        => $totalFinanced,
            'totalPaid'            => $totalPaid,
            'totalOverdue'         => $totalOverdue, 
            'totalContracts'       => $contracts->count(),
            'totalClients'         => $clients->count(),
            'totalInstallments'    => $installments->count(),
            'paidInstallments'     => $installments->where('status', 'Pago')->count(),
            'overdueInstallments'  => $overdueCount, 
            'pendingInstallments'  => $installments->where('status', 'A vencer')->count(),
            'totalPending'         => $totalFinanced - $totalPaid,
            'activeContracts'      => $contracts->where('status', 'Ativo')->count(),
            'inadimplentContracts' => $contracts->where('status', 'Inadimplente')->count(),
            'quitadoContracts'     => $contracts->where('status', 'Quitado')->count(),
            'validatedContracts'   => $contracts->where('validated', true)->count(),
            'totalPaymentsCount'   => $payments->count(),
            'pctPaid'              => $totalFinanced > 0 ? ($totalPaid / $totalFinanced) * 100 : 0,
            'pctOverdue'           => $totalFinanced > 0 ? ($totalOverdue / $totalFinanced) * 100 : 0,
            'pctInterest'          => $totalPrincipal > 0 ? ($totalInterestReal / $totalPrincipal) * 100 : 0,
        ];

        // 3. EVOLUÇÃO CRONOLÓGICA MENSAL HISTÓRICA (GRÁFICO MULTI-LINHA RECHARTS)
        $monthlyEvolution = [];
        for ($i = 11; $i >= 0; $i--) {
            $monthObj = Carbon::now()->subMonths($i);
            $monthKey = $monthObj->format('Y-m');

            // Filtra pagamentos efetuados dentro do mês da iteração
            $mPayments = $payments->filter(fn($p) => substr($p->paidAt, 0, 7) === $monthKey);
            
            // Filtra a inadimplência projetada ou física que pertence a este respectivo mês
            $mOverdueAmount = collect($virtualOverdueDetails)
                ->filter(fn($row) => substr($row['dueDate'], 0, 7) === $monthKey)
                ->sum('totalWithInterest');

            $mOverdueCount = collect($virtualOverdueDetails)
                ->filter(fn($row) => substr($row['dueDate'], 0, 7) === $monthKey)
                ->count();

            $monthlyEvolution[] = [
                'month'         => $monthKey,
                'totalPaid'     => $mPayments->sum('amount'),
                'newPrincipal'  => $contracts->filter(fn($c) => substr($c->createdAt, 0, 7) === $monthKey)->sum('principalAmount'),
                'overdueAmount' => $mOverdueAmount,
                'paymentCount'  => $mPayments->count(),
                'overdueCount'  => $mOverdueCount,
            ];
        }

        // Filtro da Tabela Dinâmica Inferior de Inadimplência por Mês
        $selectedMonth = $request->input('month');
        $overdueByMonthList = [];
        
        if ($selectedMonth) {
            $overdueByMonthList = collect($virtualOverdueDetails)
                ->filter(fn($row) => substr($row['dueDate'], 0, 7) === $selectedMonth)
                ->values()
                ->toArray();
        } else {
            // Fallback padrão: mostra as 20 parcelas com maior tempo de atraso na carteira geral
            $overdueByMonthList = collect($virtualOverdueDetails)
                ->sortBy('dueDate')
                ->slice(0, 20)
                ->values()
                ->toArray();
        }

        return Inertia::render('Dashboard', [
            'kpis'             => $kpis,
            'monthlyEvolution' => $monthlyEvolution,
            'interestTable'    => $interestTable->map(function($c) use ($clientMap) {
                $c['clientName'] = $clientMap[$c['clientId']] ?? '—';
                return $c;
            })->toArray(),
            'overdueByMonth'   => $overdueByMonthList,
            'filters'          => $request->only(['month'])
        ]);
    }
}