<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ContractTypeController extends Controller
{
    /**
     * Renderiza a página principal do CRUD.
     */
    public function index(): Response
    {
        return Inertia::render('ContractTypes');
    }

    /**
     * Lista todos os tipos de contrato (JSON para a tabela).
     */
    /**
     * Lista todos os tipos de contrato (JSON para a tabela).
     */
    public function list(Request $request): JsonResponse
    {
        $search = trim((string) $request->input('search', ''));

        // 🚀 Ajustado para buscar 'created_at' e 'updated_at' conforme o HeidiSQL
        $query = DB::table('contract_types')
            ->select([
                'id', 
                'name', 
                'slug', 
                'created_at as createdAt', // Alidado para manter compatibilidade com o TSX
                'updated_at as updatedAt'
            ]);

        if ($search !== '') {
            $query->where('name', 'like', "%{$search}%");
        }

        $types = $query->orderBy('name', 'asc')->get();

        return response()->json([
            'data' => $types
        ]);
    }

    /**
     * Grava um novo tipo de contrato.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'        => 'required|string|max:255|unique:contract_types,name',
            'description' => 'nullable|string',
        ]);

        $id = DB::table('contract_types')->insertGetId([
            'name'        => $request->input('name'),
            'description' => $request->input('description'),
        ]);

        $newType = DB::table('contract_types')->where('id', $id)->first();

        return response()->json([
            'message' => 'Tipo de contrato registrado com sucesso.',
            'data'    => $newType
        ], 201);
    }

    /**
     * Atualiza um tipo de contrato existente.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'name'        => 'required|string|max:255|unique:contract_types,name,' . $id,
            'description' => 'nullable|string',
        ]);

        DB::table('contract_types')
            ->where('id', $id)
            ->update([
                'name'        => $request->input('name'),
                'description' => $request->input('description'),
            ]);

        $updatedType = DB::table('contract_types')->where('id', $id)->first();

        return response()->json([
            'message' => 'Tipo de contrato atualizado com sucesso.',
            'data'    => $updatedType
        ]);
    }

    /**
     * Remove um tipo de contrato.
     */
    public function destroy(int $id): JsonResponse
    {
        // Impede deletar se houver algum contrato usando esse tipo
        $inUse = DB::table('contracts')->where('contract_type_id', $id)->exists();
        
        if ($inUse) {
            return response()->json([
                'message' => 'Não é possível excluir. Existem contratos vinculados a este tipo.'
            ], 422);
        }

        DB::table('contract_types')->where('id', $id)->delete();

        return response()->json([
            'message' => 'Tipo de contrato removido com sucesso.'
        ]);
    }
}