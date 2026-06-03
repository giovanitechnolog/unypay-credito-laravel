<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Client;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ClientController extends Controller
{
    /**
     * Listar e buscar clientes
     */
    public function index(Request $request)
    {
        $search = $request->input('search', '');

        $query = DB::table('clients');

        if (!empty($search)) {
            $query->where('name', 'like', '%' . $search . '%')
                  ->orWhere('document', 'like', '%' . $search . '%')
                  ->orWhere('email', 'like', '%' . $search . '%');
        }

        $clients = $query->orderBy('name', 'asc')->get();

        // 🚀 Hidrata as PESSOAS que aparecem como Fiador/Codevedor em algum
        // CONTRATO de cada cliente. A fonte de verdade é a pivot
        // contract_guarantor, que tem a coluna `role`. Agrupamos por
        // (clientId, guarantorId, role) para evitar duplicação quando a
        // mesma pessoa aparece em múltiplos contratos do mesmo cliente
        // exercendo o mesmo papel — uma única linha de exibição.
        // Continua sendo um único JOIN extra (zero N+1).
        $clientIds = $clients->pluck('id')->all();
        $guarantorsByClient = [];
        if (!empty($clientIds)) {
            $rows = DB::table('contracts as ct')
                ->join('contract_guarantor as cg', 'cg.contractId', '=', 'ct.id')
                ->join('guarantors as g',          'g.id',          '=', 'cg.guarantorId')
                ->whereIn('ct.clientId', $clientIds)
                ->select(
                    'ct.clientId',
                    'g.id',
                    'g.name',
                    'g.personType',
                    'g.cpf',
                    'g.cnpj',
                    'cg.role'
                )
                ->distinct()
                ->orderBy('g.name')
                ->get();

            foreach ($rows as $row) {
                $guarantorsByClient[$row->clientId][] = [
                    'id'         => (int) $row->id,
                    'name'       => $row->name,
                    'personType' => $row->personType,
                    'document'   => $row->personType === 'PJ' ? $row->cnpj : $row->cpf,
                    'role'       => $row->role, // FIADOR | CODEVEDOR
                ];
            }
        }

        $clients = $clients->map(function ($c) use ($guarantorsByClient) {
            $arr = (array) $c;
            $arr['guarantors'] = $guarantorsByClient[$c->id] ?? [];
            return $arr;
        })->all();

        return Inertia::render('Clients', [
            'clients' => $clients,
            'filters' => [
                'search' => $search
            ]
        ]);
    }

    /**
     * Cadastrar um novo cliente
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'document'        => 'nullable|string',
            'personType'      => 'required|string|in:PF,PJ',
            'riskRating'      => 'required|string|in:A,B,C,D,E',
            'phone'           => 'nullable|string',
            'email'           => 'nullable|email',
            'address'         => 'nullable|string',
            'city'            => 'nullable|string',
            'state'           => 'nullable|string|max:2',
            'zipCode'         => 'nullable|string',
            'notes'           => 'nullable|string',
            'guarantor_ids'   => 'nullable|array',
            'guarantor_ids.*' => 'integer|exists:guarantors,id',
        ]);

        $clientId = DB::table('clients')->insertGetId([
            'user_id'    => Auth::id(),
            'name'       => $validated['name'],
            'document'   => $validated['document'] ?? null,
            'personType' => $validated['personType'],
            'riskRating' => $validated['riskRating'],
            'phone'      => $validated['phone'] ?? null,
            'email'      => $validated['email'] ?? null,
            'address'    => $validated['address'] ?? null,
            'city'       => $validated['city'] ?? null,
            'state'      => $validated['state'] ?? null,
            'zipCode'    => $validated['zipCode'] ?? null,
            'notes'      => $validated['notes'] ?? null, // JSON contendo as Contas + PIX + Fiadores
            'createdAt'  => now(),
            'updatedAt'  => now()
        ]);

        // 🚀 Sincroniza os fiadores vinculados (NxN — tabela client_guarantor).
        // Apenas executado se a chave guarantor_ids veio no payload (mesmo que vazia),
        // permitindo que o cadastro do cliente continue suportando carteiras sem fiador.
        if ($request->has('guarantor_ids')) {
            $ids = collect($request->input('guarantor_ids', []))
                ->filter(fn ($v) => $v !== '' && $v !== null)
                ->map(fn ($v) => (int) $v)
                ->values()
                ->all();

            $client = Client::find($clientId);
            if ($client) {
                $client->guarantors()->sync($ids);
            }
        }

        return redirect()->back();
    }

    /**
     * Atualizar dados de um cliente existente
     */
    public function update(Request $request, int $id)
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'document'        => 'nullable|string',
            'personType'      => 'required|string|in:PF,PJ',
            'riskRating'      => 'required|string|in:A,B,C,D,E',
            'phone'           => 'nullable|string',
            'email'           => 'nullable|email',
            'address'         => 'nullable|string',
            'city'            => 'nullable|string',
            'state'           => 'nullable|string|max:2',
            'zipCode'         => 'nullable|string',
            'notes'           => 'nullable|string',
            'guarantor_ids'   => 'nullable|array',
            'guarantor_ids.*' => 'integer|exists:guarantors,id',
        ]);

        DB::table('clients')->where('id', $id)->update([
            'user_id'    => Auth::id(),
            'name'       => $validated['name'],
            'document'   => $validated['document'] ?? null,
            'personType' => $validated['personType'],
            'riskRating' => $validated['riskRating'],
            'phone'      => $validated['phone'] ?? null,
            'email'      => $validated['email'] ?? null,
            'address'    => $validated['address'] ?? null,
            'city'       => $validated['city'] ?? null,
            'state'      => $validated['state'] ?? null,
            'zipCode'    => $validated['zipCode'] ?? null,
            'notes'      => $validated['notes'] ?? null,
            'updatedAt'  => now() // 🚀 Garantido Letra Maiúscula conforme a imagem do HeidiSQL
        ]);

        // 🚀 Sincroniza os fiadores vinculados quando a chave veio no payload.
        // Se vier vazia, faz detach completo (estratégia idêntica ao GuarantorController).
        if ($request->has('guarantor_ids')) {
            $ids = collect($request->input('guarantor_ids', []))
                ->filter(fn ($v) => $v !== '' && $v !== null)
                ->map(fn ($v) => (int) $v)
                ->values()
                ->all();

            $client = Client::find($id);
            if ($client) {
                $client->guarantors()->sync($ids);
            }
        }

        return redirect()->back();
    }

    /**
     * Remover um cliente
     */
    public function destroy(int $id)
    {
        DB::table('clients')->where('id', $id)->delete();
        return redirect()->back();
    }

    /**
     * OCR para preenchimento via PDF
     */
    public function parseOcr(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240',
        ]);

        $mockOcrData = [
            'debtorName'     => 'Transportadora Alfa S.A.',
            'debtorDocument' => '12.345.678/0001-99',
            'debtorAddress'  => 'Av. das Indústrias, 1500, Galpão B',
            'city'           => 'Lavras',
            'state'          => 'MG',
            'pixKey'         => 'alfa@transportes.com.br',
            'guarantors'     => 'Marcos Silva Santos',
        ];

        return redirect()->back()->with('flash', [
            'ocrData' => $mockOcrData
        ]);
    }

    public function show(int $id)
    {
        // 🚀 Carrega contratos do cliente e, em uma única query auxiliar,
        // hidrata as PESSOAS que aparecem como Fiador/Codevedor em qualquer
        // contrato dele (pivot contract_guarantor com role).
        // Mesma estratégia usada em index() — distinct por (guarantorId, role).
        $client = Client::with(['contracts'])->findOrFail($id);

        $rows = DB::table('contracts as ct')
            ->join('contract_guarantor as cg', 'cg.contractId', '=', 'ct.id')
            ->join('guarantors as g',          'g.id',          '=', 'cg.guarantorId')
            ->where('ct.clientId', $id)
            ->select(
                'g.id',
                'g.name',
                'g.personType',
                'g.cpf',
                'g.cnpj',
                'cg.role'
            )
            ->distinct()
            ->orderBy('g.name')
            ->get();

        $clientArray = $client->toArray();
        $clientArray['guarantors'] = $rows->map(fn ($row) => [
            'id'         => (int) $row->id,
            'name'       => $row->name,
            'personType' => $row->personType,
            'document'   => $row->personType === 'PJ' ? $row->cnpj : $row->cpf,
            'role'       => $row->role,
        ])->all();

        return inertia('ClientDetails', [
            'client' => $clientArray,
        ]);
    }

    /**
     * GET /api/clients/{id}/guarantors — retorna em JSON apenas os fiadores
     * vinculados ao cliente. Usado pelo modal de Contratos para preencher
     * a seção "Fiadores Sugeridos" da aba Garantias e Fiadores quando o
     * operador escolhe o cliente devedor.
     *
     * Endpoint dedicado e leve (sem trazer contratos, notes, etc.).
     */
    public function guarantors(int $id): \Illuminate\Http\JsonResponse
    {
        $client = Client::findOrFail($id);

        $rows = $client->guarantors()
            ->select(['guarantors.id', 'guarantors.name', 'guarantors.personType', 'guarantors.cpf', 'guarantors.cnpj'])
            ->orderBy('guarantors.name')
            ->get()
            ->map(fn ($g) => [
                'id'         => $g->id,
                'name'       => $g->name,
                'personType' => $g->personType,
                'document'   => $g->personType === 'PJ' ? $g->cnpj : $g->cpf,
            ]);

        return response()->json($rows);
    }
}