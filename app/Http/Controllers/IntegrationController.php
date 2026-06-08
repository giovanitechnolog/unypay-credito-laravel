<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class IntegrationController extends Controller
{
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
}
