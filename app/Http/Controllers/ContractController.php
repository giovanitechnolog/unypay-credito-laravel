<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class ContractController extends Controller
{
    /**
     * Listagem Geral de Contratos (Chamada ao clicar no Menu Lateral)
     * Rota: http://127.0.0.1:8000/contracts
     */
    public function index(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter');

        // Cria a query base na tabela de contratos
        $query = DB::table('contracts');

        // Aplica os filtros apenas se eles forem enviados de verdade pelo input
        if (!empty($search)) {
            $query->where(function($q) use ($search) {
                // Tenta buscar de forma ampla contornando diferenças de snake_case / camelCase
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('contractName', 'like', "%{$search}%")
                  ->orWhere('creditor', 'like', "%{$search}%");
            });
        }

        if (!empty($statusFilter) && $statusFilter !== 'Todos') {
            $query->where('status', $statusFilter);
        }

        // Puxa todos os registros reais salvos no banco de dados
        $rawContracts = $query->orderBy('id', 'desc')->get();
        
        // Puxa os clientes para fazer o mapa de nomes idêntico ao método show
        $clients = DB::table('clients')->get();
        $clientMap = $clients->pluck('name', 'id')->toArray();

        // ── MAPEAMENTO DE SUCESSO: Transforma a lista inteira no formato que o React lê ──
        $processedContracts = $rawContracts->map(function($c) use ($clientMap) {
            return [
                'contract' => $c,
                'clientName' => $clientMap[$c->clientId] ?? 'Consumidor não localizado'
            ];
        })->toArray(); // Converte em array plano limpo

        // Puxa todos os clientes ordenados para alimentar o Modal de Criação de Títulos
        $allClients = DB::table('clients')->select('id', 'name')->orderBy('name', 'asc')->get();

        return Inertia::render('Contracts', [
            'contracts' => $processedContracts, // Agora entrega a lista inteira no formato correto!
            'clients' => $allClients,
            'filters' => [
                'search' => $search ?? '',
                'statusFilter' => $statusFilter ?? 'Todos'
            ]
        ]);
    }

    /**
     * Detalhe de um contrato específico (Chamado pelo Olhinho do Lançamentos)
     * Rota: http://127.0.0.1:8000/contracts/1
     */
    public function show($id)
    {
        $contract = DB::table('contracts')->where('id', $id)->first();
        
        if (!$contract) {
            abort(404, 'Ativo contratual não localizado na base.');
        }

        $client = DB::table('clients')->where('id', $contract->clientId)->first();
        $allClients = DB::table('clients')->select('id', 'name')->orderBy('name', 'asc')->get();

        // Envia o registro único usando o mesmo array do index
        $singleContractCollection = [
            [
                'contract' => $contract,
                'clientName' => $client ? $client->name : 'Consumidor não localizado'
            ]
        ];

        return Inertia::render('Contracts', [
            'contracts' => $singleContractCollection,
            'clients' => $allClients,
            'filters' => [
                'search' => $contract->code,
                'statusFilter' => 'Todos'
            ]
        ]);
    }

    /**
     * Salva o novo instrumento contratual vindo do Modal (POST /contracts)
     * Rota: http://127.0.0.1:8000/contracts
     */
    /**
     * Salva o novo instrumento contratual vindo do Modal (POST /contracts)
     */
/**
     * Salva o novo instrumento contratual vindo do Modal (POST /contracts)
     */
    public function store(Request $request)
    {
        $request->validate([
            'clientId'          => 'required|numeric',
            'code'              => 'required|string|max:50',
            'contractName'      => 'required|string|max:255',
            'creditor'          => 'required|string|max:255',
            'principalAmount'   => 'required|numeric',
            'installmentCount'  => 'required|numeric',
            'installmentAmount' => 'required|numeric',
            'status'            => 'required|string',
        ]);

        DB::table('contracts')->insert([
            'clientId'                         => $request->input('clientId'),
            'code'                             => $request->input('code'),
            'contractName'                     => $request->input('contractName'),
            'creditor'                         => $request->input('creditor'),
            'contractType'                     => $request->input('contractType', 'Mútuo/Confissão de dívida'),
            'contractDate'                     => $request->input('contractDate'),
            'status'                           => $request->input('status', 'Ativo'),
            'validated'                        => (bool)$request->input('validated', false),
            'principalAmount'                  => $request->input('principalAmount'),
            'financedTotal'                    => $request->input('financedTotal', $request->input('principalAmount')),
            'tacAmount'                        => $request->input('tacAmount', 0),
            'iofAmount'                        => $request->input('iofAmount', 0),
            'installmentCount'                 => $request->input('installmentCount'),
            'installmentAmount'                => $request->input('installmentAmount'),
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
            // 🔄 REMOVIDOS: created_at e updated_at para não conflitar com seu banco atual
        ]);

        return redirect()->route('contracts.index');
    }

    /**
     * Remove ou expurga o contrato selecionado da auditoria
     */
    public function destroy($id)
    {
        DB::table('contracts')->where('id', $id)->delete();
        return redirect()->back();
    }
}