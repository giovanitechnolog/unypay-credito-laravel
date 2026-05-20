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

            foreach ($contractInst as $inst) {
                // Captura se há registro real de recebimento na tabela payments
                $payment = $payments->where('installmentId', $inst->id)->first();
                $isPago = ($inst->status === 'Pago') || !is_null($payment);

                if ($isPago) {
                    $paidInstallmentsCount++;
                    $paidTotal += (double)($payment->amount ?? $inst->originalAmount);
                } else {
                    $dueDate = Carbon::parse($inst->dueDate);
                    
                    if ($dueDate->isBefore($baseDate)) {
                        $overdueInstallmentsCount++;
                        $days = $dueDate->diffInDays($baseDate);
                        
                        if ($days > $maxDaysOverdue) {
                            $maxDaysOverdue = $days;
                        }

                        // Aplicação matemática pura das taxas nativas salvas no contrato
                        $original = (double)$inst->originalAmount;
                        $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $days;
                        $multa = $original * ($contract->penaltyRate ?? 0.10);
                        
                        $interestAccumulated += ($mora + $multa);
                        $overdueTotal += ($original + $mora + $multa);
                    }
                }
            }

            $financedTotal = (double)$contract->financedTotal;
            $openBalanceTotal = max(0, $financedTotal - $paidTotal) + $interestAccumulated;

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
                
                // Variáveis calculadas que alimentam as colunas da planilha e os 5 cards
                'paidInstallmentsCount' => $paidInstallmentsCount,
                'overdueInstallmentsCount' => $overdueInstallmentsCount,
                'maxDaysOverdue' => $maxDaysOverdue,
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