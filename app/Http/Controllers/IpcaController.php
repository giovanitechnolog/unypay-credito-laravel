<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class IpcaController extends Controller
{
    /**
     * Carrega a view com todos os índices armazenados no banco de dados.
     */
    public function index()
    {
        // Puxa os dados ordenando pela coluna oficial monthRef do seu Schema
        $indices = DB::table('ipca_indices')
            ->orderBy('monthRef', 'desc')
            ->get();

        return Inertia::render('IpcaTable', [
            'indices' => $indices
        ]);
    }

    /**
     * Salva ou atualiza um registro (Edição em linha ou inserção manual).
     */
    public function upsert(Request $request)
    {
        $request->validate([
            'referenceMonth' => 'required|string|max:7',
            'rate' => 'required|numeric',
            'source' => 'required|string'
        ]);

        $id = $request->input('id');
        $monthValue = $request->input('referenceMonth'); // Ex: 2024-10
        
        // Converte a taxa digitada em formato percentual (Ex: 0.56) para decimal financeiro (0.00560000)
        $rateValue = floatval($request->input('rate')) / 100;

        // Monta o payload respeitando fielmente as colunas do seu Schema de Banco de Dados
        $payload = [
            'monthRef'    => $monthValue,
            'monthlyRate' => $rateValue,
            'sourceName'  => $request->input('source'),
            'sourceUrl'   => 'Interface do Sistema',
            'updatedAt'   => now()
        ];

        if ($id) {
            DB::table('ipca_indices')->where('id', $id)->update($payload);
        } else {
            // Se for inserção, busca pela chave única monthRef para evitar duplicados
            DB::table('ipca_indices')->updateOrInsert(
                ['monthRef' => $monthValue],
                $payload
            );
        }

        return redirect()->back()->with('flash', ['success' => 'Índice IPCA gravado com sucesso no banco de dados!']);
    }

    /**
     * Consome os dados oficiais do Banco Central com tratamento de limites e mapeamento de Schema
     */
    public function syncBCB()
    {
        try {
            // Consome os últimos 20 meses para respeitar o limite imposto pela API do BCB
            $response = Http::timeout(12)
                ->withoutVerifying() 
                ->get('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/20?formato=json');

            if ($response->failed()) {
                return redirect()->back()->withErrors(['sync' => 'O barramento do Banco Central (SGS) não respondeu. Tente de novo em instantes.']);
            }

            $data = $response->json();

            if (!is_array($data) || empty($data) || isset($data['erro'])) {
                return redirect()->back()->withErrors(['sync' => 'A API do governo retornou um formato inesperado ou erro de negócio.']);
            }

            $updatedRecords = 0;

            foreach ($data as $item) {
                // O BCB envia data como "01/10/2024" e valor como "0.56"
                $dateParts = explode('/', $item['data']);
                if (count($dateParts) !== 3) continue;

                // Transforma em competência mensal (YYYY-MM) -> Ex: "2024-10"
                $yearMonth = $dateParts[2] . '-' . $dateParts[1]; 
                
                // Transforma a string do valor (Ex: 0.56) em float e divide por 100 para armazenar na coluna (10,8) como 0.00560000
                $rate = floatval($item['valor']) / 100;

                // Executa o Upsert mapeando 100% das chaves do seu Schema mestre
                DB::table('ipca_indices')->updateOrInsert(
                    ['monthRef' => $yearMonth],
                    [
                        'monthEnd'    => $dateParts[2] . '-' . $dateParts[1] . '-' . $dateParts[0], // Guarda a data completa de fechamento
                        'monthlyRate' => $rate,
                        'sourceName'  => 'BCB - SGS Série 433',
                        'sourceUrl'   => 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433',
                        'updatedAt'   => now()
                    ]
                );
                $updatedRecords++;
            }

            // Sucesso! Retorna aplicando a notificação flash aceita pelo Inertia
            return redirect()->back()->with('flash', [
                'success' => 'Sincronização realizada com sucesso! ' . $updatedRecords . ' meses de IPCA injetados diretamente na tabela ipca_indices.'
            ]);

        } catch (\Exception $e) {
            return redirect()->back()->withErrors([
                'sync' => 'Falha interna ao gravar os registros na tabela física: ' . $e->getMessage()
            ]);
        }
    }
}