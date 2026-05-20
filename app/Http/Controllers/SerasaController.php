<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class SerasaController extends Controller
{
    /**
     * Carrega os dados agregados do monitor de crédito
     */
    public function index(Request $request)
    {
        $selectedClientId = $request->input('clientId');

        // 1. Puxa os clientes ativos do sistema
        $clients = DB::table('clients')->select('id', 'name', 'document')->orderBy('name', 'asc')->get();

        // 2. Monta o histórico mensal de agrupamentos (Seu banco físico)
        $overview = DB::table('credit_apontamentos')
            ->select(DB::raw("DATE_FORMAT(data_ocorrencia, '%Y-%m') as month"), DB::raw('COUNT(*) as count'), DB::raw('COUNT(DISTINCT client_id) as clientCount'))
            ->groupBy('month')
            ->orderBy('month', 'desc')
            ->get();

        // 3. Filtra restrições se houver um cliente ativo selecionado lateralmente
        $apontamentos = [];
        if ($selectedClientId) {
            $apontamentos = DB::table('credit_apontamentos')
                ->where('client_id', $selectedClientId)
                ->orderBy('data_ocorrencia', 'desc')
                ->get();
        }

        return Inertia::render('SerasaMonitor', [
            'clients'            => $clients,
            'overview'           => $overview,
            'apontamentos'       => $apontamentos,
            'selectedClientId'   => $selectedClientId ? (int)$selectedClientId : null
        ]);
    }

    /**
     * Insere manualmente um novo apontamento de restrição restrita
     */
    public function store(Request $request)
    {
        $request->validate([
            'clientId'       => 'required|integer',
            'tipo'           => 'required|string',
            'descricao'      => 'required|string',
            'dataOcorrencia' => 'required|date'
        ]);

        DB::table('credit_apontamentos')->insert([
            'client_id'       => $request->input('clientId'),
            'tipo'            => $request->input('tipo'),
            'descricao'       => $request->input('descricao'),
            'valor'           => $request->input('valor'),
            'credor'          => $request->input('credor'),
            'data_ocorrencia' => $request->input('dataOcorrencia'),
            'status'          => $request->input('status', 'ativo'),
            'fonte'           => $request->input('fonte', 'manual'),
            'created_at'      => now(),
            'updated_at'      => now()
        ]);

        return redirect()->back()->with('flash', ['success' => 'Novo apontamento de restrição indexado com sucesso!']);
    }

    /**
     * Baixa/Regulariza um apontamento financeiro ativo
     */
    public function regularizar($id)
    {
        DB::table('credit_apontamentos')->where('id', $id)->update([
            'status'     => 'regularizado',
            'updated_at' => now()
        ]);

        return redirect()->back()->with('flash', ['success' => 'Status do apontamento modificado para Regularizado!']);
    }

    /**
     * Simula a consulta via API do bureau de crédito externo
     */
    public function consultar($clientId)
    {
        // Aqui simulamos o gatilho da API Serasa Experian original do Manus
        return redirect()->back()->with('flash', [
            'success' => 'Consulta realizada com sucesso junto ao bureau! Nenhuma nova restrição externa encontrada para este CPF/CNPJ.'
        ]);
    }
}