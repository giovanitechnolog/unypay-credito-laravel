<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Smalot\PdfParser\Parser;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Contract;
use App\Models\ContractAsset;

class AiIngestionController extends Controller
{
    /**
     * Renderiza a nova view no menu
     */
    public function index(): Response
    {
        // 🚀 Catálogo de credores (consignors) hidratado para alimentar o
        // <select> de "Credor" na aba homônima da revisão de IA. Mantemos os
        // mesmos campos mínimos que o catálogo /api/consignors devolveria,
        // garantindo compatibilidade visual com a tela de Contracts.
        $consignors = DB::table('consignors')
            ->select('id', 'name', 'document', 'phone', 'email',
                     'street', 'number', 'neighborhood', 'zipCode', 'complement',
                     'city', 'state')
            ->orderBy('name')
            ->get();

        return Inertia::render('AiIngestion', [
            'contractTypes' => DB::table('contract_types')->get(),
            'existingClients' => DB::table('clients')
                ->select('id', 'name', 'document')
                ->get(),
            'consignors' => $consignors,
        ]);
    }

    /**
     * Processa o PDF e extrai via ChatGPT com JSON Schema rígido espelhando as abas do React.
     *
     * O JSON-schema cobre TODOS os papéis pessoais que o contrato pode mencionar:
     *   • fiadores      → cadastro completo (PF/PJ, nacionalidade, estado civil, endereço…)
     *   • codevedores   → mesma estrutura dos fiadores; o que muda é a role na pivot
     *   • testemunhas   → cadastro mínimo (nome + CPF + RG opcional); o restante é
     *                     hidratado automaticamente em save() como PF/Brasileiro/
     *                     "Não informado".
     * Também explode "garantias" em lista de bens estruturados (veículo OU imóvel),
     * espelhando exatamente a tabela contract_assets.
     */
    public function processPdf(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|mimes:pdf|max:20480',
        ]);

        try {
            $parser = new Parser();
            $pdf = $parser->parseFile($request->file('file')->getRealPath());
            $text = $pdf->getText();

            $truncatedText = mb_substr($text, 0, 15000);

            $apiKey = env('OPENAI_API_KEY');
            if (!$apiKey) {
                return response()->json(['error' => 'API Key da OpenAI não configurada no .env'], 500);
            }

            $systemPrompt = <<<'PROMPT'
Você é um robô de inteligência documental especializado em auditoria de crédito. Sua única função é ler o texto do contrato fornecido e extrair as cláusulas e informações estruturando-as OBRIGATORIAMENTE nas chaves especificadas abaixo. Não invente dados. Se um campo não for localizado, deixe-o como string vazia ou 0 para números. NUNCA omita uma chave: arrays vazios devem vir como [], objetos opcionais como objeto vazio.

Você deve retornar um objeto JSON contendo exatamente as seguintes seções estruturadas:

1. "dados_basicos":
   - "cliente_devedor"  (Nome completo do devedor principal)
   - "documento"        (CPF ou CNPJ formatado)
   - "cep"              (Apenas números ou formatado)
   - "endereco"         (Endereço residencial/comercial completo, em uma única linha)
   - "codigo_interno"   (Gere um código único ex: CONSIGNADO-NOME-ANO)
   - "data_emissao"     (Formato YYYY-MM-DD)
   - "credor_divida"    (Nome do credor ex: UnyPay S.A. ou HI Transportes)
   - "tipo"             (Use exatamente um dos rótulos: "Mútuo", "Consignado", "Confissão de Dívida")
   - "objeto"           (Nome/objeto curto descrevendo o contrato, ex: "Contrato de Mútuo c/ Garantia Veicular - Frota Volvo". Vazio se não houver título óbvio)
   - "status"           (Sempre retorne "Ativo")

2. "valores":
   - "valor_principal"  (Float — valor emprestado)
   - "valor_financiado" (Float — total financiado com encargos)
   - "numero_parcelas"  (Inteiro)
   - "valor_parcela"    (Float — prestação mensal)
   - "iof"              (Float — IOF, se houver. 0.00 se não localizado)

3. "banco":
   - "nome"     (ex: BANCO ITAÚ S.A.)
   - "agencia"  (Número da agência)
   - "conta"    (Número da conta com dígito)
   - "pix"      (Chave Pix se declarada; senão use o CPF/CNPJ do devedor)

4. "taxas":
   - "correcao_monetaria"      (IPCA, IGP-M ou PRE)
   - "data_primeiro_vencimento"(Formato YYYY-MM-DD)
   - "tac"                     (Tarifa de estruturação/cadastro em float; 0.00 se ausente)
   - "juros_mes"               (Float ex: 0.0338 para 3.38%)
   - "mora_mes"                (Float ex: 0.01 ou 0.02)
   - "multa_atraso"            (Float ex: 0.10 para 10%)
   - "honorarios"              (Float — honorários advocatícios em decimal ex: 0.20 para 20%; 0.00 se ausente)
   - "foro"                    (Comarca/Foro de eleição. Vazio se ausente)

5. "fiadores":
   Array de objetos. Cada objeto representa UM fiador (avalista) e DEVE conter:
   - "nome"          (Nome completo)
   - "personType"    ("PF" ou "PJ" — inferido pelo documento)
   - "documento"     (CPF se PF / CNPJ se PJ — formatado ou números)
   - "rg"            (RG, se localizado. Vazio se ausente)
   - "nacionalidade" (ex: "Brasileiro". Padrão: "Brasileiro")
   - "estado_civil"  (ex: Solteiro(a), Casado(a), União Estável, Divorciado(a), Viúvo(a). "Não informado" se ausente)
   - "tradeName"     (Nome fantasia, apenas se PJ. Vazio em PF)
   - "email"         (Vazio se ausente)
   - "telefone"      (Vazio se ausente)
   - "cep"           (CEP do endereço do fiador)
   - "rua"           (Logradouro)
   - "numero"        (Número)
   - "complemento"   (Apto/Bloco/Sala)
   - "bairro"
   - "cidade"
   - "uf"            (UF com 2 letras)

6. "codevedores":
   Array de objetos com EXATAMENTE a mesma estrutura de "fiadores" (todos os mesmos campos).
   Use sempre que o contrato chamar a parte de "codevedor", "co-obrigado solidário",
   "devedor solidário", "anuente solidário". NÃO duplicar quem já estiver em fiadores.

7. "testemunhas":
   Array de objetos. Cada objeto representa UMA testemunha do contrato e DEVE conter
   APENAS estes campos (o restante será hidratado automaticamente):
   - "nome"      (Nome completo)
   - "documento" (CPF formatado ou apenas números)
   - "rg"        (RG/CI, se localizado; vazio se ausente)

8. "garantias":
   Array de objetos. Cada objeto representa UM BEM ofertado em garantia. Pode haver 0,
   1 ou múltiplos bens. Estruture conforme o tipo:

   • Veículo (carro, caminhão, moto, frota):
     {
       "tipo": "vehicle",
       "brand":           (Marca, ex: Volvo),
       "model":           (Modelo, ex: FH 460),
       "manufactureYear": (Ano de fabricação — inteiro ou vazio),
       "modelYear":       (Ano do modelo — inteiro ou vazio),
       "plate":           (Placa — ex: ABC1D23),
       "renavam":         (Renavam),
       "chassis":         (Chassi/VIN — 17 caracteres se possível)
     }

   • Imóvel (lote, casa, apartamento, terreno):
     {
       "tipo": "real_estate",
       "description":    (Descrição livre do imóvel),
       "location":       (Endereço/localização do imóvel),
       "registryNumber": (Matrícula no cartório de registro de imóveis),
       "totalArea":      (Área total em m² — número ou string com decimal),
       "boundaries":     (Confrontações, se descritas)
     }

   Se o contrato for puramente quirografário (sem garantia real), retorne array vazio [].

9. "regras":
   - "confissao_divida" (Boolean — true se o instrumento for "Confissão de Dívida")
   - "observacoes"      (Texto livre com cláusulas específicas relevantes; vazio se nada destacável)
   - "url_validacao"    (URL externa de validação se mencionada; vazio se ausente)
   - "foro"             (Comarca/Foro de eleição. Repete o "foro" do bloco "taxas". Vazio se ausente)
PROMPT;

            $response = Http::withToken($apiKey)
                ->timeout(60)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-4o-mini',
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => $systemPrompt,
                        ],
                        [
                            'role' => 'user',
                            'content' => "Texto bruto do contrato para leitura:\n\n" . $truncatedText
                        ]
                    ],
                    'response_format' => [
                        'type' => 'json_object'
                    ],
                    'temperature' => 0.1
                ]);

            if ($response->failed()) {
                return response()->json(['error' => 'Erro na API da OpenAI: ' . $response->body()], 502);
            }

            $aiResult = json_decode($response->json('choices.0.message.content'), true) ?: [];

            // 🔧 Normaliza chaves opcionais para que o frontend nunca quebre
            //    em propriedades indefinidas (mesmo se o GPT esquecer alguma).
            $aiResult['fiadores']    = $aiResult['fiadores']    ?? [];
            $aiResult['codevedores'] = $aiResult['codevedores'] ?? [];
            $aiResult['testemunhas'] = $aiResult['testemunhas'] ?? [];
            $aiResult['garantias']   = $aiResult['garantias']   ?? [];
            $aiResult['regras']      = $aiResult['regras']      ?? [];

            // 🔄 Compatibilidade retroativa: se o modelo devolveu garantias no formato
            // antigo (objeto único com tipo_garantia + descricao_detalhada), converte
            // para o array novo para manter a UI estável.
            if (is_array($aiResult['garantias']) && isset($aiResult['garantias']['tipo_garantia'])) {
                $tipoLegado = $aiResult['garantias']['tipo_garantia'];
                $descLegado = $aiResult['garantias']['descricao_detalhada'] ?? '';
                if ($tipoLegado === 'veiculo' || $tipoLegado === 'imovel') {
                    $tipoNovo = $tipoLegado === 'veiculo'
                        ? ContractAsset::TYPE_VEHICLE
                        : ContractAsset::TYPE_REAL_ESTATE;
                    $aiResult['garantias'] = [[
                        'tipo'        => $tipoNovo,
                        'description' => $descLegado,
                    ]];
                } else {
                    $aiResult['garantias'] = [];
                }
            }

            return response()->json($aiResult);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Falha no processamento: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Salva o contrato com proteção anti-nulo, dispatch de papéis (fiador/
     * codevedor/testemunha) e gravação 1:N de bens em contract_assets.
     */
    public function save(Request $request): JsonResponse
    {
        $basicos     = $request->input('dados_basicos', []);
        $valores     = $request->input('valores', []);
        $banco       = $request->input('banco', []);
        $taxas       = $request->input('taxas', []);
        $fiadores    = $request->input('fiadores', []);
        $codevedores = $request->input('codevedores', []);
        $testemunhas = $request->input('testemunhas', []);
        $garantias   = $request->input('garantias', []);
        $regras      = $request->input('regras', []);

        if (empty($basicos['cliente_devedor']) || empty($basicos['documento'])) {
            return response()->json(['error' => 'Dados do devedor principal ausentes no payload.'], 422);
        }

        $docClean = preg_replace('/\D/', '', $basicos['documento']);

        try {
            DB::beginTransaction();

            $clientId = $this->resolveClientId($basicos, $banco, $docClean);

            $typeId = DB::table('contract_types')
                ->where('name', 'like', "%{$basicos['tipo']}%")
                ->value('id');

            if (!$typeId) {
                $typeId = DB::table('contract_types')->orderBy('id', 'asc')->value('id');
                if (!$typeId) {
                    $typeId = DB::table('contract_types')->insertGetId([
                        'name'      => 'Crédito Consignado Corporativo',
                        'createdAt' => now(),
                        'updatedAt' => now(),
                    ]);
                }
            }

            // 🚀 Resolução do credor (consignor) selecionado na aba "Credor".
            // O frontend pode mandar `consignor_id` direto OU enviar apenas o
            // nome textual em `credor_divida`. Quando vier o ID, validamos
            // contra a tabela e usamos o nome canônico do registro.
            $consignorId   = $request->input('consignor_id');
            $consignorName = null;
            if ($consignorId) {
                $consignorRow = DB::table('consignors')
                    ->where('id', (int) $consignorId)
                    ->first(['id', 'name']);
                if ($consignorRow) {
                    $consignorId   = (int) $consignorRow->id;
                    $consignorName = $consignorRow->name;
                } else {
                    $consignorId = null;
                }
            }

            $chosenAccount = trim(($banco['nome'] ?? '') . '-' . ($banco['agencia'] ?? '') . '-' . ($banco['conta'] ?? ''), '-');

            $contractId = DB::table('contracts')->insertGetId($this->filterToExistingColumns('contracts', [
                'clientId'            => $clientId,
                'consignorId'         => $consignorId,
                'code'                => $basicos['codigo_interno'] ?? uniqid('CT-'),
                // Permite que o operador sobrescreva o nome/objeto do contrato
                // a partir da aba Dados Básicos da revisão; cai num default
                // padronizado quando o campo está vazio.
                'contractName'        => $basicos['objeto']
                    ?? ('CONTRATO INTEGRADOR IA - ' . ($basicos['cliente_devedor'] ?? 'NÃO INFORMADO')),
                // Mantém o campo legado `creditor` (texto livre) sincronizado
                // com o nome do credor escolhido — ou cai no texto extraído
                // pela IA quando o operador não vincular formalmente.
                'creditor'            => $consignorName
                    ?? ($basicos['credor_divida'] ?? 'UnyPay® S.A.'),
                'contract_type_id'    => $typeId,
                'contractType'        => $basicos['tipo'] ?? 'Crédito Consignado',
                'contractDate'        => $basicos['data_emissao'] ?? now()->toDateString(),
                // Usa o status escolhido na UI (default Ativo). A enum aceita
                // apenas Ativo/Inadimplente/Quitado/Renegociado/Cancelado, então
                // fazemos um whitelist para não estourar a constraint do banco.
                'status'              => in_array($basicos['status'] ?? 'Ativo',
                    ['Ativo', 'Inadimplente', 'Quitado', 'Renegociado', 'Cancelado'], true)
                    ? $basicos['status']
                    : 'Ativo',
                'validated'           => true,
                'principalAmount'     => (float)($valores['valor_principal'] ?? 0),
                'financedTotal'       => (float)($valores['valor_financiado'] ?? ($valores['valor_principal'] ?? 0)),
                'iofAmount'           => (float)($valores['iof'] ?? 0),
                'installmentCount'    => (int)($valores['numero_parcelas'] ?? 12),
                'installmentAmount'   => (float)($valores['valor_parcela'] ?? 0),
                'firstDueDate'        => !empty($taxas['data_primeiro_vencimento']) ? $taxas['data_primeiro_vencimento'] : null,
                'tacAmount'           => (float)($taxas['tac'] ?? 0),
                'monthlyInterestRate' => (float)($taxas['juros_mes'] ?? 0),
                'moraRateMonthly'     => (float)($taxas['mora_mes'] ?? 0.02),
                'penaltyRate'         => (float)($taxas['multa_atraso'] ?? 0.10),
                'honoraryRate'        => (float)($taxas['honorarios'] ?? 0),
                'penaltyBaseType'     => 'installment',
                'penaltyScope'        => 'per_installment',
                'correctionIndex'     => $taxas['correcao_monetaria'] ?? 'PRE',
                'chosenBankAccount'   => $chosenAccount ?: 'Não informada',
                'paymentMethod'       => 'Boleto Bancário',
                'forumLocation'       => $taxas['foro'] ?? ($regras['foro'] ?? 'Belo Horizonte / MG'),
                // Mantém o campo legado `guarantees` como uma sumarização textual,
                // útil para listagens. A tabela canônica é contract_assets.
                'guarantees'          => $this->buildGuaranteesSummary($garantias),
                'confessionOfDebt'    => filter_var($regras['confissao_divida'] ?? false, FILTER_VALIDATE_BOOLEAN),
                'observations'        => $regras['observacoes']   ?? null,
                'validationUrl'       => $regras['url_validacao'] ?? null,
                'user_id'             => Auth::id() ?? DB::table('users')->orderBy('id', 'asc')->value('id') ?? 1,
                'createdAt'           => now(),
                'updatedAt'           => now(),
            ]));

            // 4️⃣  Pessoas vinculadas — fiadores, codevedores, testemunhas.
            //     Cada papel usa a MESMA tabela mestre `guarantors` e a pivot
            //     `contract_guarantor`, escopados pela coluna `role`.
            $this->syncPeopleRole($clientId, $contractId, $fiadores,    Contract::ROLE_FIADOR);
            $this->syncPeopleRole($clientId, $contractId, $codevedores, Contract::ROLE_CODEVEDOR);
            $this->syncPeopleRole($clientId, $contractId, $testemunhas, Contract::ROLE_TESTEMUNHA);

            // 5️⃣  Bens em garantia (1:N — contract_assets).
            $this->syncAssetsFromAi($contractId, $garantias);

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Contrato e amarrações salvos com sucesso!']);
        } catch (\Throwable $e) {
            DB::rollBack();
            // Registra o stacktrace completo no laravel.log para diagnóstico —
            // o frontend continua recebendo apenas a mensagem (não exibe rastros).
            \Log::error('[AiIngestion@save] '.$e->getMessage(), [
                'file'    => $e->getFile(),
                'line'    => $e->getLine(),
                'payload' => $request->all(),
                'trace'   => collect($e->getTrace())->take(8)->all(),
            ]);
            return response()->json([
                'error'   => 'Falha crítica no banco: ' . $e->getMessage(),
                'context' => app()->environment('local')
                    ? ['file' => basename($e->getFile()), 'line' => $e->getLine()]
                    : null,
            ], 500);
        }
    }

    /**
     * Resolve (ou cria) o cliente devedor pelo CPF/CNPJ. Mantém comportamento
     * legado de hidratar bankAccounts no campo `notes` quando criado pela IA.
     */
    private function resolveClientId(array $basicos, array $banco, string $docClean): int
    {
        $clientId = DB::table('clients')->where('document', $docClean)->value('id');
        if ($clientId) {
            return (int) $clientId;
        }

        $bankAccounts = [];
        if (!empty($banco['nome'])) {
            $bankAccounts[] = [
                'banco'   => $banco['nome'],
                'agencia' => $banco['agencia'] ?? '',
                'conta'   => $banco['conta']   ?? '',
                'tipo'    => 'Corrente',
                'hasPix'  => !empty($banco['pix']),
                'pixKey'  => $banco['pix'] ?? '',
            ];
        }

        return (int) DB::table('clients')->insertGetId(
            $this->filterToExistingColumns('clients', [
                'name'       => $basicos['cliente_devedor'],
                'document'   => $docClean,
                'zipCode'    => preg_replace('/\D/', '', $basicos['cep'] ?? ''),
                'address'    => $basicos['endereco'] ?? 'Não especificado',
                'city'       => 'Não Informada',
                'state'      => 'MG',
                'personType' => strlen($docClean) > 11 ? 'PJ' : 'PF',
                'notes'      => json_encode(['bankAccounts' => $bankAccounts]),
                'createdAt'  => now(),
                'updatedAt'  => now(),
            ])
        );
    }

    /**
     * Vincula uma lista de pessoas a um contrato em determinado papel
     * (FIADOR/CODEVEDOR/TESTEMUNHA), criando ou reaproveitando o cadastro
     * mestre em `guarantors`.
     *
     * Para TESTEMUNHA aplicamos defaults exigidos pela regra de negócio:
     *   • personType    = 'PF'
     *   • nationality   = 'Brasileiro'
     *   • maritalStatus = 'Não informado'
     */
    private function syncPeopleRole(int $clientId, int $contractId, array $people, string $role): void
    {
        if (empty($people) || !is_array($people)) {
            return;
        }

        foreach ($people as $person) {
            if (empty($person['nome'])) {
                continue;
            }

            $guarantorId = $this->upsertGuarantor($person, $role);
            if (!$guarantorId) {
                continue;
            }

            // Vínculo cliente ↔ pessoa (catálogo do cliente). Mantém pessoa disponível
            // para sugestão futura na criação de outros contratos.
            DB::table('client_guarantor')->updateOrInsert(
                ['clientId' => $clientId, 'guarantorId' => $guarantorId],
                ['clientId' => $clientId, 'guarantorId' => $guarantorId]
            );

            // Vínculo contrato ↔ pessoa COM role. updateOrInsert garante
            // idempotência respeitando o índice unique (contractId,
            // guarantorId, role) introduzido em 2026_06_03_120000.
            DB::table('contract_guarantor')->updateOrInsert(
                [
                    'contractId'  => $contractId,
                    'guarantorId' => $guarantorId,
                    'role'        => $role,
                ],
                [
                    'createdAt' => now(),
                    'updatedAt' => now(),
                ]
            );
        }
    }

    /**
     * Cria (ou encontra) um guarantor a partir do payload da IA. Para
     * testemunhas aplica os defaults obrigatórios. Aceita PF e PJ.
     *
     * Retorna null se não houver dado mínimo (nome) ou se o documento for
     * inválido para o tipo selecionado.
     */
    private function upsertGuarantor(array $person, string $role): ?int
    {
        // 🚀 Fast-path: quando o frontend envia `id`, a pessoa já existe no
        // cadastro (foi selecionada via GuarantorSearchModal). Validamos a
        // existência e reusamos diretamente, sem buscar por documento.
        // Isso espelha o comportamento da tela de Contratos, onde fiadores
        // "isFromDb=true" entram no payload apenas como ID.
        if (!empty($person['id']) && is_numeric($person['id'])) {
            $existsId = DB::table('guarantors')->where('id', (int) $person['id'])->value('id');
            if ($existsId) {
                return (int) $existsId;
            }
        }

        // 🚀 Após a unificação de "Pessoas", testemunhas também podem ser PJ
        // (espelha o comportamento da tela de Contratos, onde os três papéis
        // usam o mesmo cadastro mestre). Respeitamos o `personType` enviado
        // pelo front; quando ausente — caso do schema enxuto da IA, que só
        // traz nome/documento/rg — caímos no default PF.
        // O parâmetro `$role` continua disponível para uso futuro (auditoria,
        // logs, regras específicas por papel), apesar de já não fazer
        // bifurcação de defaults aqui.
        $personType = strtoupper((string)($person['personType'] ?? 'PF'));
        if (!in_array($personType, ['PF', 'PJ'], true)) {
            $personType = 'PF';
        }

        $rawDoc  = (string)($person['documento'] ?? '');
        $docClean = preg_replace('/\D/', '', $rawDoc);

        // Tenta primeiro encontrar pelo documento limpo (evita duplicar pessoas
        // já cadastradas em outros contratos / como cliente).
        $existing = null;
        if ($personType === 'PF' && strlen($docClean) === 11) {
            $existing = DB::table('guarantors')->where('cpf', $docClean)->first();
        } elseif ($personType === 'PJ' && strlen($docClean) === 14) {
            $existing = DB::table('guarantors')->where('cnpj', $docClean)->first();
        }

        if ($existing) {
            return (int) $existing->id;
        }

        $payload = [
            'name'        => trim((string) $person['nome']),
            'personType'  => $personType,
            'email'       => $person['email']    ?? null,
            'phone'       => $person['telefone'] ?? ($person['phone'] ?? null),
            'rg'          => $person['rg']       ?? null,
            'street'      => $person['rua']         ?? ($person['street']       ?? null),
            'number'      => $person['numero']      ?? ($person['number']       ?? null),
            'complement'  => $person['complemento'] ?? ($person['complement']   ?? null),
            'neighborhood'=> $person['bairro']      ?? ($person['neighborhood'] ?? null),
            'city'        => $person['cidade']      ?? ($person['city']         ?? null),
            'state'       => $person['uf']          ?? ($person['state']        ?? null),
            'zipCode'     => isset($person['cep']) ? preg_replace('/\D/', '', (string) $person['cep']) : null,
            'createdAt'   => now(),
            'updatedAt'   => now(),
        ];

        if ($personType === 'PF') {
            $payload['cpf']           = $docClean !== '' && strlen($docClean) === 11 ? $docClean : null;
            // 🚀 Como o cadastro de pessoas é unificado (mesma tabela `guarantors`
            // para fiadores, codevedores e testemunhas), respeitamos os valores
            // explicitamente informados pelo operador no modal. Quando ausentes,
            // caímos em defaults sensatos — "Brasileiro" para nacionalidade,
            // "Não informado" para estado civil — para satisfazer o NOT NULL/
            // expectativa downstream do banco.
            $payload['nationality']   = !empty($person['nacionalidade'])
                ? $person['nacionalidade']
                : (!empty($person['nationality']) ? $person['nationality'] : 'Brasileiro');
            $payload['maritalStatus'] = !empty($person['estado_civil'])
                ? $person['estado_civil']
                : (!empty($person['maritalStatus']) ? $person['maritalStatus'] : 'Não informado');
        } else {
            $payload['cnpj']               = $docClean !== '' && strlen($docClean) === 14 ? $docClean : null;
            $payload['tradeName']          = $person['tradeName']           ?? null;
            $payload['stateRegistration']  = $person['stateRegistration']   ?? null;
        }

        // 🛡️ Resiliência a esquemas de banco desatualizados: alguma instância
        // pode ainda não ter rodado as migrations mais recentes (`email`,
        // `phone`, `complement`...). Filtramos o payload para inserir apenas
        // colunas realmente existentes na tabela `guarantors`, evitando
        // SQLSTATE 42S22 ("Unknown column") em ambientes parcialmente
        // migrados — sem perder os dados quando o schema está em dia.
        $payload = $this->filterToExistingColumns('guarantors', $payload);

        return (int) DB::table('guarantors')->insertGetId($payload);
    }

    /**
     * Mantém no array apenas as chaves que correspondem a colunas existentes
     * na tabela informada. O resultado de `getColumnListing` é cacheado em
     * memória estática (mesma request) para evitar batidas extras no
     * information_schema.
     *
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    private function filterToExistingColumns(string $table, array $payload): array
    {
        static $cache = [];
        if (!isset($cache[$table])) {
            $cache[$table] = array_flip(Schema::getColumnListing($table));
        }
        return array_intersect_key($payload, $cache[$table]);
    }

    /**
     * Insere os bens em contract_assets a partir do array que veio da IA.
     * Aceita os tipos canônicos do model (vehicle/real_estate) e também os
     * tipos legados (veiculo/imovel) para compatibilidade.
     */
    private function syncAssetsFromAi(int $contractId, array $garantias): void
    {
        if (empty($garantias) || !is_array($garantias)) {
            return;
        }

        // Caso ainda venha o objeto único legado, normaliza para array.
        if (isset($garantias['tipo']) || isset($garantias['tipo_garantia'])) {
            $garantias = [$garantias];
        }

        foreach ($garantias as $g) {
            if (!is_array($g)) {
                continue;
            }

            $tipoBruto = $g['tipo'] ?? $g['tipo_garantia'] ?? null;
            $assetType = match ($tipoBruto) {
                'vehicle', 'veiculo'           => ContractAsset::TYPE_VEHICLE,
                'real_estate', 'imovel'        => ContractAsset::TYPE_REAL_ESTATE,
                default                        => null,
            };

            if (!$assetType) {
                continue;
            }

            $row = [
                'contractId' => $contractId,
                'assetType'  => $assetType,
                'createdAt'  => now(),
                'updatedAt'  => now(),
            ];

            if ($assetType === ContractAsset::TYPE_VEHICLE) {
                $row['brand']           = $g['brand']           ?? null;
                $row['model']           = $g['model']           ?? null;
                $row['manufactureYear'] = isset($g['manufactureYear']) && $g['manufactureYear'] !== '' ? (int) $g['manufactureYear'] : null;
                $row['modelYear']       = isset($g['modelYear'])       && $g['modelYear']       !== '' ? (int) $g['modelYear']       : null;
                $row['plate']           = $g['plate']           ?? null;
                $row['renavam']         = $g['renavam']         ?? null;
                $row['chassis']         = $g['chassis']         ?? null;
            } else {
                $row['description']    = $g['description']    ?? ($g['descricao_detalhada'] ?? null);
                $row['location']       = $g['location']       ?? null;
                $row['registryNumber'] = $g['registryNumber'] ?? null;
                $row['totalArea']      = isset($g['totalArea']) && $g['totalArea'] !== '' ? $g['totalArea'] : null;
                $row['boundaries']     = $g['boundaries']     ?? null;
            }

            DB::table('contract_assets')->insert(
                $this->filterToExistingColumns('contract_assets', $row)
            );
        }
    }

    /**
     * Sumariza textualmente os bens para o campo legado `contracts.guarantees`,
     * preservado por compatibilidade com listagens/relatórios já existentes.
     */
    private function buildGuaranteesSummary(array $garantias): string
    {
        if (empty($garantias)) {
            return '';
        }

        $lines = [];
        foreach ($garantias as $g) {
            if (!is_array($g)) {
                continue;
            }
            $tipo = $g['tipo'] ?? $g['tipo_garantia'] ?? '';
            if ($tipo === 'vehicle' || $tipo === 'veiculo') {
                $brand = $g['brand'] ?? '';
                $model = $g['model'] ?? '';
                $plate = $g['plate'] ?? '';
                $year  = $g['modelYear'] ?? $g['manufactureYear'] ?? '';
                $lines[] = trim("Veículo: {$brand} {$model} {$year} {$plate}");
            } elseif ($tipo === 'real_estate' || $tipo === 'imovel') {
                $desc = $g['description'] ?? ($g['descricao_detalhada'] ?? '');
                $loc  = $g['location'] ?? '';
                $lines[] = trim("Imóvel: {$desc}" . ($loc ? " ({$loc})" : ''));
            }
        }

        return implode(' | ', array_filter($lines));
    }
}
