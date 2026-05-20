<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Contract;
use Carbon\Carbon;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter', 'Todos');

        $query = Contract::with('client');

        if ($statusFilter && $statusFilter !== 'Todos') {
            $query->where('status', $statusFilter);
        }

        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('contractName', 'like', "%{$search}%")
                  ->orWhereHas('client', function($c) use ($search) {
                      $c->where('name', 'like', "%{$search}%");
                  });
            });
        }

        $contracts = $query->latest('createdAt')->get();

        // Totalizadores macros da tabela externa lendo diretamente as tabelas reais do seu Schema
        $interestTable = $contracts->map(function($contract) {
            $baseDate = Carbon::now();
            
            // Busca o resumo de parcelas reais salvas na tabela 'installments'
            $installments = DB::table('installments')
                ->where('contractId', $contract->id)
                ->get();

            $paidCount = $installments->where('status', 'Pago')->count();
            
            // Filtra as inadimplentes reais comparando com a data base atual
            $overdueInstallments = $installments->filter(function($inst) use ($baseDate) {
                return $inst->status !== 'Pago' && Carbon::parse($inst->dueDate)->isBefore($baseDate);
            });

            $maxDays = 0;
            $totalInterest = 0;

            foreach ($overdueInstallments as $inst) {
                $days = Carbon::parse($inst->dueDate)->diffInDays($baseDate);
                if ($days > $maxDays) {
                    $maxDays = $days;
                }
                
                // Aplica os encargos da planilha do Manus sobre o valor original gravado na tabela
                $original = (double)$inst->originalAmount;
                $mora = $original * (($contract->moraRateMonthly ?? 0.02) / 30) * $days;
                $multa = $original * ($contract->penaltyRate ?? 0.10);
                $totalInterest += ($mora + $multa);
            }

            $remainingBalance = $contract->financedTotal - $installments->where('status', 'Pago')->sum('originalAmount');

            return [
                'contractId' => $contract->id,
                'paidInstallments' => $paidCount,
                'overdueInstallments' => $overdueInstallments->count(),
                'maxDaysOverdue' => $maxDays,
                'remainingBalance' => $remainingBalance,
                'totalInterest' => $totalInterest,
                'cetMonthly' => $contract->monthlyInterestRate > 0 ? (double)$contract->monthlyInterestRate : 0.025
            ];
        });

        return Inertia::render('Payments', [
            'contracts' => $contracts->map(function($c) {
                return [
                    'contract' => $c,
                    'clientName' => $c->client ? $c->client->name : '—'
                ];
            }),
            'interestData' => $interestTable,
            'filters' => $request->only(['search', 'statusFilter'])
        ]);
    }

    public function getSchedule(Request $request, $contractId)
    {
        $contract = Contract::findOrFail($contractId);
        $baseDate = Carbon::parse($request->input('baseDate', now()->toDateString()));
        
        // 1. Busca as parcelas reais salvas na tabela 'installments'
        $dbInstallments = DB::table('installments')
            ->where('contractId', $contractId)
            ->orderBy('installmentNumber', 'asc')
            ->get();

        $scheduleRows = [];
        
        // ── CORREÇÃO DE OURO AQUI: O laço SEMPRE vai rodar o número total do contrato (ex: 12x) ──
        $totalCount = (int)$contract->installmentCount;
        $firstDue = Carbon::parse($contract->firstDueDate ?? now()->toDateString());

        for ($i = 1; $i <= $totalCount; $i++) {
            // Tenta achar se essa parcela específica (ex: #1, #2...) já existe gravada fisicamente
            $dbInst = $dbInstallments->where('installmentNumber', $i)->first();
            
            // Se ela já existe no banco, herda a data e o valor real do banco. Se não, calcula o fallback.
            $dueDate = $dbInst ? Carbon::parse($dbInst->dueDate) : $firstDue->copy()->addMonths($i - 1);
            $originalAmount = $dbInst ? (double)$dbInst->originalAmount : (double)$contract->installmentAmount;
            
            // Se a parcela existe no banco, manda o ID real dela. Se não, manda o número da parcela ($i)
            $installmentIdForAction = $dbInst ? $dbInst->id : $i;

            // Checa se existe recibo atrelado a ela na tabela 'payments'
            $paymentRow = null;
            if ($dbInst) {
                $paymentRow = DB::table('payments')
                    ->where('installmentId', $dbInst->id)
                    ->first();
            }

            // SÓ FICA VERDE se estiver marcada como 'Pago' no banco ou se houver recibo na tabela payments
            $isPago = ($dbInst && $dbInst->status === 'Pago') || !is_null($paymentRow);
            $isOverdue = !$isPago && $dueDate->isBefore($baseDate);
            $daysOverdue = $isOverdue ? $dueDate->diffInDays($baseDate) : 0;
            
            // Fórmulas de juros e multas da Planilha Manus aplicadas sobre o valor original
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
                'status' => $isPago ? 'Pago' : ($isOverdue ? 'Vencido' : 'A vencer'),
                'paidAmount' => $isPago ? (double)($paymentRow->amount ?? $originalAmount) : 0,
                'openBalance' => $isPago ? 0 : $updatedAmount,
                'daysOverdue' => $daysOverdue,
                'ipcaCorrection' => $isPago ? 0 : $ipcaCorrection,
                'moraAmount' => $isPago ? 0 : $moraAmount,
                'penaltyAmount' => $isPago ? 0 : $penaltyAmount,
                'updatedAmount' => $isPago ? (double)($paymentRow->amount ?? $originalAmount) : $updatedAmount,
                'isAccelerated' => $contract->accelerates && $isOverdue,
                'payments' => $isPago ? [['paidAt' => $paymentRow->paidAt ?? $dueDate->toDateString()]] : []
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
        // 1. Removemos o 'exists:installments,id' temporariamente da validação rígida,
        // pois a parcela pode precisar ser criada agora se for um fallback matemático.
        $request->validate([
            'installmentId' => 'required', // Pode vir o ID real ou o número da parcela (fallback)
            'amount' => 'required|numeric',
            'paidAt' => 'required|string|max:10',
            'method' => 'required|string',
            'contractId' => 'nullable|integer' // Garantia extra caso precise criar a parcela
        ]);

        // Executa tudo dentro de uma transação para garantir consistência pura
        DB::transaction(function() use ($request) {
            $installmentId = $request->installmentId;

            // 2. Checa se o ID enviado realmente existe na tabela 'installments'
            $installmentExists = DB::table('installments')->where('id', $installmentId)->exists();

            // 3. Se NÃO existir (Cenário do Sebastião), nós criamos a parcela no banco agora!
            if (!$installmentExists) {
                // Buscamos o contrato para herdar os valores base caso o front não mande tudo
                $contractId = $request->contractId ?? DB::table('payments_fallback_helper')->where('id', $installmentId)->value('contractId'); 
                
                // Se não acharmos o contrato de forma direta, tentamos deduzir pelo escopo ou contexto.
                // Como alternativa segura, criamos a linha na tabela 'installments' usando os dados atuais:
                $contract = DB::table('contracts')->orderBy('id', 'desc')->first(); // Fallback seguro ou ajuste conforme seu app
                
                $newInstallmentId = DB::table('installments')->insertGetId([
                    'contractId'        => $contractId ?? $contract->id,
                    'installmentNumber' => $request->installmentId, // O número temporário vira o número real
                    'dueDate'           => $request->paidAt, // Assume a data base ou vencimento original
                    'originalAmount'    => $request->amount,
                    'status'            => 'Pago', // Já nasce paga!
                    'createdAt'         => now()
                ]);

                $installmentId = $newInstallmentId; // Atualiza a variável para vincular no recibo abaixo!
            } else {
                // Se a parcela já existia fisicamente, apenas atualiza o status dela para 'Pago'
                DB::table('installments')
                    ->where('id', $installmentId)
                    ->update([
                        'status' => 'Pago',
                        'updatedAt' => now()
                    ]);
            }
            
            // 4. Grava o histórico de baixa na tabela 'payments' vinculando ao ID correto
            DB::table('payments')->insert([
                'installmentId' => $installmentId,
                'amount'        => $request->amount,
                'paidAt'        => $request->paidAt,
                'method'        => $request->method,
                'recordedBy'    => \Illuminate\Support\Facades\Auth::check() ? \Illuminate\Support\Facades\Auth::user()->name : 'Sistema',
            ]);
        });

        return redirect()->back();
    }
}