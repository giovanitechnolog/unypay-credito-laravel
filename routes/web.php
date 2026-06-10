<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\ContractImportController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\IpcaController;
use App\Http\Controllers\LancamentosController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\SerasaController;
use App\Http\Controllers\SimulatorController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\ContractTypeController;
use App\Http\Controllers\GuarantorController;
use App\Http\Controllers\ConsignorController;
use App\Http\Controllers\IntegrationController;
use App\Http\Controllers\AiIngestionController;
use App\Http\Controllers\ContractPanelController;
use App\Models\UserColumnPreference; // 🚀 MODELO IMPORTADO PARA O UPSERT
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rotas públicas (apenas para usuários não autenticados)
|--------------------------------------------------------------------------
*/
Route::middleware('guest')->group(function () {
    Route::get ('/login',                  [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login',                  [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login');

    Route::get ('/forgot-password',        [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/forgot-password',        [PasswordResetLinkController::class, 'store'])->middleware('throttle:6,1')->name('password.email');

    Route::get ('/reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/reset-password',         [NewPasswordController::class, 'store'])->name('password.store');
});

/*
|--------------------------------------------------------------------------
| Rotas protegidas (exigem autenticação por sessão)
|--------------------------------------------------------------------------
*/
Route::middleware('auth')->group(function () {

    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    // Dashboard
    Route::get('/',          [DashboardController::class, 'index']);
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    // Lançamentos
    Route::get('/lancamentos', [LancamentosController::class, 'index']);
    Route::get('/lancamentos/export', [LancamentosController::class, 'export']);

    // Clientes
    Route::get   ('/clients',        [ClientController::class, 'index'])->name('clients.index');
    Route::get   ('/clients/export',  [ClientController::class, 'export'])->name('clients.export');
    Route::post  ('/clients',      [ClientController::class, 'store'])->name('clients.store');
    // 🚀 JSON dedicado: fiadores vinculados ao cliente (alimenta "Fiadores Sugeridos"
    // do modal de Contratos). Declarado antes de /clients/{id} de propósito.
    Route::get   ('/api/clients/{id}/guarantors', [ClientController::class, 'guarantors'])->name('clients.guarantors');
    Route::get   ('/api/cnpj/{cnpj}',             [IntegrationController::class, 'lookupCnpj'])->name('integrations.cnpj');
    Route::get   ('/clients/{id}', [ClientController::class, 'show'])->name('clients.show');
    Route::put   ('/clients/{id}', [ClientController::class, 'update'])->name('clients.update');
    Route::delete('/clients/{id}', [ClientController::class, 'destroy'])->name('clients.destroy');

    /*
    |--------------------------------------------------------------------------
    | 📝 Gerenciamento Estatutário de Contratos (UnyPay®)
    |--------------------------------------------------------------------------
    */
    Route::get   ('/contracts',                [ContractController::class, 'index'])->name('contracts.index');
    Route::get   ('/contracts/export',         [ContractController::class, 'export'])->name('contracts.export');
    Route::post  ('/contracts/store',          [ContractController::class, 'store'])->name('contracts.store'); // 👈 Mapeado para o envio do formulário limpo
    Route::post  ('/contracts',                [ContractController::class, 'store']); 
    
    // 🚀 CORREÇÃO CRÍTICA: Aponta o fallback parametrizado de ID diretamente para o index unificado tratando os dados reativos
    Route::get   ('/contracts/{id}',           [ContractController::class, 'index'])->name('contracts.show');
    
    Route::post  ('/contracts/{id}/update',    [ContractController::class, 'update'])->name('contracts.update'); // 👈 Endpoint de edição do modal
    Route::post  ('/contracts/{id}',           [ContractController::class, 'update']);
    Route::put   ('/contracts/{id}',           [ContractController::class, 'update']);
    Route::get   ('/contracts/{id}/pdf',        [ContractController::class, 'viewPdf'])->name('contracts.pdf');
    Route::delete('/contracts/{id}',           [ContractController::class, 'destroy'])->name('contracts.destroy');

    // API auxiliar de lookup de clientes
    Route::get('/api/clients-lookup', [ContractController::class, 'clientsLookup']);

    // Pagamentos e Amortizações
    Route::get('/payments',         [PaymentController::class, 'index'])->name('payments.index');
    Route::get('/payments/export',  [PaymentController::class, 'export'])->name('payments.export');
    Route::get('/pagamentos',       [PaymentController::class, 'index'])->name('pagamentos.index');

    Route::get ('/api/payments/schedule/{contractId}', [PaymentController::class, 'getSchedule']);
    Route::post('/api/payments/record',                [PaymentController::class, 'recordPayment']);

    // IPCA
    Route::get ('/ipca',            [IpcaController::class, 'index'])->name('ipca.index');
    Route::post('/api/ipca/upsert', [IpcaController::class, 'upsert'])->name('ipca.upsert');
    Route::post('/api/ipca/sync',   [IpcaController::class, 'syncBCB'])->name('ipca.sync');

    // Simulador
    Route::get   ('/simulador',                 [SimulatorController::class, 'index'])->name('simulator.index');
    Route::get   ('/simulacoes',                [SimulatorController::class, 'history'])->name('simulator.history');
    Route::post  ('/api/simulator/save',        [SimulatorController::class, 'save'])->name('simulator.save');
    Route::delete('/api/simulator/{id}',        [SimulatorController::class, 'delete'])->name('simulator.delete');
    Route::post  ('/api/simulator/{id}/convert',[SimulatorController::class, 'convertToContract'])->name('simulator.convert');

    // Serasa
    Route::get ('/serasa',                                   [SerasaController::class, 'index'])->name('serasa.index');
    Route::post('/api/serasa/apontamento',                   [SerasaController::class, 'store'])->name('serasa.store');
    Route::put ('/api/serasa/apontamento/{id}/regularizar',  [SerasaController::class, 'regularizar'])->name('serasa.regularizar');
    Route::post('/api/serasa/consultar/{clientId}',          [SerasaController::class, 'consultar'])->name('serasa.consultar');

    /*
    |--------------------------------------------------------------------------
    | Importador de planilha de contratos (rota oculta - sem link no menu)
    |--------------------------------------------------------------------------
    */
    Route::prefix('sys/importar')->group(function () {
        Route::get ('importar-contratos',         [ContractImportController::class, 'page'])->name('contracts.importer');
        Route::post('contratos/validar',          [ContractImportController::class, 'validateSpreadsheet'])->name('contracts.importer.validate');
        Route::post('contratos',                  [ContractImportController::class, 'store'])->name('contracts.importer.store');
        Route::get ('contratos/status/{import}',  [ContractImportController::class, 'status'])->name('contracts.importer.status');
    });

    /*
    |--------------------------------------------------------------------------
    | CRUD de Usuários administrativos
    |--------------------------------------------------------------------------
    */
    Route::get('/usuarios', [UserController::class, 'index'])->name('users.index');

    Route::get   ('/api/users',         [UserController::class, 'list'])->name('users.list');
    Route::post  ('/api/users',         [UserController::class, 'store'])->name('users.store');
    Route::put   ('/api/users/{user}',  [UserController::class, 'update'])->name('users.update');
    Route::delete('/api/users/{user}',  [UserController::class, 'destroy'])->name('users.destroy');

    /*
    |--------------------------------------------------------------------------
    | CRUD de Pessoas (cadastro mestre — Fiadores, Codevedores e Testemunhas)
    |
    | Mantemos /fiadores como alias retroativo (links externos, bookmarks etc.),
    | mas o caminho canônico passou a ser /pessoas após a unificação do CRUD.
    |--------------------------------------------------------------------------
    */
    Route::get('/pessoas',         [GuarantorController::class, 'page'])->name('guarantors.index');
    Route::get('/pessoas/export',  [GuarantorController::class, 'export'])->name('guarantors.export');
    Route::get('/fiadores',        [GuarantorController::class, 'page']);
    Route::get('/fiadores/export', [GuarantorController::class, 'export']);

    Route::get   ('/api/guarantors',                    [GuarantorController::class, 'index'])->name('guarantors.list');
    // 🚀 Autocomplete leve usado pelo modal de Contratos (declarado ANTES de /{guarantor}
    // para não cair no model binding como guarantor=search).
    Route::get   ('/api/guarantors/search',             [GuarantorController::class, 'search'])->name('guarantors.search');
    Route::post  ('/api/guarantors',                    [GuarantorController::class, 'store'])->name('guarantors.store');
    Route::get   ('/api/guarantors/{guarantor}',        [GuarantorController::class, 'show'])->name('guarantors.show');
    Route::put   ('/api/guarantors/{guarantor}',        [GuarantorController::class, 'update'])->name('guarantors.update');
    Route::delete('/api/guarantors/{guarantor}',        [GuarantorController::class, 'destroy'])->name('guarantors.destroy');

    // Lookup auxiliar para o multi-select de clientes no modal
    Route::get('/api/guarantors-clients-lookup', [GuarantorController::class, 'clientsLookup'])->name('guarantors.clients-lookup');

    /*
    |--------------------------------------------------------------------------
    | CRUD de Credores (Consignors) — Inertia page + JSON API resource
    |--------------------------------------------------------------------------
    */
    Route::get('/credores',        [ConsignorController::class, 'page'])->name('consignors.index');
    Route::get('/credores/export', [ConsignorController::class, 'export'])->name('consignors.export');

    Route::get   ('/api/consignors',              [ConsignorController::class, 'index'])->name('consignors.list');
    Route::post  ('/api/consignors',              [ConsignorController::class, 'store'])->name('consignors.store');
    Route::get   ('/api/consignors/{consignor}',  [ConsignorController::class, 'show'])->name('consignors.show');
    Route::put   ('/api/consignors/{consignor}',  [ConsignorController::class, 'update'])->name('consignors.update');
    Route::delete('/api/consignors/{consignor}',  [ConsignorController::class, 'destroy'])->name('consignors.destroy');

    // Tipificações Estruturais
    Route::get('/contract-types', [ContractTypeController::class, 'index'])->name('contract-types.index');
    Route::get('/api/contract-types', [ContractTypeController::class, 'list']);
    Route::post('/api/contract-types', [ContractTypeController::class, 'store']);
    Route::put('/api/contract-types/{id}', [ContractTypeController::class, 'update']);
    Route::delete('/api/contract-types/{id}', [ContractTypeController::class, 'destroy']);

    /*
    |--------------------------------------------------------------------------
    | Painel de Contratos agrupado + Ingestão de Contratos com IA
    |--------------------------------------------------------------------------
    */
    Route::get('/contract-panel', [ContractPanelController::class, 'index'])->name('contract-panel.index');

    Route::get('/ai-ingestion', [AiIngestionController::class, 'index'])->name('ai-ingestion.page');
    Route::post('/api/ai-ingestion/process', [AiIngestionController::class, 'processPdf'])->name('ai-ingestion.process');
    Route::post('/api/ai-ingestion/save', [AiIngestionController::class, 'save'])->name('ai-ingestion.save');


    /*
    |--------------------------------------------------------------------------
    | 🚀 Preferências Globais do Operador Logado (Banco de Dados + React Hook)
    |--------------------------------------------------------------------------
    */
    Route::post('/api/user-preferences/columns', function (Request $request) {
        $request->validate([
            'table_key' => 'required|string',
            'visible_columns' => 'required|array',
        ]);

        UserColumnPreference::updateOrCreate(
            [
                'user_id'   => Auth::id(),
                'table_key' => $request->input('table_key'),
            ],
            [
                'visible_columns' => $request->input('visible_columns'),
            ]
        );

        return response()->json(['success' => true]);
    });
});