<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContractTypes\StoreContractTypeRequest;
use App\Http\Requests\ContractTypes\UpdateContractTypeRequest;
use App\Models\ContractType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ContractTypeController extends Controller
{
    /**
     * Renderiza a página /tipos-contrato (CRUD da Gestão Interna).
     * A listagem propriamente dita é alimentada via /api/contract-types,
     * permitindo refresh sem reload e mantendo a UX igual à de Usuários.
     */
    public function index(): Response
    {
        return Inertia::render('ContractTypes');
    }

    /**
     * GET /api/contract-types — lista filtrada/paginada em JSON.
     *
     * Aceita:
     *   - search: filtra pelo name/slug;
     *   - status: 'all' (default), 'active' ou 'inactive';
     *   - per_page: tamanho da página (default 100).
     *
     * Anexa contracts_count e active_contracts_count em cada item para
     * a UI poder mostrar o uso real e bloquear o botão de excluir.
     */
    public function list(Request $request): JsonResponse
    {
        $search  = trim((string) $request->input('search', ''));
        $status  = (string) $request->input('status', 'all');
        $perPage = (int) $request->input('per_page', 100);

        $query = ContractType::query()
            ->withCount([
                'contracts',
                'contracts as active_contracts_count' => function ($q) {
                    $q->where('status', 'Ativo');
                },
            ]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        $contractTypes = $query->orderBy('name')->paginate($perPage);

        return response()->json($contractTypes);
    }

    /**
     * POST /api/contract-types — cadastra novo tipo de contrato.
     */
    public function store(StoreContractTypeRequest $request): JsonResponse
    {
        $name = (string) $request->string('name');
        $slug = $request->filled('slug')
            ? (string) $request->string('slug')
            : $this->buildUniqueSlug($name);

        $contractType = ContractType::create([
            'name'      => $name,
            'slug'      => $slug,
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->json([
            'message'      => 'Tipo de contrato criado com sucesso.',
            'contractType' => $contractType,
        ], 201);
    }

    /**
     * PUT /api/contract-types/{contract_type} — atualiza tipo de contrato.
     *
     * A inativação (is_active=false) é bloqueada quando existem contratos
     * ativos vinculados, mesma regra do destroy. Renomear ou apenas
     * reativar o tipo continuam sendo permitidos.
     */
    public function update(UpdateContractTypeRequest $request, ContractType $contractType): JsonResponse
    {
        $payload = [
            'name' => (string) $request->string('name'),
        ];

        if ($request->filled('slug')) {
            $payload['slug'] = (string) $request->string('slug');
        }

        if ($request->has('is_active')) {
            $newActive = $request->boolean('is_active');

            if ($contractType->is_active && ! $newActive) {
                $activeCount = $contractType->activeContractsCount();
                if ($activeCount > 0) {
                    return response()->json([
                        'message' => "Não é possível inativar: existem {$activeCount} contrato(s) ativo(s) associado(s) a este tipo. Reatribua os contratos antes de desativá-lo.",
                        'errors'  => [
                            'is_active' => ['Há contratos ativos vinculados a este tipo.'],
                        ],
                    ], 422);
                }
            }

            $payload['is_active'] = $newActive;
        }

        $contractType->update($payload);

        return response()->json([
            'message'      => 'Tipo de contrato atualizado com sucesso.',
            'contractType' => $contractType->fresh(),
        ]);
    }

    /**
     * PATCH /api/contract-types/{contract_type}/toggle — ativa/desativa.
     * Endpoint dedicado para o botão de switch da listagem, evitando
     * abrir o modal de edição apenas para alternar a flag.
     *
     * A inativação é bloqueada caso existam contratos ativos vinculados,
     * mesma regra usada no destroy.
     */
    public function toggleActive(ContractType $contractType): JsonResponse
    {
        if ($contractType->is_active) {
            $activeCount = $contractType->activeContractsCount();
            if ($activeCount > 0) {
                return response()->json([
                    'message' => "Não é possível inativar: existem {$activeCount} contrato(s) ativo(s) associado(s) a este tipo. Reatribua os contratos antes de desativá-lo.",
                ], 422);
            }
        }

        $contractType->update([
            'is_active' => ! $contractType->is_active,
        ]);

        return response()->json([
            'message'      => $contractType->is_active
                ? 'Tipo de contrato ativado.'
                : 'Tipo de contrato desativado.',
            'contractType' => $contractType,
        ]);
    }

    /**
     * DELETE /api/contract-types/{contract_type} — remove o tipo.
     * Bloqueia a operação caso existam contratos ATIVOS associados a
     * ele, conforme regra de negócio da feature.
     */
    public function destroy(ContractType $contractType): JsonResponse
    {
        $activeCount = $contractType->activeContractsCount();

        if ($activeCount > 0) {
            return response()->json([
                'message' => "Não é possível excluir: existem {$activeCount} contrato(s) ativo(s) associado(s) a este tipo. Desative o registro ou reatribua os contratos antes de excluir.",
            ], 422);
        }

        $contractType->delete();

        return response()->json([
            'message' => 'Tipo de contrato excluído com sucesso.',
        ]);
    }

    /**
     * Gera um slug único a partir do nome quando o operador não informa.
     * Garante estabilidade do identificador estruturado da tabela.
     */
    private function buildUniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'tipo-contrato';
        }

        $slug = $base;
        $i = 2;
        while (ContractType::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
