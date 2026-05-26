<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class LancamentosController extends Controller
{
    public function index(Request $request)
    {
        $baseDate = Carbon::now();
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter');

        // 1. CARREGA OS CONTRATOS APLICANDO OS FILTROS DA BARRA DE PESQUISA
        $contractsQuery = DB::table('contracts');

        if ($search) {
            $contractsQuery->where(function($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('contractName', 'like', "%{$search}%")
                  ->orWhere('creditor', 'like', "%{$search}%");
            });
        }

        if ($statusFilter && $statusFilter !== 'Todos') {
            $contractsQuery->where('status', $statusFilter);
        }

        $contracts = $contractsQuery->orderBy('id', 'desc')->get();

        // 2. BUSCA AS DEMAIS TABELAS PARA COMPUTAÇÃO DOS REPASSES E ENCARGOS REAIS
        $installments = DB::table('installments')->get();
        $payments = DB::table('payments')->get();
        $clients = DB::table('clients')->get();

        $clientMap = $clients->pluck('name', 'id')->toArray();

        // 3. ECOSSISTEMA DE AUDITORIA: Processa linha por linha da planilha Manus
        $processedContracts = $contracts->map(function($contract) use ($installments, $payments, $clientMap, $baseDate) {
            // Filtra faturas pertencentes a este contrato específico
            $contractInst = $installments->where('contractId', $contract->id);
            
            $paidInstallmentsCount = 0;
            $overdueInstallmentsCount = 0;
            $maxDaysOverdue = 0;
            $interestAccumulated = 0;
            $paidTotal = 0;
            $overdueTotal = 0;

            // 🚀 CORREÇÃO DA REGRA DE NEGÓCIO: Se houver parcelas físicas no banco, roda a esteira padrão
            if ($contractInst->count() > 0) {
                foreach ($contractInst as $inst) {
                    $payment = $payments->where('installmentId', $inst->id)->first();
                    $isPago = ($inst->status === 'Pago') || !is_null($payment);

                    if ($isPago) {
                        $paidInstallmentsCount++;
                        $paidTotal += (double)($payment->amount ?? $inst->originalAmount);
                    } else {
                        $dueDate = Carbon::parse($inst->dueDate);
                        
                        if ($dueDate->isBefore($baseDate)) {
                            $overdueInstallmentsCount++;
                            
                            // Força o arredondamento de dias matemáticos como inteiros limpos
                            $days = (int)ceil($dueDate->diffInDays($baseDate, false));
                            if ($days < 0) $days = 0;
                            
                            if ($days > $maxDaysOverdue) {
                                $maxDaysOverdue = $days;
                            }

                            $original = (double)$inst->originalAmount;
                            $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $days;
                            $multa = $original * ($contract->penaltyRate ?? 0.10);
                            
                            $interestAccumulated += ($mora + $multa);
                            $overdueTotal += ($original + $mora + $multa);
                        }
                    }
                }
                $openBalanceTotal = max(0, (double)$contract->financedTotal - $paidTotal) + $interestAccumulated;
            } else {
                // 🚀 FALLBACK MATEMÁTICO: Se não houver parcelas na installments para este contrato ainda
                $paidInstallmentsCount = 0;
                $paidTotal = 0;
                
                // Calcula dias de atraso comparando o primeiro vencimento com a data atual
                if ($contract->firstDueDate) {
                    $firstDue = Carbon::parse($contract->firstDueDate);
                    if ($firstDue->isBefore($baseDate)) {
                        $maxDaysOverdue = (int)ceil($firstDue->diffInDays($baseDate, false));
                        if ($maxDaysOverdue < 0) $maxDaysOverdue = 0;
                        
                        // Assume ao menos 1 parcela vencida para sinalizar visualmente
                        $overdueInstallmentsCount = 1;
                        
                        $original = (double)$contract->installmentAmount;
                        $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $maxDaysOverdue;
                        $multa = $original * ($contract->penaltyRate ?? 0.10);
                        
                        $interestAccumulated = $mora + $multa;
                        $overdueTotal = $original + $interestAccumulated;
                    } else {
                        $maxDaysOverdue = 0;
                        $overdueInstallmentsCount = 0;
                        $interestAccumulated = 0;
                        $overdueTotal = 0;
                    }
                } else {
                    $maxDaysOverdue = 0;
                    $overdueInstallmentsCount = 0;
                    $interestAccumulated = 0;
                    $overdueTotal = 0;
                }
                
                $openBalanceTotal = (double)$contract->financedTotal + $interestAccumulated;
            }

            $financedTotal = (double)$contract->financedTotal;

            return [
                'id' => $contract->id,
                'clientId' => $contract->clientId ?? null,
                'clientName' => $clientMap[$contract->clientId] ?? 'Consumidor não localizado',
                'code' => $contract->code,
                'contractName' => $contract->contractName,
                'contractDate' => $contract->contractDate,
                'firstDueDate' => $contract->firstDueDate,
                'status' => $contract->status,
                'creditor' => $contract->creditor ?? 'UnyPay® S.A.',
                'validated' => (bool)($contract->validated ?? false),
                'principalAmount' => (double)$contract->principalAmount,
                'financedTotal' => $financedTotal,
                'installmentCount' => (int)$contract->installmentCount,
                'installmentAmount' => (double)$contract->installmentAmount,
                'moraRateMonthly' => (double)($contract->moraRateMonthly ?? 0.02),
                'penaltyRate' => (double)($contract->penaltyRate ?? 0.10),
                
                // Variáveis reajustadas para alimentar reativamente a grid
                'paidInstallmentsCount' => (int)$paidInstallmentsCount,
                'overdueInstallmentsCount' => (int)$overdueInstallmentsCount,
                'maxDaysOverdue' => (int)$maxDaysOverdue,
                'paidTotal' => $paidTotal,
                'overdueTotal' => $overdueTotal,
                'openBalanceTotal' => $openBalanceTotal,
                'interestAccumulated' => $interestAccumulated,
            ];
        });

        // 4. RETORNA A VIEW RENDERIZADA VIA INERTIA ENVIANDO AS PROPS REATIVAS
        return Inertia::render('Lancamentos', [
            'contracts' => $processedContracts,
            'clients' => $clients->map(fn($c) => ['id' => $c->id, 'name' => $c->name]),
            'filters' => $request->only(['search', 'statusFilter'])
        ]);
    }
}