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

        $clients = $query->orderBy('name', 'asc')->get()->toArray();

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
            'name'       => 'required|string|max:255',
            'document'   => 'nullable|string',
            'personType' => 'required|string|in:PF,PJ',
            'riskRating' => 'required|string|in:A,B,C,D,E',
            'phone'      => 'nullable|string',
            'email'      => 'nullable|email',
            'address'    => 'nullable|string',
            'city'       => 'nullable|string',
            'state'      => 'nullable|string|max:2',
            'zipCode'    => 'nullable|string',
            'notes'      => 'nullable|string', 
        ]);

        DB::table('clients')->insert([
            'user_id'    => Auth::id(),
            'name'       => $validated['name'],
            'document'   => $validated['document'],
            'personType' => $validated['personType'],
            'riskRating' => $validated['riskRating'],
            'phone'      => $validated['phone'],
            'email'      => $validated['email'],
            'address'    => $validated['address'],
            'city'       => $validated['city'],
            'state'      => $validated['state'],
            'zipCode'    => $validated['zipCode'],
            'notes'      => $validated['notes'], // JSON contendo as Contas + PIX + Fiadores
            'createdAt'  => now(),
            'updatedAt'  => now()
        ]);

        return redirect()->back();
    }

    /**
     * Atualizar dados de um cliente existente
     */
    public function update(Request $request, int $id)
    {
        $validated = $request->validate([
            'name'       => 'required|string|max:255',
            'document'   => 'nullable|string',
            'personType' => 'required|string|in:PF,PJ',
            'riskRating' => 'required|string|in:A,B,C,D,E',
            'phone'      => 'nullable|string',
            'email'      => 'nullable|email',
            'address'    => 'nullable|string',
            'city'       => 'nullable|string',
            'state'      => 'nullable|string|max:2',
            'zipCode'    => 'nullable|string',
            'notes'      => 'nullable|string',
        ]);

        DB::table('clients')->where('id', $id)->update([
            'user_id'    => Auth::id(),
            'name'       => $validated['name'],
            'document'   => $validated['document'],
            'personType' => $validated['personType'],
            'riskRating' => $validated['riskRating'],
            'phone'      => $validated['phone'],
            'email'      => $validated['email'],
            'address'    => $validated['address'],
            'city'       => $validated['city'],
            'state'      => $validated['state'],
            'zipCode'    => $validated['zipCode'],
            'notes'      => $validated['notes'], 
            'updatedAt'  => now() // 🚀 Garantido Letra Maiúscula conforme a imagem do HeidiSQL
        ]);

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
        // 🚀 Inclui os fiadores junto com os contratos para que a página
        // ClientDetails (e qualquer outro consumidor Inertia) tenha acesso
        // direto à relação NxN client_guarantor.
        $client = Client::with(['contracts', 'guarantors'])->findOrFail($id);

        return inertia('ClientDetails', [
            'client' => $client
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