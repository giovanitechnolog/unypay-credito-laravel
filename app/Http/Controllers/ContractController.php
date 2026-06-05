<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContractAssets\StoreContractAssetRequest;
use App\Http\Requests\ContractWitnesses\StoreContractWitnessRequest;
use App\Models\Contract;
use App\Models\ContractAsset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContractController extends Controller
{
    private const PDF_DIR  = 'contracts/pdfs';
    private const PDF_DISK = 'local';

    public function index(Request $request)
    {
        $search = $request->input('search');
        $statusFilter = $request->input('statusFilter');

        $query = DB::table('contracts')
            ->leftJoin('contract_types', 'contracts.contract_type_id', '=', 'contract_types.id')
            ->leftJoin('clients', 'contracts.clientId', '=', 'clients.id')
            ->select(
                'contracts.*',
                'contract_types.name as contract_type_name',
                'clients.name as client_name'
            );

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('contracts.code', 'like', "%{$search}%")
                  ->orWhere('contracts.contractName', 'like', "%{$search}%")
                  ->orWhere('contracts.creditor', 'like', "%{$search}%")
                  ->orWhere('clients.name', 'like', "%{$search}%");
            });
        }

        if (!empty($statusFilter) && $statusFilter !== 'Todos') {
            $query->where('contracts.status', $statusFilter);
        }

        $rawContracts = $query->orderBy('contracts.id', 'desc')->get();

        // 🚀 Hidratação dos vínculos pessoa↔contrato (Fiadores E Codevedores) em
        // uma única query auxiliar contra a pivot contract_guarantor. A coluna
        // `role` na pivot decide em qual array do payload cada item entra.
        // Evita o N+1 e elimina a necessidade de duas queries paralelas.
        $contractIds = $rawContracts->pluck('id')->all();

        $guarantorsByContract = [];
        $codebtorsByContract  = [];
        if (!empty($contractIds)) {
            $guarantorRows = DB::table('contract_guarantor')
                ->join('guarantors', 'guarantors.id', '=', 'contract_guarantor.guarantorId')
                ->whereIn('contract_guarantor.contractId', $contractIds)
                ->select(
                    'contract_guarantor.contractId as contractId',
                    'contract_guarantor.role as role',
                    'guarantors.id',
                    'guarantors.name',
                    'guarantors.personType',
                    'guarantors.cpf',
                    'guarantors.cnpj'
                )
                ->orderBy('guarantors.name')
                ->get();

            foreach ($guarantorRows as $g) {
                $payload = [
                    'id'         => $g->id,
                    'name'       => $g->name,
                    'personType' => $g->personType,
                    'document'   => $g->personType === 'PJ' ? $g->cnpj : $g->cpf,
                ];

                if ($g->role === Contract::ROLE_CODEVEDOR) {
                    $codebtorsByContract[$g->contractId][] = $payload;
                } else {
                    $guarantorsByContract[$g->contractId][] = $payload;
                }
            }
        }

        $rawContracts->transform(function ($row) use ($guarantorsByContract, $codebtorsByContract) {
            $paths = json_decode($row->contractPdfPath ?? '[]', true);
            $row->hasContractPdf = !empty($paths) && count($paths) > 0;
            $row->guarantors     = $guarantorsByContract[$row->id] ?? [];
            $row->codebtors      = $codebtorsByContract[$row->id]  ?? [];
            return $row;
        });

        // 🚀 Hidratação dos bens em garantia (1:N — contract_assets) em uma
        // única query auxiliar, mesma estratégia usada com fiadores.
        $assetsByContract = [];
        if (!empty($contractIds)) {
            $assetRows = DB::table('contract_assets')
                ->whereIn('contractId', $contractIds)
                ->orderBy('id')
                ->get();

            foreach ($assetRows as $a) {
                $assetsByContract[$a->contractId][] = [
                    'id'              => $a->id,
                    'assetType'       => $a->assetType,
                    'brand'           => $a->brand,
                    'model'           => $a->model,
                    'manufactureYear' => $a->manufactureYear !== null ? (int) $a->manufactureYear : null,
                    'modelYear'       => $a->modelYear       !== null ? (int) $a->modelYear       : null,
                    'plate'           => $a->plate,
                    'renavam'         => $a->renavam,
                    'chassis'         => $a->chassis,
                    'description'     => $a->description,
                    'location'        => $a->location,
                    'registryNumber'  => $a->registryNumber,
                    'totalArea'       => $a->totalArea !== null ? (float) $a->totalArea : null,
                    'boundaries'      => $a->boundaries,
                ];
            }
        }

        $rawContracts->transform(function ($row) use ($assetsByContract) {
            $row->assets = $assetsByContract[$row->id] ?? [];
            return $row;
        });

        // 🚀 Hidratação das testemunhas (1:N — contract_witnesses) em uma
        // única query auxiliar, mesma estratégia usada com bens em garantia.
        $witnessesByContract = [];
        if (!empty($contractIds)) {
            $witnessRows = DB::table('contract_witnesses')
                ->whereIn('contractId', $contractIds)
                ->orderBy('id')
                ->get();

            foreach ($witnessRows as $w) {
                $witnessesByContract[$w->contractId][] = [
                    'id'   => (int) $w->id,
                    'name' => $w->name,
                    'cpf'  => $w->cpf,
                    'ci'   => $w->ci,
                ];
            }
        }

        $rawContracts->transform(function ($row) use ($witnessesByContract) {
            $row->witnesses = $witnessesByContract[$row->id] ?? [];
            return $row;
        });

        // 🚀 Hidratação dos credores (consignor) + contas bancárias em duas
        // queries únicas auxiliares — mesma estratégia anti-N+1 dos blocos
        // acima. Os contratos podem ter consignorId = NULL, então só
        // buscamos os IDs distintos não-nulos.
        $consignorIds = $rawContracts->pluck('consignorId')->filter()->unique()->values()->all();
        $consignorsById = [];
        if (!empty($consignorIds)) {
            $consignorRows = DB::table('consignors')
                ->whereIn('id', $consignorIds)
                ->get();

            $bankRows = DB::table('consignor_bank_accounts')
                ->whereIn('consignorId', $consignorIds)
                ->orderBy('id')
                ->get();

            $banksByConsignor = [];
            foreach ($bankRows as $b) {
                $banksByConsignor[$b->consignorId][] = [
                    'id'            => (int) $b->id,
                    'bankName'      => $b->bankName,
                    'agency'        => $b->agency,
                    'accountNumber' => $b->accountNumber,
                    'accountType'   => $b->accountType,
                    'pixKey'        => $b->pixKey,
                ];
            }

            foreach ($consignorRows as $c) {
                $consignorsById[$c->id] = [
                    'id'           => (int) $c->id,
                    'name'         => $c->name,
                    'document'     => $c->document,
                    'phone'        => $c->phone,
                    'email'        => $c->email,
                    'street'       => $c->street,
                    'number'       => $c->number,
                    'neighborhood' => $c->neighborhood,
                    'zipCode'      => $c->zipCode,
                    'complement'   => $c->complement,
                    'city'         => $c->city,
                    'state'        => $c->state,
                    'bankAccounts' => $banksByConsignor[$c->id] ?? [],
                ];
            }
        }

        $rawContracts->transform(function ($row) use ($consignorsById) {
            $row->consignor = ($row->consignorId && isset($consignorsById[$row->consignorId]))
                ? $consignorsById[$row->consignorId]
                : null;
            return $row;
        });

        $contractTypes = DB::table('contract_types')->orderBy('name', 'asc')->get();

        // 🚀 CRÍTICO: Carrega a tabela de clientes trazendo:
        //   - notes       → para o React extrair contas, PIX e fiadores
        //   - document    → CNPJ/CPF (somente leitura) na guia "Dados Básicos" do contrato
        //   - address/city/state/zipCode → exibir Endereço e CEP (somente leitura) na guia "Dados Básicos"
        //   - personType  → ajustes futuros de labels PF/PJ
        $clients = DB::table('clients')
            ->orderBy('name', 'asc')
            ->get(['id', 'name', 'document', 'address', 'city', 'state', 'zipCode', 'personType', 'notes']);

        return Inertia::render('Contracts', [
            'contracts'     => $rawContracts,
            'contractTypes' => $contractTypes,
            'clients'       => $clients,
            'filters'       => $request->only(['search', 'statusFilter'])
        ]);
    }

    public function store(Request $request)
    {
        // 🚀 Bens vêm como JSON dentro do FormData (porque o request também
        // carrega PDFs). Decodifica + normaliza ANTES da validação para que
        // 'assets.*' funcione com os tipos certos.
        $assets    = $this->extractAssets($request);
        $witnesses = $this->extractWitnesses($request);
        $request->merge(['assets' => $assets, 'witnesses' => $witnesses]);

        $rules = [
            'contractName'     => 'required|string',
            'code'             => 'required|string',
            'clientId'         => 'required',
            'contract_type_id' => 'required',
            // 🚀 Credor (Consignor) — vínculo opcional 1:N. Validamos a
            // existência no banco; null/vazio é aceito (contrato sem credor).
            'consignorId'      => 'nullable|integer|exists:consignors,id',
            'contractPdfs'     => 'nullable|array',
            'contractPdfs.*'   => 'file|mimes:pdf|max:20480',
            // 🚀 Vínculos pessoa↔contrato. Cada array é independente; ambos
            // gravam na mesma pivot (contract_guarantor) diferenciados pela
            // coluna `role`. Ver Contract::ROLE_FIADOR / ROLE_CODEVEDOR.
            'guarantor_ids'    => 'nullable|array',
            'guarantor_ids.*'  => 'integer|exists:guarantors,id',
            'codebtor_ids'     => 'nullable|array',
            'codebtor_ids.*'   => 'integer|exists:guarantors,id',
            // 🚀 Bens em garantia (veículos / imóveis)
            'assets'           => 'nullable|array',
            // 🚀 Testemunhas (nome + CPF — 1:N simples)
            'witnesses'        => 'nullable|array',
        ];
        $messages = [
            'consignorId.exists' => 'O credor selecionado não existe ou foi removido.',
        ];

        // Anexa regras condicionais para CADA bem do array, com prefixo
        // "assets.{i}" — Rule::requiredIf reage ao assetType de cada um.
        foreach ($assets as $i => $asset) {
            $rules    = array_merge($rules,    StoreContractAssetRequest::rulesFor($asset['assetType'] ?? null, "assets.{$i}"));
            $messages = array_merge($messages, StoreContractAssetRequest::messagesFor("assets.{$i}"));
        }

        foreach ($witnesses as $i => $witness) {
            $rules    = array_merge($rules,    StoreContractWitnessRequest::rulesFor("witnesses.{$i}"));
            $messages = array_merge($messages, StoreContractWitnessRequest::messagesFor("witnesses.{$i}"));
        }

        $request->validate($rules, $messages);

        $pdfPaths = [];
        $pdfNames = [];

        if ($request->hasFile('contractPdfs')) {
            foreach ($request->file('contractPdfs') as $file) {
                $pdfPaths[] = $file->store(self::PDF_DIR, self::PDF_DISK);
                $pdfNames[] = $file->getClientOriginalName();
            }
        }

        $extras = [
            'sourcePdfName'   => json_encode($pdfNames),
            'contractPdfPath' => json_encode($pdfPaths),
            'user_id'         => \Illuminate\Support\Facades\Auth::id(),
        ];

        // 🚀 insertGetId devolve o ID do contrato recém-criado, necessário para
        // sincronizar a pivot contract_guarantor logo abaixo.
        $contractId = DB::table('contracts')->insertGetId(
            $this->buildContractPayload($request, $extras)
        );

        $this->syncContractGuarantors(
            $contractId,
            (array) $request->input('guarantor_ids', []),
            Contract::ROLE_FIADOR
        );
        $this->syncContractGuarantors(
            $contractId,
            (array) $request->input('codebtor_ids', []),
            Contract::ROLE_CODEVEDOR
        );
        $this->syncContractAssets($contractId, $assets);
        $this->syncContractWitnesses($contractId, $witnesses);

        return redirect()->route('contracts.index');
    }

    public function update(Request $request, int $id)
    {
        // 🚀 Mesmo tratamento de assets do store — decodifica/normaliza primeiro.
        $assets             = $this->extractAssets($request);
        $witnesses          = $this->extractWitnesses($request);
        $assetsInPayload    = $request->has('assets');    // checar ANTES do merge
        $witnessesInPayload = $request->has('witnesses'); // checar ANTES do merge
        $request->merge(['assets' => $assets, 'witnesses' => $witnesses]);

        $rules = [
            'contractName'     => 'required|string',
            'code'             => 'required|string',
            'clientId'         => 'required',
            'contract_type_id' => 'required',
            // 🚀 Credor — mesmo tratamento do store: opcional, mas se vier
            // precisa apontar para um registro válido em consignors.
            'consignorId'      => 'nullable|integer|exists:consignors,id',
            'contractPdfs'     => 'nullable|array',
            'guarantor_ids'    => 'nullable|array',
            'guarantor_ids.*'  => 'integer|exists:guarantors,id',
            'codebtor_ids'     => 'nullable|array',
            'codebtor_ids.*'   => 'integer|exists:guarantors,id',
            'assets'           => 'nullable|array',
            'witnesses'        => 'nullable|array',
        ];
        $messages = [
            'consignorId.exists' => 'O credor selecionado não existe ou foi removido.',
        ];

        foreach ($assets as $i => $asset) {
            $rules    = array_merge($rules,    StoreContractAssetRequest::rulesFor($asset['assetType'] ?? null, "assets.{$i}"));
            $messages = array_merge($messages, StoreContractAssetRequest::messagesFor("assets.{$i}"));
        }

        foreach ($witnesses as $i => $witness) {
            $rules    = array_merge($rules,    StoreContractWitnessRequest::rulesFor("witnesses.{$i}"));
            $messages = array_merge($messages, StoreContractWitnessRequest::messagesFor("witnesses.{$i}"));
        }

        $request->validate($rules, $messages);

        $existing = DB::table('contracts')->where('id', $id)->first();
        if (!$existing) {
            return redirect()->route('contracts.index');
        }

        $extras = [
            'user_id' => \Illuminate\Support\Facades\Auth::id()
        ];

        // 🚀 Mescla anexos: o frontend envia explicitamente os PDFs antigos que
        // o usuário decidiu manter (existingPdfPaths[] / existingPdfNames[]) e
        // os arquivos novos a serem adicionados (contractPdfs[]). Os PDFs
        // antigos que NÃO vierem na lista de manter são considerados removidos
        // e seus arquivos físicos são deletados do storage.
        $oldPaths = json_decode($existing->contractPdfPath ?? '[]', true);
        $oldNames = json_decode($existing->sourcePdfName ?? '[]', true);
        if (!is_array($oldPaths)) { $oldPaths = []; }
        if (!is_array($oldNames)) { $oldNames = []; }

        $hasFiles            = $request->hasFile('contractPdfs');
        $hasKeepListInPaths  = $request->has('existingPdfPaths');
        $hasKeepListInNames  = $request->has('existingPdfNames');

        if ($hasFiles || $hasKeepListInPaths || $hasKeepListInNames) {
            $keptPaths = $request->input('existingPdfPaths', []);
            $keptNames = $request->input('existingPdfNames', []);
            if (!is_array($keptPaths)) { $keptPaths = []; }
            if (!is_array($keptNames)) { $keptNames = []; }

            // Caso o frontend NÃO mande a lista de "manter" mas mande arquivos
            // novos, mantemos os antigos por padrão (compatibilidade com versão
            // anterior que limpava tudo). Aqui só removemos o que foi marcado.
            $keepAllOld = !$hasKeepListInPaths && !$hasKeepListInNames;
            if ($keepAllOld) {
                $keptPaths = $oldPaths;
                $keptNames = $oldNames;
            }

            // Delete arquivos físicos que foram removidos (não estão em $keptPaths)
            foreach ($oldPaths as $oldPath) {
                if (!empty($oldPath) && !in_array($oldPath, $keptPaths, true)) {
                    if (Storage::disk(self::PDF_DISK)->exists($oldPath)) {
                        Storage::disk(self::PDF_DISK)->delete($oldPath);
                    }
                }
            }

            // Adiciona os novos uploads ao final
            if ($hasFiles) {
                foreach ($request->file('contractPdfs') as $file) {
                    $keptPaths[] = $file->store(self::PDF_DIR, self::PDF_DISK);
                    $keptNames[] = $file->getClientOriginalName();
                }
            }

            $extras['contractPdfPath'] = json_encode(array_values($keptPaths));
            $extras['sourcePdfName']   = json_encode(array_values($keptNames));
        }

        DB::table('contracts')
            ->where('id', $id)
            ->update($this->buildContractPayload($request, $extras, isUpdate: true));

        // 🚀 Só sincroniza vínculos pessoa↔contrato se o front enviou
        // explicitamente o campo. Isso evita zerar a relação numa edição
        // parcial que não tocou na aba "Fiador / Codevedor".
        if ($request->has('guarantor_ids')) {
            $this->syncContractGuarantors(
                $id,
                (array) $request->input('guarantor_ids', []),
                Contract::ROLE_FIADOR
            );
        }
        if ($request->has('codebtor_ids')) {
            $this->syncContractGuarantors(
                $id,
                (array) $request->input('codebtor_ids', []),
                Contract::ROLE_CODEVEDOR
            );
        }

        // 🚀 Mesma lógica para os bens em garantia: só toca se o front mandou
        // a chave 'assets' (mesmo que vazia, indicando "remover todos").
        if ($assetsInPayload) {
            $this->syncContractAssets($id, $assets);
        }

        // 🚀 Mesma lógica das testemunhas: só toca se o front mandou a chave
        // 'witnesses' (mesmo que vazia, indicando "remover todas").
        if ($witnessesInPayload) {
            $this->syncContractWitnesses($id, $witnesses, isUpdate: true);
        }

        return redirect()->route('contracts.index');
    }

    /**
     * Sincroniza um papel específico (FIADOR ou CODEVEDOR) na pivot
     * `contract_guarantor`. Como a relação no Model já filtra por
     * `wherePivot('role', ...)`, o `syncWithPivotValues()` com o role
     * desejado garante que:
     *
     *   • o detach automático mexe SÓ nos registros desse papel;
     *   • o attach insere o role correto na pivot;
     *   • timestamps createdAt/updatedAt são gerenciados pelo Eloquent.
     *
     * Esse desenho permite chamar o helper duas vezes para o mesmo contrato
     * (uma para cada papel) sem que um sync apague o outro.
     */
    private function syncContractGuarantors(int $contractId, array $personIds, string $role): void
    {
        $contract = Contract::find($contractId);
        if (! $contract) {
            return;
        }

        $clean = array_values(array_unique(array_filter(
            array_map('intval', $personIds),
            fn ($id) => $id > 0
        )));

        $relation = $role === Contract::ROLE_CODEVEDOR
            ? $contract->codebtors()
            : $contract->guarantors();

        $relation->syncWithPivotValues($clean, ['role' => $role]);
    }

    /**
     * 🚀 Lê o array de bens enviado pelo frontend.
     *
     * O modal de Contratos envia FormData (por causa dos PDFs), então o
     * campo `assets` chega como string JSON serializada — diferente de
     * `guarantor_ids[]`, que são valores escalares. Aqui decodificamos e
     * normalizamos cada item antes de devolver para validação/persistência.
     */
    /**
     * 🚀 Lê o array de testemunhas enviado pelo frontend.
     *
     * Mesmo padrão de `extractAssets`: no FormData o campo `witnesses`
     * chega como string JSON serializada.
     */
    private function extractWitnesses(Request $request): array
    {
        $raw = $request->input('witnesses');

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }

        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_map(
            fn ($witness) => StoreContractWitnessRequest::normalize((array) $witness),
            $raw
        ));
    }

    private function extractAssets(Request $request): array
    {
        $raw = $request->input('assets');

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }

        if (!is_array($raw)) {
            return [];
        }

        return array_values(array_map(
            fn ($asset) => StoreContractAssetRequest::normalize((array) $asset),
            $raw
        ));
    }

    /**
     * 🚀 Constrói o payload limpo de UM bem para gravação. Garante que
     * apenas as colunas conhecidas da tabela cheguem ao banco — qualquer
     * campo extra que vier do front (ex.: flags de UI) é descartado.
     */
    private function buildAssetPayload(array $a): array
    {
        return [
            'assetType'       => $a['assetType']       ?? null,
            'brand'           => $a['brand']           ?? null,
            'model'           => $a['model']           ?? null,
            'manufactureYear' => $a['manufactureYear'] ?? null,
            'modelYear'       => $a['modelYear']       ?? null,
            'plate'           => $a['plate']           ?? null,
            'renavam'         => $a['renavam']         ?? null,
            'chassis'         => $a['chassis']         ?? null,
            'description'     => $a['description']     ?? null,
            'location'        => $a['location']        ?? null,
            'registryNumber'  => $a['registryNumber']  ?? null,
            'totalArea'       => $a['totalArea']       ?? null,
            'boundaries'      => $a['boundaries']      ?? null,
        ];
    }

    /**
     * 🚀 Sincroniza os bens em garantia de UM contrato com a estratégia
     * "diff manual" — diferente do delete-and-recreate dos fiadores.
     *
     * Por que diff manual aqui?
     *   • Cada bem tem seu próprio createdAt e id; preservar esses dados
     *     é importante para auditoria e para qualquer relação futura.
     *   • Evita "ressuscitar" registros — IDs antigos continuam válidos.
     *
     * Algoritmo:
     *   1. Carrega os IDs atuais do banco para esse contrato.
     *   2. Para cada bem do payload:
     *        - Tem id e existe? → UPDATE (preserva createdAt).
     *        - Não tem id?       → CREATE (gera novo ID).
     *   3. IDs antigos que não vieram no payload → DELETE.
     *
     * Tudo dentro de uma transação para atomicidade
     * (atende ao "salvar tudo junto em uma Transaction" do briefing).
     */
    /**
     * Monta o payload limpo de UMA testemunha para gravação.
     */
    private function buildWitnessPayload(array $witness): array
    {
        return [
            'name' => $witness['name'] ?? null,
            'cpf'  => $witness['cpf']  ?? null,
            'ci'   => $witness['ci']   ?? null,
        ];
    }

    /**
     * 🚀 Sincroniza as testemunhas de UM contrato.
     *
     * Store  → createMany (lista pode ser vazia).
     * Update → delete-and-recreate (estratégia combinada no briefing).
     *
     * Tudo dentro de DB::transaction() para atomicidade.
     */
    private function syncContractWitnesses(int $contractId, array $witnesses, bool $isUpdate = false): void
    {
        $contract = Contract::find($contractId);
        if (! $contract) {
            return;
        }

        $payloads = array_map(
            fn ($witness) => $this->buildWitnessPayload($witness),
            $witnesses
        );

        DB::transaction(function () use ($contract, $payloads, $isUpdate) {
            if ($isUpdate) {
                $contract->witnesses()->delete();
            }

            if (! empty($payloads)) {
                $contract->witnesses()->createMany($payloads);
            }
        });
    }

    private function syncContractAssets(int $contractId, array $assets): void
    {
        $contract = Contract::find($contractId);
        if (! $contract) {
            return;
        }

        DB::transaction(function () use ($contract, $assets) {
            $existingIds = $contract->assets()->pluck('id')->all();
            $keptIds     = [];

            foreach ($assets as $asset) {
                $payload  = $this->buildAssetPayload($asset);
                $assetId  = isset($asset['id']) ? (int) $asset['id'] : 0;

                if ($assetId > 0 && in_array($assetId, $existingIds, true)) {
                    // UPDATE — preserva createdAt automaticamente
                    ContractAsset::where('id', $assetId)
                        ->where('contractId', $contract->id)
                        ->update($payload);
                    $keptIds[] = $assetId;
                } else {
                    // CREATE — id ignorado mesmo que tenha vindo (defesa contra spoofing)
                    $created   = $contract->assets()->create($payload);
                    $keptIds[] = $created->id;
                }
            }

            $toDelete = array_diff($existingIds, $keptIds);
            if (!empty($toDelete)) {
                $contract->assets()->whereIn('id', $toDelete)->delete();
            }
        });
    }

    public function viewPdf(int $id, Request $request)
    {
        $contract = DB::table('contracts')->where('id', $id)->first();
        if (!$contract || empty($contract->contractPdfPath)) {
            abort(404, 'Nenhum PDF encontrado.');
        }

        $paths = json_decode($contract->contractPdfPath, true);
        $names = json_decode($contract->sourcePdfName, true);
        $index = (int)$request->input('index', 0);

        if (!isset($paths[$index])) {
            abort(404, 'O documento solicitado não existe.');
        }

        $targetPath = $paths[$index];
        $disk = Storage::disk(self::PDF_DISK);
        
        if (!$disk->exists($targetPath)) {
            abort(404, 'Arquivo físico ausente.');
        }

        $stream = $disk->readStream($targetPath);
        $filename = $names[$index] ?? ('documento-' . $index . '.pdf');

        return new StreamedResponse(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . addslashes($filename) . '"',
        ]);
    }

    public function destroy(int $id)
    {
        $contract = DB::table('contracts')->where('id', $id)->first();
        if ($contract && !empty($contract->contractPdfPath)) {
            $paths = json_decode($contract->contractPdfPath, true);
            if (is_array($paths)) {
                foreach ($paths as $path) {
                    if (!empty($path) && Storage::disk(self::PDF_DISK)->exists($path)) {
                        Storage::disk(self::PDF_DISK)->delete($path);
                    }
                }
            }
        }

        DB::table('contracts')->where('id', $id)->delete();
        return redirect()->back();
    }

    private function buildContractPayload(Request $request, array $extras = [], bool $isUpdate = false): array
    {
        // 🚀 Credor (Consignor) — coluna nullable. String vazia vinda do
        // FormData é tratada como NULL (ex.: usuário desvinculou o credor).
        $rawConsignorId = $request->input('consignorId');
        $consignorId = ($rawConsignorId === null || $rawConsignorId === '' || $rawConsignorId === '0')
            ? null
            : (int) $rawConsignorId;

        $payload = [
            'clientId'                         => $request->input('clientId'),
            'consignorId'                      => $consignorId,
            'code'                             => $request->input('code'),
            'contractName'                     => $request->input('contractName'),
            'creditor'                         => $request->input('creditor'),
            'contract_type_id'                 => $request->input('contract_type_id'),
            'contractDate'                     => $request->input('contractDate'),
            'status'                           => $request->input('status', 'Ativo'),
            'validated'                        => filter_var($request->input('validated', false), FILTER_VALIDATE_BOOLEAN),
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
            'accelerates'                      => filter_var($request->input('accelerates', false), FILTER_VALIDATE_BOOLEAN),
            'accelerationRule'                 => $request->input('accelerationRule'),
            'accelerationConsecutiveThreshold' => $request->input('accelerationConsecutiveThreshold'),
            'accelerationAlternateThreshold'   => $request->input('accelerationAlternateThreshold'),
            
            // 🚀 NOVOS CAMPOS DINÂMICOS E AUDITORIA DE JUIZADO
            'chosenBankAccount'                => $request->input('chosenBankAccount'),
            'paymentMethod'                    => $request->input('paymentMethod', 'Boleto Bancário'),
            'forumLocation'                    => $request->input('forumLocation'), // ⚖️ Foro de Eleição contratual
            
            'guarantees'                       => $request->input('guarantees'),
            'guarantors'                       => $request->input('guarantors'),

            // 🚀 Confissão de Dívida (checkbox da guia "Garantias e Fiadores")
            'confessionOfDebt'                 => filter_var($request->input('confessionOfDebt', false), FILTER_VALIDATE_BOOLEAN),

            'validationUrl'                    => $request->input('validationUrl'),
            'observations'                     => $request->input('observations'),
        ];

        foreach ($extras as $key => $value) {
            if ($isUpdate && $value === null) {
                continue;
            }
            $payload[$key] = $value;
        }

        return $payload;
    }
}