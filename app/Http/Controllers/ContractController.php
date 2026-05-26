<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class ContractController extends Controller
{
    /**
     * Listagem Geral de Contratos (Chamada ao clicar no Menu Lateral)
     */
    /**
     * Listagem Geral de Contratos (Chamada ao clicar no Menu Lateral)
     * Rota: http://127.0.0.1:8000/contracts
     */
    public function index(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter');

        // 🚀 CORREÇÃO: Adicionado o LEFT JOIN com a tabela 'clients' para buscar o nome do cliente
        $query = DB::table('contracts')
            ->leftJoin('contract_types', 'contracts.contract_type_id', '=', 'contract_types.id')
            ->leftJoin('clients', 'contracts.clientId', '=', 'clients.id') // 👈 Conexão com a tabela de clientes
            ->select(
                'contracts.*', 
                'contract_types.name as contract_type_name',
                'clients.name as client_name' // 👈 Trazendo o nome do cliente mapeado para o React
            );

        // Aplica os filtros apenas se eles forem enviados de verdade pelo input
        if (!empty($search)) {
            $query->where(function($q) use ($search) {
                $q->where('contracts.code', 'like', "%{$search}%")
                  ->orWhere('contracts.contractName', 'like', "%{$search}%")
                  ->orWhere('contracts.creditor', 'like', "%{$search}%")
                  ->orWhere('clients.name', 'like', "%{$search}%"); // 👈 Permite buscar também pelo nome do cliente
            });
        }

        if (!empty($statusFilter) && $statusFilter !== 'Todos') {
            $query->where('contracts.status', $statusFilter);
        }

        // Puxa todos os registros reais salvos no banco de dados
        $rawContracts = $query->orderBy('contracts.id', 'desc')->get();

        // 🚀 2. Coleta os tipos cadastrados via Seeder para alimentar o Dropdown do front-end
        $contractTypes = DB::table('contract_types')->orderBy('name', 'asc')->get();

        // Retorna a view injetando os dados estruturados no ecossistema do Inertia / React
        return Inertia::render('Contracts', [
            'contracts'     => $rawContracts,
            'contractTypes' => $contractTypes
        ]);
    }

    /**
     * API auxiliar de lookup de clientes
     */
    public function clientsLookup()
    {
        $clients = DB::table('clients')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'document']);

        return response()->json($clients);
    }

    /**
     * Salva o formulário original
     */
    public function store(Request $request)
    {
        $request->validate([
            'contractName'     => 'required|string',
            'code'             => 'required|string',
            'clientId'         => 'required',
            'contract_type_id' => 'required', // Validação adicionada para o tipo obrigatório
        ]);

        // Grava no banco respeitando as colunas exatas do seu objeto emptyForm original
        DB::table('contracts')->insert([
            'clientId'                         => $request->input('clientId'),
            'code'                             => $request->input('code'),
            'contractName'                     => $request->input('contractName'),
            'creditor'                         => $request->input('creditor'),
            'contract_type_id'                 => $request->input('contract_type_id'), // 🚀 5. Gravando o ID selecionado
            'contractDate'                     => $request->input('contractDate'),
            'status'                           => $request->input('status', 'Ativo'),
            'validated'                        => (bool)$request->input('validated', false),
            'principalAmount'                  => $request->input('principalAmount', 0),
            'financedTotal'                    => $request->input('financedTotal', 0),
            'tacAmount'                        => $request->input('tacAmount', 0),
            'iofAmount'                        => $request->input('iofAmount', 0),
            'installmentCount'                 => $request->input('installmentCount', 12),
            'installmentAmount'                => $request->input('installmentAmount', 0),
            'firstDueDate'                     => $request->input('firstDueDate'),
            'monthlyInterestRate'              => $request->input('monthlyInterestRate', 0),
            'moraRateMonthly'                  => $request->input('moraRateMonthly', 0.02),
            'penaltyRate'                      => $request->input('penaltyRate', 0.1),
            'penaltyBaseType'                  => $request->input('penaltyBaseType', 'installment'),
            'penaltyScope'                     => $request->input('penaltyScope', 'per_installment'),
            'correctionIndex'                  => $request->input('correctionIndex', 'IPCA'),
            'honoraryRate'                     => $request->input('honoraryRate', 0),
            'accelerates'                      => (bool)$request->input('accelerates', false),
            'accelerationRule'                 => $request->input('accelerationRule'),
            'accelerationConsecutiveThreshold' => $request->input('accelerationConsecutiveThreshold'),
            'accelerationAlternateThreshold'   => $request->input('accelerationAlternateThreshold'),
            'guarantees'                       => $request->input('guarantees'),
            'guarantors'                       => $request->input('guarantors'),
            'validationUrl'                    => $request->input('validationUrl'),
            'observations'                     => $request->input('observations'),
        ]);

        return redirect()->route('contracts.index');
    }

    /**
     * Remove o contrato selecionado
     */
    public function destroy($id)
    {
        DB::table('contracts')->where('id', $id)->delete();
        return redirect()->back();
    }
}