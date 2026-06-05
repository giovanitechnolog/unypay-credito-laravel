<?php

namespace App\Http\Controllers;

use App\Exports\PaymentsExport;
use App\Models\Contract;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter', 'Todos');

        $contracts = $this->buildFilteredContractsQuery($request)->get();

        $interestTable = $contracts->map(fn ($contract) => $this->computeContractInterestSummary($contract));

        return Inertia::render('Payments', [
            'contracts' => $contracts->map(function ($c) {
                return [
                    'contract' => $c,
                    'clientName' => $c->client ? $c->client->name : '—'
                ];
            }),
            'interestData' => $interestTable,
            'filters' => $request->only(['search', 'statusFilter'])
        ]);
    }

    public function export(Request $request): BinaryFileResponse
    {
        $rows = $this->buildPaymentsForExport($request);

        return Excel::download(new PaymentsExport($rows), 'pagamentos.xlsx');
    }

    private function buildFilteredContractsQuery(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter', 'Todos');

        $query = Contract::with(['client', 'consignor:id,name']);

        if ($statusFilter && $statusFilter !== 'Todos') {
            $query->where('status', $statusFilter);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('contractName', 'like', "%{$search}%")
                    ->orWhereHas('client', function ($c) use ($search) {
                        $c->where('name', 'like', "%{$search}%");
                    });
            });
        }

        return $query->latest('createdAt');
    }

    private function buildPaymentsForExport(Request $request): Collection
    {
        return $this->buildFilteredContractsQuery($request)
            ->get()
            ->map(function (Contract $contract) {
                $summary = $this->computeContractInterestSummary($contract);

                return [
                    'code' => $contract->code,
                    'clientName' => $contract->client?->name ?? '—',
                    'contractDate' => $contract->contractDate,
                    'creditorName' => $contract->consignor?->name ?? $contract->creditor ?? '—',
                    'principalAmount' => (float) $contract->principalAmount,
                    'financedTotal' => (float) $contract->financedTotal,
                    'installmentCount' => (int) $contract->installmentCount,
                    'installmentAmount' => (float) $contract->installmentAmount,
                    'paidInstallments' => $summary['paidInstallments'],
                    'overdueInstallments' => $summary['overdueInstallments'],
                    'maxDaysOverdue' => $summary['maxDaysOverdue'],
                    'toReceive' => $summary['remainingBalance'] + $summary['totalInterest'],
                    'totalInterest' => $summary['totalInterest'],
                    'cetMonthly' => $summary['cetMonthly'],
                    'status' => $contract->status,
                    'firstDueDate' => $contract->firstDueDate,
                ];
            });
    }

    /** @return array<string, float|int> */
    private function computeContractInterestSummary(Contract $contract): array
    {
        $baseDate = Carbon::now();

        $installments = DB::table('installments')
            ->where('contractId', $contract->id)
            ->get();

        $paidCount = $installments->where('status', 'Pago')->count();

        $overdueInstallments = $installments->filter(function ($inst) use ($baseDate) {
            return $inst->status !== 'Pago' && Carbon::parse($inst->dueDate)->isBefore($baseDate);
        });

        $maxDays = 0;
        $totalInterest = 0;

        if ($installments->count() > 0) {
            foreach ($overdueInstallments as $inst) {
                $days = (int) ceil(Carbon::parse($inst->dueDate)->diffInDays($baseDate, false));
                if ($days < 0) {
                    $days = 0;
                }

                if ($days > $maxDays) {
                    $maxDays = $days;
                }

                $original = (float) $inst->originalAmount;
                $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $days;
                $multa = $original * ($contract->penaltyRate ?? 0.10);
                $totalInterest += ($mora + $multa);
            }

            $remainingBalance = $installments->where('status', '!=', 'Pago')->sum('originalAmount');
            $overdueCount = $overdueInstallments->count();
        } else {
            $remainingBalance = (float) $contract->financedTotal;

            if ($contract->firstDueDate) {
                $firstDue = Carbon::parse($contract->firstDueDate);
                if ($firstDue->isBefore($baseDate)) {
                    $maxDays = (int) ceil($firstDue->diffInDays($baseDate, false));
                    if ($maxDays < 0) {
                        $maxDays = 0;
                    }

                    $overdueCount = 1;

                    $original = (float) $contract->installmentAmount;
                    $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $maxDays;
                    $multa = $original * ($contract->penaltyRate ?? 0.10);
                    $totalInterest = ($mora + $multa);
                } else {
                    $maxDays = 0;
                    $overdueCount = 0;
                    $totalInterest = 0;
                }
            } else {
                $maxDays = 0;
                $overdueCount = 0;
                $totalInterest = 0;
            }
        }

        return [
            'contractId' => $contract->id,
            'paidInstallments' => $paidCount,
            'overdueInstallments' => $overdueCount ?? 0,
            'maxDaysOverdue' => (int) $maxDays,
            'remainingBalance' => (float) $remainingBalance,
            'totalInterest' => (float) $totalInterest,
            'cetMonthly' => $contract->monthlyInterestRate > 0 ? (float) $contract->monthlyInterestRate : 0.025,
        ];
    }

   public function getSchedule(Request $request, int $contractId)
    {
        $contract = Contract::findOrFail($contractId);
        $baseDate = Carbon::parse($request->input('baseDate', now()->toDateString()));
        
        $dbInstallments = DB::table('installments')
            ->where('contractId', $contractId)
            ->orderBy('installmentNumber', 'asc')
            ->get();

        $scheduleRows = [];
        $totalCount = (int)$contract->installmentCount;
        $firstDue = Carbon::parse($contract->firstDueDate ?? now()->toDateString());

        for ($i = 1; $i <= $totalCount; $i++) {
            $dbInst = $dbInstallments->where('installmentNumber', $i)->first();
            
            $dueDate = $dbInst ? Carbon::parse($dbInst->dueDate) : $firstDue->copy()->addMonths($i - 1);
            $originalAmount = $dbInst ? (double)$dbInst->originalAmount : (double)$contract->installmentAmount;
            
            $installmentIdForAction = $dbInst ? $dbInst->id : $i;
            $paymentRow = null;
            
            // 🚀 BUSCA DE PAGAMENTO CALIBRADA E BLINDADA
            if ($dbInst) {
                $paymentRow = DB::table('payments')
                    ->where('installmentId', $dbInst->id)
                    ->first();
            } else {
                $paymentRow = DB::table('payments')
                    ->join('installments', 'payments.installmentId', '=', 'installments.id')
                    ->where('installments.contractId', $contractId)
                    ->where('installments.installmentNumber', $i)
                    ->select('payments.*')
                    ->first();
            }

            // 🚀 CORREÇÃO CRÍTICA DA TRAVA LOGICAL:
            // Compara usando strtolower para aceitar 'Pago', 'pago' ou a existência real do recibo na tabela payments
            $isDbPago = $dbInst && (strtolower(trim($dbInst->status)) === 'pago');
            $isPago = $isDbPago || !is_null($paymentRow);
            
            $isOverdue = !$isPago && $dueDate->isBefore($baseDate);
            
            $daysOverdue = $isOverdue ? (int)ceil($dueDate->diffInDays($baseDate, false)) : 0;
            if ($daysOverdue < 0) {
                $daysOverdue = 0;
            }
            
            $moraRateDaily = ($contract->moraRateMonthly ?? 0.02) / 30;
            $moraAmount = $daysOverdue > 0 ? ($originalAmount * $moraRateDaily * $daysOverdue) : 0;
            $penaltyAmount = $daysOverdue > 0 ? ($originalAmount * ($contract->penaltyRate ?? 0.10)) : 0;
            $ipcaCorrection = $daysOverdue > 30 ? ($originalAmount * 0.005) : 0;
            
            $updatedAmount = $originalAmount + $ipcaCorrection + $moraAmount + $penaltyAmount;

            $scheduleRows[] = [
                'installmentId' => $installmentIdForAction,
                'installmentNumber' => $i,
                'dueDate' => $dueDate->toDateString(),
                'originalAmount' => $originalAmount,
                // Força o status correto baseado na conferência exata
                'status' => $isPago ? 'Pago' : ($isOverdue ? 'Vencido' : 'A vencer'),
                'paidAmount' => $isPago ? (double)($paymentRow->amount ?? $originalAmount) : 0,
                'openBalance' => $isPago ? 0 : $updatedAmount,
                'daysOverdue' => (int)$daysOverdue,
                'ipcaCorrection' => $isPago ? 0 : $ipcaCorrection,
                'moraAmount' => $isPago ? 0 : $moraAmount,
                'penaltyAmount' => $isPago ? 0 : $penaltyAmount,
                'updatedAmount' => $isPago ? (double)($paymentRow->amount ?? $originalAmount) : $updatedAmount,
                'isAccelerated' => $contract->accelerates && $isOverdue,
                'payments' => $isPago ? [['paidAt' => $paymentRow->paidAt ?? ($dbInst->updatedAt ?? $dueDate->toDateString())]] : []
            ];
        }

        $totalPaid = collect($scheduleRows)->where('status', 'Pago')->sum('paidAmount');

        return response()->json([
            'schedule' => $scheduleRows,
            'totals' => [
                'totalPaid' => $totalPaid
            ]
        ]);
    }

    public function recordPayment(Request $request)
    {
        $request->validate([
            'installmentId' => 'required', // Número da parcela ou ID real da tabela
            'contractId'    => 'required|integer', // Tornou-se obrigatório para amarrar o escopo correto
            'amount'        => 'required|numeric',
            'paidAt'        => 'required|string|max:10',
            'method'        => 'required|string',
        ]);

        DB::transaction(function() use ($request) {
            $contractId = $request->contractId;
            $installmentNumber = $request->installmentId;

            // 🚀 CORREÇÃO DE SEGURANÇA CONTRA ID FANTASMA '1':
            // Buscamos se a combinação de número da parcela + contrato já existe no banco físico
            $dbInstallment = DB::table('installments')
                ->where('contractId', $contractId)
                ->where('installmentNumber', $installmentNumber)
                ->first();

            if (!$dbInstallment) {
                // Se a parcela não existia fisicamente, ela é criada agora vinculada ao contrato correto
                $installmentId = DB::table('installments')->insertGetId([
                    'contractId'        => $contractId,
                    'installmentNumber' => $installmentNumber, 
                    'dueDate'           => $request->paidAt, 
                    'originalAmount'    => $request->amount,
                    'status'            => 'Pago', 
                    'createdAt'         => now()
                ]);
            } else {
                // Se já existia, pegamos a PK verdadeira (id auto_increment) gerada pelo MySQL
                $installmentId = $dbInstallment->id;
                
                DB::table('installments')
                    ->where('id', $installmentId)
                    ->update([
                        'status' => 'Pago',
                        'updatedAt' => now()
                    ]);
            }
            
            // Gravação limpa na tabela payments garantindo a FK perfeita da auditoria
            DB::table('payments')->insert([
                'installmentId' => $installmentId, // 👈 Nunca mais grava '1' de forma genérica
                'amount'        => $request->amount,
                'paidAt'        => $request->paidAt,
                'method'        => $request->method,
                'user_id'       => Auth::id(), 
                'recordedBy'    => Auth::check() ? Auth::user()->name : 'Sistema', 
            ]);
        });

        return redirect()->back();
    }
}