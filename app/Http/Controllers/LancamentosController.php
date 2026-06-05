<?php

namespace App\Http\Controllers;

use App\Exports\LancamentosExport;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class LancamentosController extends Controller
{
    public function index(Request $request)
    {
        $processedContracts = $this->buildProcessedContracts($request);

        $clients = DB::table('clients')->get();

        return Inertia::render('Lancamentos', [
            'contracts' => $processedContracts,
            'clients' => $clients->map(fn ($c) => ['id' => $c->id, 'name' => $c->name]),
            'filters' => $request->only(['search', 'statusFilter']),
        ]);
    }

    public function export(Request $request)
    {
        $rows = $this->buildProcessedContracts($request);

        return Excel::download(new LancamentosExport($rows), 'lancamentos.xlsx');
    }

    private function buildProcessedContracts(Request $request): Collection
    {
        $baseDate = Carbon::now();
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter');
        $clientFilter = $request->input('clientFilter');

        $contractsQuery = DB::table('contracts');

        if ($search) {
            $contractsQuery->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('contractName', 'like', "%{$search}%")
                    ->orWhere('creditor', 'like', "%{$search}%");
            });
        }

        if ($statusFilter && $statusFilter !== 'Todos') {
            $contractsQuery->where('status', $statusFilter);
        }

        if ($clientFilter && $clientFilter !== 'Todos') {
            $contractsQuery->where('clientId', $clientFilter);
        }

        $contracts = $contractsQuery->orderBy('id', 'desc')->get();

        $installments = DB::table('installments')->get();
        $payments = DB::table('payments')->get();
        $clients = DB::table('clients')->get();

        $clientMap = $clients->pluck('name', 'id')->toArray();

        // 🔗 Hidratação dos credores (consignors) vinculados via contracts.consignorId.
        //    Buscamos só os ids referenciados pelos contratos exibidos para evitar
        //    trazer toda a tabela quando a base crescer.
        $consignorIds = $contracts
            ->pluck('consignorId')
            ->filter()
            ->unique()
            ->values();

        $consignorMap = $consignorIds->isNotEmpty()
            ? DB::table('consignors')
                ->whereIn('id', $consignorIds)
                ->pluck('name', 'id')
                ->toArray()
            : [];

        return $contracts->map(function ($contract) use ($installments, $payments, $clientMap, $consignorMap, $baseDate) {
            $contractInst = $installments->where('contractId', $contract->id);

            $paidInstallmentsCount = 0;
            $overdueInstallmentsCount = 0;
            $maxDaysOverdue = 0;
            $interestAccumulated = 0;
            $paidTotal = 0;
            $overdueTotal = 0;

            if ($contractInst->count() > 0) {
                foreach ($contractInst as $inst) {
                    $payment = $payments->where('installmentId', $inst->id)->first();
                    $isPago = ($inst->status === 'Pago') || ! is_null($payment);

                    if ($isPago) {
                        $paidInstallmentsCount++;
                        $paidTotal += (float) ($payment->amount ?? $inst->originalAmount);
                    } else {
                        $dueDate = Carbon::parse($inst->dueDate);

                        if ($dueDate->isBefore($baseDate)) {
                            $overdueInstallmentsCount++;

                            $days = (int) ceil($dueDate->diffInDays($baseDate, false));
                            if ($days < 0) {
                                $days = 0;
                            }

                            if ($days > $maxDaysOverdue) {
                                $maxDaysOverdue = $days;
                            }

                            $original = (float) $inst->originalAmount;
                            $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $days;
                            $multa = $original * ($contract->penaltyRate ?? 0.10);

                            $interestAccumulated += ($mora + $multa);
                            $overdueTotal += ($original + $mora + $multa);
                        }
                    }
                }
                $openBalanceTotal = max(0, (float) $contract->financedTotal - $paidTotal) + $interestAccumulated;
            } else {
                $paidInstallmentsCount = 0;
                $paidTotal = 0;

                if ($contract->firstDueDate) {
                    $firstDue = Carbon::parse($contract->firstDueDate);
                    if ($firstDue->isBefore($baseDate)) {
                        $maxDaysOverdue = (int) ceil($firstDue->diffInDays($baseDate, false));
                        if ($maxDaysOverdue < 0) {
                            $maxDaysOverdue = 0;
                        }

                        $overdueInstallmentsCount = 1;

                        $original = (float) $contract->installmentAmount;
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

                $openBalanceTotal = (float) $contract->financedTotal + $interestAccumulated;
            }

            $financedTotal = (float) $contract->financedTotal;

            return [
                'id' => $contract->id,
                'clientId' => $contract->clientId ?? null,
                'clientName' => $clientMap[$contract->clientId] ?? 'Consumidor não localizado',
                'code' => $contract->code,
                'contractName' => $contract->contractName,
                'contractType' => $contract->contractType ?? 'Outro',
                'contractDate' => $contract->contractDate,
                'firstDueDate' => $contract->firstDueDate,
                'status' => $contract->status,
                // Mantemos o campo legado por compatibilidade com export/relatórios.
                'creditor' => $contract->creditor ?? 'UnyPay® S.A.',
                // ✅ Credor formal (relação contracts.consignorId → consignors.name).
                'consignorId' => $contract->consignorId ?? null,
                'consignorName' => $consignorMap[$contract->consignorId] ?? null,
                'validated' => (bool) ($contract->validated ?? false),
                'principalAmount' => (float) $contract->principalAmount,
                'financedTotal' => $financedTotal,
                'installmentCount' => (int) $contract->installmentCount,
                'installmentAmount' => (float) $contract->installmentAmount,
                'moraRateMonthly' => (float) ($contract->moraRateMonthly ?? 0.02),
                'penaltyRate' => (float) ($contract->penaltyRate ?? 0.10),
                'paidInstallmentsCount' => (int) $paidInstallmentsCount,
                'overdueInstallmentsCount' => (int) $overdueInstallmentsCount,
                'maxDaysOverdue' => (int) $maxDaysOverdue,
                'paidTotal' => $paidTotal,
                'overdueTotal' => $overdueTotal,
                'openBalanceTotal' => $openBalanceTotal,
                'interestAccumulated' => $interestAccumulated,
            ];
        });
    }
}
