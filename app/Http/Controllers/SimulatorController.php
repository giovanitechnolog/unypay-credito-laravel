<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

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

        // Ajustado de CamelCase para snake_case para bater com as colunas reais do MySQL
        DB::table('loan_simulations')->insert([
            'user_id'            => Auth::id(), 
            'client_name'        => $request->input('clientName'),
            'client_document'    => $request->input('clientDocument'),
            'person_type'        => $request->input('personType', 'PF'),
            'calc_mode'          => $request->input('mode'),
            'principal'          => $request->input('principal'),
            'monthly_rate'       => $request->input('monthlyRate', 0),
            'installment_count'  => $request->input('installmentCount'),
            'installment_amount' => $request->input('installmentAmount'),
            'first_due_date'     => $request->input('firstDueDate'),
            'tac_value'          => $request->input('tac', 0),
            'iof_value'          => $request->input('iof', 0),
            'financed_total'     => $request->input('financedTotal'),
            'total_payable'      => $request->input('totalPayable'),
            'total_interest'     => $request->input('totalInterest'),
            'cet_monthly'        => $request->input('cetMonthly', 0),
            'cet_annual'         => $request->input('cetAnnual', 0),
            'created_at'         => now(),
            'updated_at'         => now()
        ]);

        return redirect()->back()->with('flash', [
            'success' => 'Simulação arquivada com sucesso!'
        ]);
    }

    /**
     * ── HISTÓRICO AJUSTADO ──
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

        // 🚀 CORREÇÃO DO VITE: Apontando exatamente para 'SimulationHistory' (no singular)
        return Inertia::render('SimulationHistory', [
            'simulations' => $simulations,
            'clients'     => $clients
        ]);
    }

    /**
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
     * Converte a simulação salva em um Contrato Real na base de dados
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

        // Cria o registro do Contrato principal seguindo a estrutura do Manus
        $contractId = DB::table('contracts')->insertGetId([
            'code'           => $request->input('code'),
            'name'           => $request->input('contractName'),
            'creditor'       => $request->input('creditor', 'UnyPay® S.A.'),
            'contract_date'  => $request->input('contractDate'),
            'client_id'      => $request->input('clientId'),
            'principal'      => $sim->principal,
            'financed_total' => $sim->financed_total ?? $sim->financedTotal,
            'total_payable'  => $sim->total_payable ?? $sim->totalPayable,
            'calc_mode'      => $sim->calc_mode ?? $sim->calcMode,
            'created_at'     => now(),
            'updated_at'     => now()
        ]);

        return redirect()->route('simulator.history')->with('flash', [
            'success' => "Contrato '{$request->input('contractName')}' gerado com sucesso a partir da simulação!"
        ]);
    }
}