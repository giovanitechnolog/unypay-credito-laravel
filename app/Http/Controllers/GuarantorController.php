<?php

namespace App\Http\Controllers;

use App\Http\Requests\Guarantors\StoreGuarantorRequest;
use App\Http\Requests\Guarantors\UpdateGuarantorRequest;
use App\Models\Guarantor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GuarantorController extends Controller
{
    /**
     * Renderiza a página /fiadores via Inertia.
     */
    public function page(): Response
    {
        return Inertia::render('Guarantors');
    }

    /**
     * GET /api/guarantors — lista paginada/filtrável em JSON.
     * Inclui a contagem de clientes vinculados e a lista compacta de IDs/nomes.
     */
    public function index(Request $request): JsonResponse
    {
        $search  = trim((string) $request->input('search', ''));
        $perPage = (int) $request->input('per_page', 25);

        $query = Guarantor::query()
            ->with(['clients:id,name'])
            ->withCount('clients')
            // 🚀 Contagens por papel exercido em CONTRATOS — alimentam os
            // cards "Vínculos Fiadores" / "Vínculos Codevedores" e as colunas
            // "Vínculo Fiador" / "Vínculo Codevedor" da grade. A relação
            // `contracts()` aponta para a pivot contract_guarantor; aqui
            // filtramos por role para separar as duas contagens.
            ->withCount([
                'contracts as fiadores_count'    => fn ($q) => $q->where('contract_guarantor.role', 'FIADOR'),
                'contracts as codevedores_count' => fn ($q) => $q->where('contract_guarantor.role', 'CODEVEDOR'),
            ]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $digits = preg_replace('/\D/', '', $search);

                $q->where('name',      'like', "%{$search}%")
                  ->orWhere('tradeName', 'like', "%{$search}%")
                  ->orWhere('rg',        'like', "%{$search}%")
                  ->orWhere('city',      'like', "%{$search}%");

                if ($digits !== '') {
                    $q->orWhere('cpf',  'like', "%{$digits}%")
                      ->orWhere('cnpj', 'like', "%{$digits}%");
                }
            });
        }

        $guarantors = $query->orderBy('name')->paginate($perPage);

        return response()->json($guarantors);
    }

    /**
     * GET /api/guarantors/{guarantor} — detalhe (com clientes vinculados).
     */
    public function show(Guarantor $guarantor): JsonResponse
    {
        $guarantor->load(['clients:id,name,document']);

        return response()->json([
            'guarantor' => $guarantor,
        ]);
    }

    /**
     * POST /api/guarantors — cria um fiador e (opcionalmente) sincroniza clientes.
     */
    public function store(StoreGuarantorRequest $request): JsonResponse
    {
        $data = $request->validated();

        $clientIds = $data['clientIds'] ?? [];
        unset($data['clientIds']);

        $guarantor = Guarantor::create($data);

        if (! empty($clientIds)) {
            $guarantor->clients()->sync($clientIds);
        }

        $guarantor->load(['clients:id,name'])->loadCount('clients');

        return response()->json([
            'message'   => 'Fiador cadastrado com sucesso.',
            'guarantor' => $guarantor,
        ], 201);
    }

    /**
     * PUT /api/guarantors/{guarantor} — atualiza dados e sincroniza clientes.
     */
    public function update(UpdateGuarantorRequest $request, Guarantor $guarantor): JsonResponse
    {
        $data = $request->validated();

        $clientIds = $data['clientIds'] ?? null;
        unset($data['clientIds']);

        $guarantor->update($data);

        // Só sincroniza se o front enviou explicitamente (chave presente)
        if ($request->has('clientIds')) {
            $guarantor->clients()->sync($clientIds ?? []);
        }

        $guarantor->load(['clients:id,name'])->loadCount('clients');

        return response()->json([
            'message'   => 'Fiador atualizado com sucesso.',
            'guarantor' => $guarantor,
        ]);
    }

    /**
     * DELETE /api/guarantors/{guarantor} — remove o fiador.
     * As linhas das pivots client_guarantor / contract_guarantor são apagadas em cascata
     * pela constraint cascadeOnDelete configurada nas migrations.
     */
    public function destroy(Guarantor $guarantor): JsonResponse
    {
        $guarantor->delete();

        return response()->json([
            'message' => 'Fiador removido com sucesso.',
        ]);
    }

    /**
     * GET /api/guarantors/search?q=joão — busca leve para alimentar o
     * autocomplete da aba "Garantias e Fiadores" do modal de Contratos.
     *
     * Retorna no máximo 20 itens com apenas os campos essenciais
     * (id, name, document, personType) — bem mais barato que o /index paginado.
     *
     * O front pode opcionalmente enviar excludeIds[] para que fiadores já
     * selecionados não apareçam na lista do combobox.
     */
    public function search(Request $request): JsonResponse
    {
        $term       = trim((string) $request->input('q', ''));
        $excludeIds = (array) $request->input('excludeIds', []);

        $query = Guarantor::query()
            ->select(['id', 'name', 'tradeName', 'cpf', 'cnpj', 'personType'])
            ->orderBy('name');

        if ($term !== '') {
            $digits = preg_replace('/\D/', '', $term);

            $query->where(function ($q) use ($term, $digits) {
                $q->where('name', 'like', "%{$term}%")
                  ->orWhere('tradeName', 'like', "%{$term}%");

                if ($digits !== '') {
                    $q->orWhere('cpf',  'like', "%{$digits}%")
                      ->orWhere('cnpj', 'like', "%{$digits}%");
                }
            });
        }

        if (! empty($excludeIds)) {
            $query->whereNotIn('id', array_filter(array_map('intval', $excludeIds)));
        }

        $guarantors = $query->limit(20)->get()->map(function ($g) {
            return [
                'id'         => $g->id,
                'name'       => $g->name,
                'personType' => $g->personType,
                // Documento "amigável" para exibir no combobox
                'document'   => $g->personType === 'PJ' ? $g->cnpj : $g->cpf,
            ];
        });

        return response()->json($guarantors);
    }

    /**
     * GET /api/guarantors-clients-lookup — devolve clientes (id,name,document)
     * para alimentar o multi-select no formulário do modal.
     */
    public function clientsLookup(Request $request): JsonResponse
    {
        $search = trim((string) $request->input('search', ''));

        $query = \App\Models\Client::query()->select(['id', 'name', 'document']);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('document', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->orderBy('name')->limit(50)->get()
        );
    }
}
