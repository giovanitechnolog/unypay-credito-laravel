<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class SimulatorController extends Controller
{
    public function index()
    {
        return Inertia::render('Simulator');
    }

    public function save(Request $request)
    {
        $request->validate([
            'mode'              => 'required|string',
            'principal'         => 'required|numeric',
            'installmentCount'  => 'required|integer',
            'installmentAmount' => 'required|numeric',
            'financedTotal'     => 'required|numeric',
            'totalPayable'      => 'required|numeric',
            'totalInterest'     => 'required|numeric'
        ]);

        DB::table('loan_simulations')->insert([
            'userId'            => auth()->id(),
            'clientName'        => $request->input('clientName'),
            'clientDocument'    => $request->input('clientDocument'),
            'personType'        => $request->input('personType', 'PF'),
            'calcMode'          => $request->input('mode'),
            'principal'          => $request->input('principal'),
            'monthlyRate'       => $request->input('monthlyRate', 0),
            'installmentCount'  => $request->input('installmentCount'),
            'installmentAmount' => $request->input('installmentAmount'),
            'firstDueDate'     => $request->input('firstDueDate'),
            'tacValue'          => $request->input('tac', 0),
            'iofValue'          => $request->input('iof', 0),
            'financedTotal'     => $request->input('financedTotal'),
            'totalPayable'      => $request->input('totalPayable'),
            'totalInterest'     => $request->input('totalInterest'),
            'cetMonthly'        => $request->input('cetMonthly', 0),
            'cetAnnual'         => $request->input('cetAnnual', 0),
            'createdAt'         => now(),
            'updatedAt'         => now()
        ]);

        return redirect()->back()->with('flash', [
            'success' => 'Simulação arquivada com sucesso!'
        ]);
    }

    /**
     * ── NOVO MÉTODO ──
     * Lista o histórico completo de simulações e injeta os clientes cadastrados para o modal
     */
    public function history()
    {
        // Busca as simulações ordenando pelas mais recentes
        $simulations = DB::table('loan_simulations')
            ->orderBy('id', 'desc')
            ->get();

        // Busca a lista de clientes reais cadastrados no banco do Manus para alimentar o modal
        $clients = DB::table('clients')
            ->select('id', 'name', 'document')
            ->orderBy('name', 'asc')
            ->get();

        return Inertia::render('SimulationHistory', [
            'simulations' => $simulations,
            'clients'     => $clients
        ]);
    }

    /**
     * ── NOVO MÉTODO ──
     * Exclui um registro do histórico
     */
    public function delete($id)
    {
        DB::table('loan_simulations')->where('id', $id)->delete();

        return redirect()->back()->with('flash', [
            'success' => 'Registro de simulação removido do histórico com sucesso!'
        ]);
    }

    /**
     * ── NOVO MÉTODO ──
     * Converte a simulação salva em um Contrato Real na base de dados (Regra de Ouro do Manus)
     */
    public function convertToContract(Request $request, $id)
    {
        $request->validate([
            'code'         => 'required|string',
            'contractName' => 'required|string',
            'contractDate' => 'required|date',
            'clientId'     => 'required'
        ]);

        $sim = DB::table('loan_simulations')->where('id', $id)->first();
        if (!$sim) {
            return redirect()->back()->withErrors(['error' => 'Simulação não encontrada.']);
        }

        // 1. Cria o registro do Contrato principal seguindo a estrutura do Manus
        $contractId = DB::table('contracts')->insertGetId([
            'code'           => $request->input('code'),
            'name'           => $request->input('contractName'),
            'creditor'       => $request->input('creditor', 'UnyPay® S.A.'),
            'contract_date'  => $request->input('contractDate'),
            'client_id'      => $request->input('clientId'),
            'principal'      => $sim->principal,
            'financed_total' => $sim->financedTotal,
            'total_payable'  => $sim->totalPayable,
            'calc_mode'      => $sim->calcMode,
            'created_at'     => now(),
            'updated_at'     => now()
        ]);

        // Nota: A lógica original do Manus gera as parcelas (installments) automáticas aqui se necessário.

        return redirect()->route('simulator.history')->with('flash', [
            'success' => "Contrato '{$request->input('contractName')}' gerado com sucesso a partir da simulação!"
        ]);
    }
}