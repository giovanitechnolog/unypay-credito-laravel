<?php

namespace App\Http\Controllers;

use App\Exports\ConsignorsExport;
use App\Http\Requests\Consignors\StoreConsignorRequest;
use App\Http\Requests\Consignors\UpdateConsignorRequest;
use App\Models\Consignor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * CRUD de Credores (Consignors).
 *
 * Estrutura híbrida idêntica à do GuarantorController:
 *  - GET /credores              → renderiza a página Inertia "Credores".
 *  - GET/POST/PUT/DELETE /api/consignors → JSON API consumido pelo modal/grade.
 *
 * Em store/update usamos DB::transaction para garantir atomicidade entre o
 * cadastro do credor e o sincronismo das contas bancárias (1:N).
 */
class ConsignorController extends Controller
{
    /**
     * Renderiza a página /credores via Inertia.
     */
    public function page(): Response
    {
        return Inertia::render('Credores');
    }

    public function export(Request $request): BinaryFileResponse
    {
        $rows = $this->buildConsignorsForExport($request);

        return Excel::download(new ConsignorsExport($rows), 'credores.xlsx');
    }

    /**
     * GET /api/consignors — lista paginada/filtrável em JSON,
     * já incluindo a contagem de contas bancárias por credor.
     */
    public function index(Request $request): JsonResponse
    {
        $search  = trim((string) $request->input('search', ''));
        $perPage = (int) $request->input('per_page', 25);

        $query = $this->applyConsignorSearch(
            Consignor::query()->with(['bankAccounts'])->withCount('bankAccounts'),
            $search
        );

        $consignors = $query->orderBy('name')->paginate($perPage);

        return response()->json($consignors);
    }

    private function buildConsignorsForExport(Request $request): Collection
    {
        $search = trim((string) $request->input('search', ''));

        return $this->applyConsignorSearch(
            Consignor::query()->with(['bankAccounts'])->withCount('bankAccounts'),
            $search
        )->orderBy('name')->get();
    }

    private function applyConsignorSearch($query, string $search)
    {
        if ($search === '') {
            return $query;
        }

        $digits = preg_replace('/\D/', '', $search);

        return $query->where(function ($q) use ($search, $digits) {
            $q->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%");

            if ($digits !== '') {
                $q->orWhere('document', 'like', "%{$digits}%")
                    ->orWhere('phone', 'like', "%{$digits}%");
            }
        });
    }

    /**
     * GET /api/consignors/{consignor} — detalhe com contas bancárias hidratadas.
     */
    public function show(Consignor $consignor): JsonResponse
    {
        $consignor->load('bankAccounts');

        return response()->json([
            'consignor' => $consignor,
        ]);
    }

    /**
     * POST /api/consignors — cria credor + contas bancárias em UMA transação.
     */
    public function store(StoreConsignorRequest $request): JsonResponse
    {
        $data         = $request->validated();
        $bankAccounts = $data['bankAccounts'] ?? [];
        unset($data['bankAccounts']);

        $consignor = DB::transaction(function () use ($data, $bankAccounts) {
            $consignor = Consignor::create($data);

            if (! empty($bankAccounts)) {
                $rows = collect($bankAccounts)->map(function ($acc) use ($consignor) {
                    return [
                        'consignorId'   => $consignor->id,
                        'bankName'      => $acc['bankName']      ?? '',
                        'agency'        => $acc['agency']        ?? null,
                        'accountNumber' => $acc['accountNumber'] ?? null,
                        'accountType'   => $acc['accountType']   ?? 'corrente',
                        'pixKey'        => $acc['pixKey']        ?? null,
                        'createdAt'     => now(),
                        'updatedAt'     => now(),
                    ];
                })->all();

                DB::table('consignor_bank_accounts')->insert($rows);
            }

            return $consignor;
        });

        $consignor->load('bankAccounts')->loadCount('bankAccounts');

        return response()->json([
            'message'   => 'Credor cadastrado com sucesso.',
            'consignor' => $consignor,
        ], 201);
    }

    /**
     * PUT /api/consignors/{consignor} — atualiza credor + sincroniza contas bancárias
     * em UMA transação. Estratégia "delete + reinsert" garante simplicidade e
     * consistência (qualquer remoção feita no front é refletida no banco).
     */
    public function update(UpdateConsignorRequest $request, Consignor $consignor): JsonResponse
    {
        $data         = $request->validated();
        $bankAccounts = $data['bankAccounts'] ?? null;
        unset($data['bankAccounts']);

        DB::transaction(function () use ($consignor, $data, $bankAccounts, $request) {
            $consignor->update($data);

            // Só toca nas contas se o front mandou a chave `bankAccounts`
            // (caso contrário considera-se "não alterar"). Igual à estratégia
            // do GuarantorController com clientIds.
            if ($request->has('bankAccounts')) {
                $consignor->bankAccounts()->delete();

                if (! empty($bankAccounts)) {
                    $rows = collect($bankAccounts)->map(function ($acc) use ($consignor) {
                        return [
                            'consignorId'   => $consignor->id,
                            'bankName'      => $acc['bankName']      ?? '',
                            'agency'        => $acc['agency']        ?? null,
                            'accountNumber' => $acc['accountNumber'] ?? null,
                            'accountType'   => $acc['accountType']   ?? 'corrente',
                            'pixKey'        => $acc['pixKey']        ?? null,
                            'createdAt'     => now(),
                            'updatedAt'     => now(),
                        ];
                    })->all();

                    DB::table('consignor_bank_accounts')->insert($rows);
                }
            }
        });

        $consignor->load('bankAccounts')->loadCount('bankAccounts');

        return response()->json([
            'message'   => 'Credor atualizado com sucesso.',
            'consignor' => $consignor,
        ]);
    }

    /**
     * DELETE /api/consignors/{consignor} — remove o credor.
     * As contas bancárias são apagadas em cascata pela FK consignorId
     * (cascadeOnDelete configurado na migration).
     */
    public function destroy(Consignor $consignor): JsonResponse
    {
        $consignor->delete();

        return response()->json([
            'message' => 'Credor removido com sucesso.',
        ]);
    }
}
