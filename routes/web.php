<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\LancamentosController;
use App\Http\Controllers\IpcaController;
use App\Http\Controllers\SimulatorController;
use App\Http\Controllers\SerasaController;
use App\Http\Controllers\ContractImportController;


// Rota principal apontando para o Controller que calcula as finanças
Route::get('/', [DashboardController::class, 'index']);
Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

// Rota para abrir e filtrar a tabela estilo Excel de Lançamentos
Route::get('/lancamentos', [LancamentosController::class, 'index']);

// Rota responsável pela ação de exclusão da linha da tabela
Route::delete('/contracts/{id}', [ContractController::class, 'destroy']);

// Rotas CRUD do Gerenciador de Clientes
// 1. Listagem geral e criação
Route::get('/clients', [ClientController::class, 'index'])->name('clients.index');
Route::post('/clients', [ClientController::class, 'store'])->name('clients.store');

// 2. A FICHA DETALHADA (GET) - DEVE FICAR ANTES OU JUNTO DOS OUTROS MÉTODOS
Route::get('/clients/{id}', [ClientController::class, 'show'])->name('clients.show');

// 3. Atualização e Exclusão (Os métodos que já davam suporte ao ID)
Route::put('/clients/{id}', [ClientController::class, 'update'])->name('clients.update');
Route::delete('/clients/{id}', [ClientController::class, 'destroy'])->name('clients.destroy');

// Rotas do CRUD de Contratos
Route::get('/contracts', [ContractController::class, 'index'])->name('contracts.index');
Route::post('/contracts', [ContractController::class, 'store'])->name('contracts.store');
Route::get('/contracts/{id}', [ContractController::class, 'show'])->name('contracts.show');
Route::delete('/contracts/{id}', [ContractController::class, 'destroy'])->name('contracts.destroy');

// API auxiliar para carregar os clientes no Select do formulário de contrato
Route::get('/api/clients-lookup', [ContractController::class, 'clientsLookup']);

Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
Route::get('/pagamentos', [PaymentController::class, 'index'])->name('pagamentos.index');

// Endpoints das APIs que alimentam a planilha interna
Route::get('/api/payments/schedule/{contractId}', [PaymentController::class, 'getSchedule']);
Route::post('/api/payments/record', [PaymentController::class, 'recordPayment']);

Route::get('/ipca', [IpcaController::class, 'index'])->name('ipca.index');
    
// API: Upsert incremental de taxas (Edição inline ou inserção manual)
Route::post('/api/ipca/upsert', [IpcaController::class, 'upsert'])->name('ipca.upsert');

// API: Dispara o consumo em tempo real do Banco Central do Brasil
Route::post('/api/ipca/sync', [IpcaController::class, 'syncBCB'])->name('ipca.sync');

    Route::get('/simulador', [SimulatorController::class, 'index'])->name('simulator.index');
    
    Route::get('/simulacoes', [SimulatorController::class, 'history'])->name('simulator.history'); 
    
    // APIs de execução em background
    Route::post('/api/simulator/save', [SimulatorController::class, 'save'])->name('simulator.save');
    Route::delete('/api/simulator/{id}', [SimulatorController::class, 'delete'])->name('simulator.delete');
    Route::post('/api/simulator/{id}/convert', [SimulatorController::class, 'convertToContract'])->name('simulator.convert');

    Route::get('/serasa', [SerasaController::class, 'index'])->name('serasa.index');
    
    // Processamentos de background da API
    Route::post('/api/serasa/apontamento', [SerasaController::class, 'store'])->name('serasa.store');
    Route::put('/api/serasa/apontamento/{id}/regularizar', [SerasaController::class, 'regularizar'])->name('serasa.regularizar');
    Route::post('/api/serasa/consultar/{clientId}', [SerasaController::class, 'consultar'])->name('serasa.consultar');

// ============================================================================
// FERRAMENTA INTERNA: Importador de planilha de contratos (rota oculta)
// ----------------------------------------------------------------------------
// Não há link no menu — o acesso é por URL direta. Quando o módulo de login
// for habilitado, basta encapsular o grupo abaixo em ->middleware('auth')
// (ou em uma policy específica de administrador).
// ============================================================================
Route::prefix('sys/importar')->group(function () {
    Route::get('importar-contratos', [ContractImportController::class, 'page'])
        ->name('contracts.importer');

    Route::post('contratos/validar', [ContractImportController::class, 'validateSpreadsheet'])
        ->name('contracts.importer.validate');

    Route::post('contratos', [ContractImportController::class, 'store'])
        ->name('contracts.importer.store');

    Route::get('contratos/status/{import}', [ContractImportController::class, 'status'])
        ->name('contracts.importer.status');
});