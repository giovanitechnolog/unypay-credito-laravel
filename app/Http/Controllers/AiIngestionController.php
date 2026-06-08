<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Smalot\PdfParser\Parser;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Contract;

class AiIngestionController extends Controller
{
    /**
     * Renderiza a nova view no menu
     */
    public function index(): Response
    {
        return Inertia::render('AiIngestion', [
            'contractTypes' => DB::table('contract_types')->get(),
            'existingClients' => DB::table('clients')
                ->select('id', 'name', 'document')
                ->get()
        ]);
    }

    /**
     * Processa o PDF e extrai via ChatGPT com JSON Schema rígido espelhando as abas do React
     */
    public function processPdf(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|mimes:pdf|max:20480',
        ]);

        try {
            // 1. Extrai o texto cru do PDF
            $parser = new Parser();
            $pdf = $parser->parseFile($request->file('file')->getRealPath());
            $text = $pdf->getText();

            // Trunca para evitar estouro de tokens
            $truncatedText = mb_substr($text, 0, 15000);

            $apiKey = env('OPENAI_API_KEY');
            if (!$apiKey) {
                return response()->json(['error' => 'API Key da OpenAI não configurada no .env'], 500);
            }

            // 2. Disparando a chamada forçando a estrutura exata de ABAS solicitada
            $response = Http::withToken($apiKey)
                ->timeout(60)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-4o-mini',
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'Você é um robô de inteligência documental especializado em auditoria de crédito. Sua única função é ler o texto do contrato fornecido e extrair as cláusulas e informações estruturando-as OBRIGATORIAMENTE nas chaves especificadas abaixo. Não invente dados. Se um campo não for localizado, deixe-o como string vazia ou zero para números.

                            Você deve retornar um objeto JSON contendo exatamente as seguintes seções estruturadas:

                            1. "dados_basicos":
                               - "cliente_devedor" (Nome completo do devedor principal)
                               - "documento" (CPF ou CNPJ formatado)
                               - "cep" (Apenas números ou formatado)
                               - "endereco" (Endereço residencial/comercial completo)
                               - "codigo_interno" (Gere um código único ex: CONSIGNADO-NOME-ANO)
                               - "data_emissao" (Formato YYYY-MM-DD)
                               - "credor_divida" (Nome do credor ex: UnyPay S.A. ou HI Transportes)
                               - "tipo" (Identifique se é Mútuo, Consignado ou Confissão de Dívida)
                               - "status" (Sempre retorne "Ativo")

                            2. "valores":
                               - "valor_principal" (Número puro/float do valor emprestado)
                               - "valor_financiado" (Número puro/float do total financiado com encargos)
                               - "numero_parcelas" (Número inteiro)
                               - "valor_parcela" (Número puro/float da prestação)

                            3. "banco":
                               - "nome" (Nome do banco ex: BANCO ITAÚ S.A.)
                               - "agencia" (Número da agência)
                               - "conta" (Número da conta com dígito)
                               - "pix" (Chave pix se declarada no contrato, caso contrário use o CPF/CNPJ do devedor)

                            4. "taxas":
                               - "correcao_monetaria" (IPCA, IGP-M ou PRE)
                               - "data_primeiro_vencimento" (Formato YYYY-MM-DD)
                               - "tac" (Tarifa de estruturação/cadastro, se houver, número float. Se não achou use 0.00)
                               - "juros_mes" (Taxa de juros mensal pura em float ex: 0.0338 para 3.38%)
                               - "mora_mes" (Taxa de mora mensal em float ex: 0.01 ou 0.02)
                               - "multa_atraso" (Percentual de multa em float ex: 0.10 para 10% ou 0.02 para 2%)

                            5. "fiadores":
                               Um array de objetos. Cada objeto deve conter:
                               - "nome" (Nome completo do fiador)
                               - "documento" (CPF do fiador formatado)

                            6. "garantias":
                               - "tipo_garantia" ("imovel", "veiculo" ou "nenhuma")
                               - "descricao_detalhada" (Texto descrevendo o imóvel, lote, matrícula ou o carro com marca, modelo, ano e placa)'
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

            $aiResult = json_decode($response->json('choices.0.message.content'), true);

            return response()->json($aiResult);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Falha no processamento: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Salva o contrato com proteção anti-nulo e tratamento dinâmico de tabelas pivot
     */
    public function save(Request $request): JsonResponse
    {
        $basicos   = $request->input('dados_basicos', []);
        $valores   = $request->input('valores', []);
        $banco     = $request->input('banco', []);
        $taxas     = $request->input('taxas', []);
        $fiadores  = $request->input('fiadores', []);
        $garantias = $request->input('garantias', []);

        if (empty($basicos['cliente_devedor']) || empty($basicos['documento'])) {
            return response()->json(['error' => 'Dados do devedor principal ausentes no payload.'], 422);
        }

        $docClean = preg_replace('/\D/', '', $basicos['documento']);

        try {
            DB::beginTransaction();

            // 1️⃣ RESOLVE CLIENTE (Evita duplicidade buscando pelo CPF/CNPJ limpo)
            $clientId = DB::table('clients')->where('document', $docClean)->value('id');

            if (!$clientId) {
                $bankAccounts = [];
                if (!empty($banco['nome'])) {
                    $bankAccounts[] = [
                        'banco'   => $banco['nome'],
                        'agencia' => $banco['agencia'] ?? '',
                        'conta'   => $banco['conta'] ?? '',
                        'tipo'    => 'Corrente',
                        'hasPix'  => !empty($banco['pix']),
                        'pixKey'  => $banco['pix'] ?? ''
                    ];
                }

                $clientId = DB::table('clients')->insertGetId([
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
                ]);
            }

            // 2️⃣ RESOLVE INTEGRIDADE DO TIPO DE CONTRATO
            // Captura o primeiro ID de contract_types disponível se a busca textual falhar
            $typeId = DB::table('contract_types')
                ->where('name', 'like', "%{$basicos['tipo']}%")
                ->value('id');

            if (!$typeId) {
                $typeId = DB::table('contract_types')->orderBy('id', 'asc')->value('id');
                if (!$typeId) {
                    // Força a criação de um tipo genérico se a tabela estiver zerada (evita Foreign Key Constraint)
                    $typeId = DB::table('contract_types')->insertGetId([
                        'name' => 'Crédito Consignado Corporativo',
                        'createdAt' => now(),
                        'updatedAt' => now()
                    ]);
                }
            }

            $chosenAccount = trim(($banco['nome'] ?? '') . '-' . ($banco['agencia'] ?? '') . '-' . ($banco['conta'] ?? ''), '-');

            // 3️⃣ INSERÇÃO DO CONTRATO DE CRÉDITO
            $contractId = DB::table('contracts')->insertGetId([
                'clientId'            => $clientId,
                'code'                => $basicos['codigo_interno'] ?? uniqid('CT-'),
                'contractName'        => 'CONTRATO INTEGRADOR IA - ' . $basicos['cliente_devedor'],
                'creditor'            => $basicos['credor_divida'] ?? 'UnyPay® S.A.',
                'contract_type_id'    => $typeId,
                'contractType'        => $basicos['tipo'] ?? 'Crédito Consignado',
                'contractDate'        => $basicos['data_emissao'] ?? now()->toDateString(),
                'status'              => 'Ativo',
                'validated'           => true,
                'principalAmount'     => (float)($valores['valor_principal'] ?? 0),
                'financedTotal'       => (float)($valores['valor_financiado'] ?? ($valores['valor_principal'] ?? 0)),
                'installmentCount'    => (int)($valores['numero_parcelas'] ?? 12),
                'installmentAmount'   => (float)($valores['valor_parcela'] ?? 0),
                'firstDueDate'        => !empty($taxas['data_primeiro_vencimento']) ? $taxas['data_primeiro_vencimento'] : null,
                'tacAmount'           => (float)($taxas['tac'] ?? 0),
                'monthlyInterestRate' => (float)($taxas['juros_mes'] ?? 0),
                'moraRateMonthly'     => (float)($taxas['mora_mes'] ?? 0.02),
                'penaltyRate'         => (float)($taxas['multa_atraso'] ?? 0.10),
                'penaltyBaseType'     => 'installment',
                'penaltyScope'        => 'per_installment',
                'correctionIndex'     => $taxas['correcao_monetaria'] ?? 'PRE',
                'chosenBankAccount'   => $chosenAccount ?: 'Não informada',
                'paymentMethod'       => 'Boleto Bancário',
                'forumLocation'       => $taxas['foro'] ?? 'Belo Horizonte / MG',
                'guarantees'          => !empty($garantias['descricao_detalhada']) ? ($garantias['tipo_garantia'] . ': ' . $garantias['descricao_detalhada']) : '',
                'user_id'             => Auth::id() ?? DB::table('users')->orderBy('id', 'asc')->value('id') ?? 1, // Fallback se deslogado localmente
                'createdAt'           => now(),
                'updatedAt'           => now(),
            ]);

            // 4️⃣ RESOLVE FIADORES NXN (Aba Fiadores)
            if (!empty($fiadores) && is_array($fiadores)) {
                foreach ($fiadores as $f) {
                    if (empty($f['nome'])) continue;
                    
                    $fDocClean = preg_replace('/\D/', '', $f['documento'] ?? '');

                    $guarantorId = DB::table('guarantors')->where('cpf', $fDocClean)->value('id');

                    if (!$guarantorId) {
                        $guarantorId = DB::table('guarantors')->insertGetId([
                            'name'        => $f['nome'],
                            'personType'  => 'PF',
                            'cpf'         => $fDocClean ?: null,
                            'nationality' => 'Brasileiro',
                            'city'        => $f['cidade'] ?? 'Não Informada',
                            'createdAt'   => now(),
                            'updatedAt'   => now(),
                        ]);
                    }

                    // Previne duplicações na tabela pivot de clientes
                    $clientPivotExists = DB::table('client_guarantor')
                        ->where('clientId', $clientId)
                        ->where('guarantorId', $guarantorId)
                        ->exists();
                    
                    if (!$clientPivotExists) {
                        DB::table('client_guarantor')->insert([
                            'clientId'    => $clientId,
                            'guarantorId' => $guarantorId
                        ]);
                    }

                    // Vincula na pivot do contrato gerado pela IA
                    DB::table('contract_guarantor')->insert([
                        'contractId'  => $contractId,
                        'guarantorId' => $guarantorId,
                        'createdAt'   => now(),
                        'updatedAt'   => now(),
                    ]);
                }
            }

            DB::commit();
            return response()->json(['success' => true, 'message' => 'Contrato e amarrações salvos com sucesso!']);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Falha crítica no banco: ' . $e->getMessage()], 500);
        }
    }
}