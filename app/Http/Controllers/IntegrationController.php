<?php

namespace App\Http\Controllers;

use App\Models\Integration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Throwable;

/**
 * Controller responsável por:
 *   1) Proxy de integrações fixas (atualmente: lookup de CNPJ na ReceitaWS) —
 *      mantém o método legado `lookupCnpj` que já é consumido pelo cadastro
 *      de Pessoas e pela ingestão por IA.
 *   2) CRUD de configurações de integrações externas (`integrations` table) —
 *      permite que o operador cadastre URL/credenciais de novas integrações
 *      pela própria UI, sem alterar código.
 *   3) Endpoint `test` que dispara um GET no `baseUrl` (+ `testEndpoint`
 *      opcional) usando as credenciais cadastradas, para que o operador
 *      possa validar a configuração com um clique.
 */
class IntegrationController extends Controller
{
    /**
     * Finalidades suportadas — usadas para identificar QUAL integração
     * cadastrada o sistema deve acionar em cada feature:
     *
     *   • cpf_lookup  → SIGx/Rodopar (consulta automática de PF por CPF)
     *   • cnpj_lookup → ReceitaWS/equivalente (consulta automática de PJ)
     *   • other       → Outras integrações genéricas
     *
     * A coluna `type` na tabela armazena este valor; o operador escolhe
     * pela UI no campo "FINALIDADE" do formulário.
     */
    public const TYPE_CPF_LOOKUP  = 'cpf_lookup';
    public const TYPE_CNPJ_LOOKUP = 'cnpj_lookup';
    public const TYPE_OTHER       = 'other';

    private const TYPE_OPTIONS = [
        self::TYPE_CPF_LOOKUP,
        self::TYPE_CNPJ_LOOKUP,
        self::TYPE_OTHER,
    ];

    private const ENVIRONMENT_OPTIONS = [
        'producao',
        'desenvolvimento',
    ];

    private const AUTH_TYPE_OPTIONS = [
        'none',
        'apikey',
        'bearer',
        'basic',
    ];

    /**
     * 🚀 Consulta de PF por CPF na integração ativa do tipo `cpf_lookup`
     * (SIGx/Rodopar). Substitui inputação manual de dados em qualquer CRUD
     * que tenha o botão "Sincronizar com SIGx".
     *
     * Estratégia de descoberta:
     *   1) Procura uma integração ATIVA com `type = 'cpf_lookup'`. Se
     *      existir mais de uma, prioriza a de `producao`. Em ambientes de
     *      teste o operador pode marcar a `desenvolvimento` como ativa
     *      em vez da produção.
     *   2) Monta a URL final concatenando `baseUrl + endpoint` (campo
     *      `testEndpoint` no schema, exibido como "ENDPOINT" na UI).
     *   3) Anexa `cpf_cnpj=<digits>&per_page=100&page=1` como querystring,
     *      compatível com o contrato do SIGx
     *      (`/api/v1/parceiros?cpf_cnpj=...`).
     *   4) Aplica auth (apikey/bearer/basic) conforme cadastrado.
     *   5) Devolve `data[0]` da resposta (o SIGx retorna um array
     *      paginado mesmo para 1 registro). Em caso de "nenhum
     *      encontrado", devolve 404 amigável.
     *
     * Em qualquer falha de comunicação devolve 503 com a mensagem
     * detalhada — o frontend deve apenas exibir um toast e manter o
     * formulário inalterado para não atrapalhar o operador.
     */
    public function lookupCpf(string $cpf): JsonResponse
    {
        $digits = preg_replace('/\D/', '', $cpf) ?? '';

        if (strlen($digits) !== 11) {
            return response()->json([
                'message' => 'CPF inválido. Informe os 11 dígitos.',
            ], 422);
        }

        $integration = Integration::query()
            ->where('isActive', true)
            ->where('type', self::TYPE_CPF_LOOKUP)
            // Quando há mais de uma cadastrada (ex: Produção + Desenvolvimento
            // ambas ativas), preferimos a de produção para que a tela de
            // cadastro padrão consuma dados oficiais.
            ->orderByRaw("CASE WHEN environment = 'producao' THEN 0 ELSE 1 END")
            ->orderBy('updatedAt', 'desc')
            ->first();

        if (! $integration) {
            return response()->json([
                'message' => 'Nenhuma integração de consulta de CPF (SIGx) está cadastrada e ativa. '
                    . 'Acesse Sistema → Integrações para configurar.',
            ], 503);
        }

        $url = rtrim((string) $integration->baseUrl, '/');
        if ($integration->testEndpoint) {
            $url .= '/' . ltrim((string) $integration->testEndpoint, '/');
        }

        if ($url === '') {
            return response()->json([
                'message' => 'Integração SIGx sem URL configurada.',
            ], 503);
        }

        try {
            $request = Http::timeout(15)->acceptJson();

            switch ($integration->authType) {
                case 'apikey':
                    if ($integration->apiKey) {
                        $request = $request->withHeaders(['X-API-Key' => $integration->apiKey]);
                    }
                    break;
                case 'bearer':
                    if ($integration->apiKey) {
                        $request = $request->withToken($integration->apiKey);
                    }
                    break;
                case 'basic':
                    if ($integration->username !== null) {
                        $request = $request->withBasicAuth(
                            (string) $integration->username,
                            (string) ($integration->password ?? '')
                        );
                    }
                    break;
            }

            if (is_array($integration->extraHeaders) && ! empty($integration->extraHeaders)) {
                $request = $request->withHeaders($integration->extraHeaders);
            }

            $response = $request->get($url, [
                'cpf_cnpj' => $digits,
                'per_page' => 100,
                'page'     => 1,
            ]);

            // O SIGx pode sinalizar "CPF não localizado" de três formas
            // diferentes — todas devolvem 404 amigável para o front:
            //   1) HTTP 404 direto (versões mais recentes do endpoint).
            //   2) HTTP 200 com `data: []` (paginação sem resultados).
            //   3) HTTP 200 com chave `error`/`errors` no body (alguns
            //      provedores intermediários respondem assim).
            // O objetivo é produzir UMA mensagem amigável consistente,
            // sem expor o body cru da resposta upstream para o operador.
            if ($response->status() === 404) {
                return response()->json([
                    'message' => $this->buildCpfNotFoundMessage(
                        $digits,
                        $this->extractRemoteMessage($response->json(), $response->body())
                    ),
                ], 404);
            }

            if ($response->failed()) {
                $remote = $this->extractRemoteMessage($response->json(), $response->body());
                return response()->json([
                    'message' => $remote
                        ? "Falha ao consultar o SIGx (HTTP {$response->status()}): {$remote}"
                        : "SIGx respondeu HTTP {$response->status()} sem detalhes adicionais.",
                ], 502);
            }

            $payload = $response->json();
            if (! is_array($payload)) {
                return response()->json([
                    'message' => 'SIGx devolveu uma resposta inesperada (não-JSON). Tente novamente em instantes.',
                ], 502);
            }

            // Alguns gateways embarcam um campo `error` no body 200
            // quando o CPF não está cadastrado — tratamos como 404.
            if (isset($payload['error']) || isset($payload['errors'])) {
                return response()->json([
                    'message' => $this->buildCpfNotFoundMessage(
                        $digits,
                        $this->extractRemoteMessage($payload, '')
                    ),
                ], 404);
            }

            $records = $payload['data'] ?? [];
            if (! is_array($records) || count($records) === 0) {
                return response()->json([
                    'message' => $this->buildCpfNotFoundMessage($digits, null),
                ], 404);
            }

            // Sempre devolvemos o primeiro registro — em CPF a expectativa é
            // 1 resultado. Casos de homônimo dependeriam de UI dedicada.
            $first = $records[0];
            if (! is_array($first)) {
                return response()->json([
                    'message' => 'SIGx devolveu um registro em formato inválido.',
                ], 502);
            }

            return response()->json([
                'data'   => $this->normalizeSigxPerson($first, $digits),
                'source' => [
                    'integration' => $integration->name,
                    'environment' => $integration->environment,
                    'recordCount' => $payload['records_total'] ?? count($records),
                ],
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $this->describeHttpException($e, $url),
            ], 503);
        }
    }

    /**
     * Normaliza o registro de PF do SIGx para o shape consumido pelos
     * formulários do front (camelCase, alinhado aos campos dos modais
     * de Pessoas/Clientes/Usuários/GuarantorFormFields).
     *
     * Aceita variações de nomenclatura conhecidas (SIGx usa nomes em
     * português) e cai em null para campos não retornados — o frontend
     * usa esses nulls para destacar em vermelho o que ainda precisa ser
     * preenchido manualmente.
     *
     * Variações conhecidas tratadas explicitamente:
     *   • E-mail: `email` e `site_email` (o SIGx renomeou recentemente
     *     o campo, e versões antigas ainda mandam `email`).
     *   • Telefone: pode vir com prefixo de país (`+55 (35) 9 8853-9242`).
     *     O front usa `maskPhone` brasileiro que re-aplica DDD + número
     *     a partir dos dígitos crus; se deixássemos o "+55" passar, os
     *     dois primeiros dígitos ("55") seriam interpretados como DDD.
     *   • `contatos[]`: usado como fallback quando os campos do topo
     *     vierem null/vazios e o registro contiver contatos secundários.
     */
    private function normalizeSigxPerson(array $row, string $cpfDigits): array
    {
        [$email, $phone] = $this->extractSigxContacts($row);

        return [
            'name'          => $row['nome']            ?? $row['name']        ?? null,
            'shortName'     => $row['nome_abreviado']  ?? null,
            'cpf'           => $row['cpf_cnpj']        ?? $row['cpf']         ?? $cpfDigits,
            'rg'            => $row['rg']              ?? null,
            'email'         => $email,
            'phone'         => $phone,
            'birthDate'     => $row['data_nascimento'] ?? $row['birthDate']   ?? null,
            'gender'        => $row['sexo']            ?? $row['gender']      ?? null,
            'maritalStatus' => $row['estado_civil']    ?? $row['maritalStatus'] ?? null,
            'nationality'   => $row['nacionalidade']   ?? $row['nationality']   ?? null,
            'street'        => $row['logradouro']      ?? $row['rua']         ?? $row['street']       ?? null,
            'number'        => $row['numero']          ?? $row['number']      ?? null,
            'complement'    => $row['complemento']     ?? $row['complement']  ?? null,
            'neighborhood'  => $row['bairro']          ?? $row['neighborhood'] ?? null,
            'city'          => $row['cidade']          ?? $row['municipio']   ?? $row['city']         ?? null,
            'state'         => $row['uf']              ?? $row['estado']      ?? $row['state']        ?? null,
            'zipCode'       => $row['cep']             ?? $row['zipCode']     ?? null,
        ];
    }

    /**
     * Resolve o par (email, telefone) a partir de um registro do SIGx,
     * lidando com renomeações de campos e fallback para a lista
     * `contatos[]` quando o topo do registro vier vazio.
     *
     * @return array{0: ?string, 1: ?string} [email, phone]
     */
    private function extractSigxContacts(array $row): array
    {
        $email = $this->firstNonEmpty([$row['email'] ?? null, $row['site_email'] ?? null]);
        $phone = $this->firstNonEmpty([$row['telefone'] ?? null, $row['phone'] ?? null]);

        if (($email === null || $phone === null) && isset($row['contatos']) && is_array($row['contatos'])) {
            foreach ($row['contatos'] as $contato) {
                if (! is_array($contato)) {
                    continue;
                }
                if ($email === null) {
                    $email = $this->firstNonEmpty([$contato['email'] ?? null, $contato['site_email'] ?? null]);
                }
                if ($phone === null) {
                    $phone = $this->firstNonEmpty([$contato['telefone'] ?? null, $contato['phone'] ?? null]);
                }
                if ($email !== null && $phone !== null) {
                    break;
                }
            }
        }

        return [$email, $this->stripPhoneCountryCode($phone)];
    }

    /**
     * Remove o prefixo de código de país brasileiro ("+55") do telefone.
     *
     * Por que: os formulários do front aplicam um `maskPhone` brasileiro
     * que re-mascara a partir dos dígitos crus (`(DD) NNNNN-NNNN`). Se
     * mantivéssemos o "+55", o mask trataria os dois primeiros dígitos
     * como o DDD e produziria um telefone bizarro.
     *
     * Casos suportados: "+55 (35) ...", "55 (35) ...", "+55-35-...".
     * Telefones sem prefixo de país passam intactos.
     */
    private function stripPhoneCountryCode(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $trimmed = trim($phone);
        if ($trimmed === '') {
            return null;
        }

        $stripped = preg_replace('/^\+?55[\s\-]*/', '', $trimmed);

        return $stripped !== null && $stripped !== '' ? $stripped : $trimmed;
    }

    /**
     * Devolve o primeiro valor não-nulo e não-vazio (após trim) de uma
     * lista. Útil para resolver "este campo veio com o nome A ou B,
     * pega o que estiver preenchido".
     */
    private function firstNonEmpty(array $candidates): ?string
    {
        foreach ($candidates as $value) {
            if ($value === null) {
                continue;
            }
            $trimmed = trim((string) $value);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }

        return null;
    }

    /**
     * Monta a mensagem amigável de "CPF não localizado" exibida no
     * toast do front quando a sincronização não encontra a pessoa.
     *
     * A mensagem é deliberadamente acolhedora — o operador pode estar
     * cadastrando uma pessoa nova, então não é um erro: é só um aviso
     * de que ele precisa preencher os campos manualmente.
     *
     * Quando o SIGx devolve algum motivo específico (ex.: "CPF inválido
     * no nosso cadastro", "Cliente bloqueado"), incorporamos essa frase
     * entre parênteses para dar contexto ao operador, mas SEMPRE com a
     * orientação de preenchimento manual em primeiro lugar.
     */
    private function buildCpfNotFoundMessage(string $cpfDigits, ?string $remoteMessage): string
    {
        $masked = $this->maskCpfForDisplay($cpfDigits);
        $base   = "CPF {$masked} não localizado na base do SIGx — preencha os dados manualmente.";

        if ($remoteMessage !== null && $remoteMessage !== '') {
            // Evita repetir a frase "CPF não encontrado" ao concatenar:
            // se o motivo upstream já contém essa expressão, ignoramos.
            $lower = mb_strtolower($remoteMessage);
            if (! str_contains($lower, 'não encontrado') && ! str_contains($lower, 'nao encontrado')) {
                return $base . ' (Motivo do SIGx: ' . $remoteMessage . ')';
            }
        }

        return $base;
    }

    /**
     * Aplica a máscara `XXX.XXX.XXX-XX` para exibição em mensagens.
     * Não usar para gravação — só para humanizar o toast.
     */
    private function maskCpfForDisplay(string $digits): string
    {
        if (strlen($digits) !== 11) {
            return $digits;
        }

        return substr($digits, 0, 3) . '.'
             . substr($digits, 3, 3) . '.'
             . substr($digits, 6, 3) . '-'
             . substr($digits, 9, 2);
    }

    /**
     * Extrai uma mensagem amigável de um corpo de resposta do SIGx,
     * tentando as chaves mais comuns em respostas de erro de APIs
     * brasileiras (Laravel, FastAPI, Django REST e custom). Se o
     * body for HTML (página de erro de gateway, 502 nginx, etc.) ou
     * estiver vazio, devolve null para que o caller use o texto padrão.
     *
     * Mensagens muito longas são truncadas em 200 caracteres para não
     * estourarem a largura do toast no front.
     */
    private function extractRemoteMessage($payload, string $rawBody): ?string
    {
        if (is_array($payload)) {
            $candidates = [
                $payload['message']           ?? null,
                $payload['error']             ?? null,
                $payload['error_description'] ?? null,
                $payload['detail']            ?? null,
                $payload['msg']               ?? null,
            ];

            // `errors` pode ser uma lista — pega o primeiro item textual.
            if (isset($payload['errors']) && is_array($payload['errors'])) {
                foreach ($payload['errors'] as $err) {
                    if (is_string($err)) {
                        $candidates[] = $err;
                        break;
                    }
                    if (is_array($err)) {
                        $candidates[] = $err['message'] ?? $err['detail'] ?? null;
                        break;
                    }
                }
            }

            foreach ($candidates as $candidate) {
                if (is_string($candidate) && trim($candidate) !== '') {
                    $clean = trim($candidate);
                    return mb_strlen($clean) > 200 ? mb_substr($clean, 0, 200) . '…' : $clean;
                }
            }
        }

        $body = trim($rawBody);
        if ($body === '' || str_starts_with($body, '<')) {
            return null;
        }

        return mb_strlen($body) > 200 ? mb_substr($body, 0, 200) . '…' : $body;
    }

    /**
     * Proxy para consulta de CNPJ na ReceitaWS (evita CORS no frontend).
     */
    public function lookupCnpj(string $cnpj): JsonResponse
    {
        $digits = preg_replace('/\D/', '', $cnpj);

        if (strlen($digits) !== 14) {
            return response()->json([
                'message' => 'CNPJ inválido. Informe 14 dígitos.',
            ], 422);
        }

        try {
            $response = Http::timeout(15)
                ->get("https://www.receitaws.com.br/v1/cnpj/{$digits}");

            if ($response->failed()) {
                $status = $response->status();

                if ($status === 429) {
                    return response()->json([
                        'message' => 'Limite de consultas excedido. Aguarde alguns instantes e tente novamente.',
                    ], 429);
                }

                return response()->json([
                    'message' => 'Serviço da Receita Federal indisponível no momento.',
                ], 503);
            }

            $data = $response->json();

            if (! is_array($data)) {
                return response()->json([
                    'message' => 'Resposta inválida ao consultar CNPJ.',
                ], 502);
            }

            if (($data['status'] ?? null) === 'ERROR') {
                $message = $data['message'] ?? 'CNPJ não encontrado.';

                if (stripos($message, 'limite') !== false || stripos($message, 'rate') !== false) {
                    return response()->json(['message' => $message], 429);
                }

                return response()->json(['message' => $message], 404);
            }

            return response()->json($data);
        } catch (\Throwable) {
            return response()->json([
                'message' => 'Falha ao consultar CNPJ. Tente novamente em instantes.',
            ], 503);
        }
    }

    /* ────────────────────────────────────────────────────────────────────
     * 🚀 CRUD: Integrações
     * ──────────────────────────────────────────────────────────────────── */

    /**
     * Renderiza a SPA do cadastro de integrações.
     */
    public function page(): InertiaResponse
    {
        return Inertia::render('Integracoes', [
            'typeOptions'        => self::TYPE_OPTIONS,
            'environmentOptions' => self::ENVIRONMENT_OPTIONS,
            'authTypeOptions'    => self::AUTH_TYPE_OPTIONS,
        ]);
    }

    /**
     * Lista paginada (na prática, sem paginação — geralmente são poucas
     * integrações cadastradas) com busca por nome, tipo ou descrição.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->input('search', ''));

        $query = Integration::query()->orderBy('name', 'asc');

        if ($search !== '') {
            $like = "%{$search}%";
            $query->where(function ($q) use ($like) {
                $q->where('name', 'like', $like)
                  ->orWhere('description', 'like', $like)
                  ->orWhere('baseUrl', 'like', $like);
            });
        }

        $rows = $query->get();

        // Estatísticas para os 4 cards no topo da tela. Calculadas a partir
        // da lista completa (não da filtrada) para refletir o estado real
        // do cadastro mesmo quando há busca ativa.
        $all = Integration::query()->select(['id', 'isActive', 'environment'])->get();

        return response()->json([
            'data'  => $rows,
            'stats' => [
                'total'       => $all->count(),
                'active'      => $all->where('isActive', true)->count(),
                'production'  => $all->where('environment', 'producao')->count(),
                'development' => $all->where('environment', 'desenvolvimento')->count(),
            ],
        ]);
    }

    /**
     * Cria uma nova integração.
     */
    public function store(Request $request): JsonResponse
    {
        $payload = $this->validatePayload($request);

        try {
            $integration = Integration::create($payload);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $this->isUniqueViolation($e)
                    ? 'Já existe uma integração com esses dados.'
                    : 'Falha ao gravar integração: ' . $e->getMessage(),
            ], $this->isUniqueViolation($e) ? 422 : 500);
        }

        return response()->json([
            'message' => 'Integração registrada com sucesso.',
            'data'    => $integration,
        ], 201);
    }

    /**
     * Atualiza uma integração existente.
     *
     * Importante: campos sensíveis (apiKey/apiSecret/password) só são
     * sobrescritos quando o frontend envia um valor não vazio. Isso permite
     * que o usuário edite a integração sem precisar redigitar a credencial
     * a cada salvamento.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $integration = Integration::find($id);
        if (! $integration) {
            return response()->json(['message' => 'Integração não encontrada.'], 404);
        }

        $payload = $this->validatePayload($request, $id);

        // Preserva credenciais antigas se o frontend mandou string vazia
        // (caso típico: usuário não quis trocar a apiKey).
        foreach (['apiKey', 'apiSecret', 'password'] as $secret) {
            if (! $request->filled($secret)) {
                unset($payload[$secret]);
            }
        }

        try {
            $integration->update($payload);
        } catch (Throwable $e) {
            return response()->json([
                'message' => $this->isUniqueViolation($e)
                    ? 'Já existe uma integração com esses dados.'
                    : 'Falha ao atualizar integração: ' . $e->getMessage(),
            ], $this->isUniqueViolation($e) ? 422 : 500);
        }

        return response()->json([
            'message' => 'Integração atualizada com sucesso.',
            'data'    => $integration->fresh(),
        ]);
    }

    /**
     * Remove uma integração.
     */
    public function destroy(int $id): JsonResponse
    {
        $integration = Integration::find($id);
        if (! $integration) {
            return response()->json(['message' => 'Integração não encontrada.'], 404);
        }

        $integration->delete();

        return response()->json(['message' => 'Integração removida com sucesso.']);
    }

    /**
     * 🚀 Endpoint "Testar" — dispara uma chamada HTTP usando as credenciais
     * cadastradas e devolve sucesso/erro detalhado para a UI.
     *
     * Estratégia:
     *   • Monta a URL final com `baseUrl + testEndpoint` (testEndpoint vazio
     *     usa só a baseUrl).
     *   • Aplica o `authType` correto (apikey via header `X-API-Key`,
     *     bearer no `Authorization: Bearer ...`, basic via username/password).
     *   • Adiciona quaisquer `extraHeaders` configurados.
     *   • Persiste o resultado em `lastTested*` para histórico/diagnóstico.
     *
     * Em caso de erro, devolve HTTP 200 com `success=false` e a mensagem
     * de erro. Assim a UI consegue exibir o motivo amigavelmente sem
     * precisar tratar exceções.
     */
    public function test(int $id): JsonResponse
    {
        $integration = Integration::find($id);
        if (! $integration) {
            return response()->json(['message' => 'Integração não encontrada.'], 404);
        }

        $url = rtrim($integration->baseUrl ?? '', '/');
        if ($integration->testEndpoint) {
            $url .= '/' . ltrim($integration->testEndpoint, '/');
        }

        if ($url === '') {
            return response()->json([
                'success' => false,
                'message' => 'Integração sem URL configurada.',
            ]);
        }

        $headers = is_array($integration->extraHeaders) ? $integration->extraHeaders : [];

        $request = Http::timeout(15)->acceptJson();

        switch ($integration->authType) {
            case 'apikey':
                if ($integration->apiKey) {
                    $headers['X-API-Key'] = $integration->apiKey;
                }
                break;
            case 'bearer':
                if ($integration->apiKey) {
                    $request = $request->withToken($integration->apiKey);
                }
                break;
            case 'basic':
                if ($integration->username !== null) {
                    $request = $request->withBasicAuth(
                        (string) $integration->username,
                        (string) ($integration->password ?? '')
                    );
                }
                break;
            case 'none':
            default:
                // Sem autenticação adicional.
                break;
        }

        if (!empty($headers)) {
            $request = $request->withHeaders($headers);
        }

        $start = microtime(true);
        $success = false;
        $message = '';
        $httpCode = null;

        try {
            $response = $request->get($url);
            $httpCode = $response->status();

            if ($response->successful()) {
                $success = true;
                $elapsed = round((microtime(true) - $start) * 1000);
                $message = "Conexão OK em {$elapsed} ms (HTTP {$httpCode}).";
            } else {
                $body = trim((string) $response->body());
                if (mb_strlen($body) > 240) {
                    $body = mb_substr($body, 0, 240) . '…';
                }
                $message = $body !== ''
                    ? "HTTP {$httpCode} — {$body}"
                    : "Servidor respondeu com HTTP {$httpCode} sem corpo.";
            }
        } catch (Throwable $e) {
            $message = $this->describeHttpException($e, $url);
        }

        $integration->forceFill([
            'lastTestedAt'     => now(),
            'lastTestStatus'   => $success ? 'success' : 'failure',
            'lastTestMessage'  => $message,
            'lastTestHttpCode' => $httpCode,
        ])->save();

        return response()->json([
            'success'  => $success,
            'message'  => $message,
            'httpCode' => $httpCode,
            'url'      => $url,
            'data'     => $integration->fresh(),
        ]);
    }

    /* ────────────────────────────────────────────────────────────────────
     * 🔧 Helpers privados
     * ──────────────────────────────────────────────────────────────────── */

    /**
     * Validação compartilhada por store() e update().
     *
     * Em update, passamos `$id` para que a regra `unique` ignore o registro
     * sendo editado (caso contrário ele colidiria consigo mesmo).
     */
    private function validatePayload(Request $request, ?int $id = null): array
    {
        $rules = [
            'name'         => ['required', 'string', 'max:255'],
            'type'         => ['required', 'string', Rule::in(self::TYPE_OPTIONS)],
            'environment'  => ['required', 'string', Rule::in(self::ENVIRONMENT_OPTIONS)],
            'baseUrl'      => ['required', 'string', 'max:500', 'url:http,https'],
            'testEndpoint' => ['nullable', 'string', 'max:500'],
            'authType'     => ['required', 'string', Rule::in(self::AUTH_TYPE_OPTIONS)],
            'apiKey'       => ['nullable', 'string', 'max:5000'],
            'apiSecret'    => ['nullable', 'string', 'max:5000'],
            'username'     => ['nullable', 'string', 'max:255'],
            'password'     => ['nullable', 'string', 'max:1000'],
            'extraHeaders' => ['nullable', 'array'],
            'description'  => ['nullable', 'string', 'max:2000'],
            'isActive'     => ['nullable', 'boolean'],
        ];

        $request->validate($rules, [], [
            'name'        => 'nome',
            'type'        => 'finalidade',
            'environment' => 'ambiente',
            'baseUrl'     => 'URL base',
            'authType'    => 'tipo de autenticação',
            'apiKey'      => 'API Key',
            'isActive'    => 'status',
        ]);

        $data = $request->only(array_keys($rules));

        // Default seguro caso o frontend envie o campo vazio (defensivo).
        if (empty($data['type'])) {
            $data['type'] = self::TYPE_OTHER;
        }

        // Normaliza booleano que pode vir como string "true"/"1"/"on" do front.
        $data['isActive'] = filter_var(
            $data['isActive'] ?? true,
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        ) ?? true;

        return $data;
    }

    /**
     * Detecta violação de unique constraint de forma agnóstica de driver.
     */
    private function isUniqueViolation(Throwable $e): bool
    {
        $msg = strtolower($e->getMessage());
        return str_contains($msg, 'duplicate entry')
            || str_contains($msg, 'unique constraint')
            || str_contains($msg, '1062');
    }

    /**
     * Converte exceções de HTTP/cURL/timeout em mensagens curtas e
     * acionáveis para a UI.
     */
    private function describeHttpException(Throwable $e, string $url): string
    {
        $msg = $e->getMessage();

        if (stripos($msg, 'cURL') !== false && stripos($msg, 'Could not resolve host') !== false) {
            return 'Host não pôde ser resolvido — verifique se a URL está correta e acessível desde o servidor.';
        }
        if (stripos($msg, 'timed out') !== false || stripos($msg, 'timeout') !== false) {
            return 'Tempo limite excedido — o servidor remoto não respondeu em 15 s.';
        }
        if (stripos($msg, 'Connection refused') !== false) {
            return 'Conexão recusada pelo host de destino.';
        }
        if (stripos($msg, 'SSL') !== false || stripos($msg, 'certificate') !== false) {
            return 'Falha de certificado SSL ao acessar ' . $url . '.';
        }

        return 'Falha ao conectar: ' . $msg;
    }
}
