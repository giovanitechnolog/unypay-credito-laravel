<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\ContractImportController;
use App\Http\Controllers\ContractTypeController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\IpcaController;
use App\Http\Controllers\LancamentosController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\SerasaController;
use App\Http\Controllers\SimulatorController;
use App\Http\Controllers\UserController;
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

    // Clientes
    Route::get   ('/clients',      [ClientController::class, 'index'])->name('clients.index');
    Route::post  ('/clients',      [ClientController::class, 'store'])->name('clients.store');
    Route::get   ('/clients/{id}', [ClientController::class, 'show'])->name('clients.show');
    Route::put   ('/clients/{id}', [ClientController::class, 'update'])->name('clients.update');
    Route::delete('/clients/{id}', [ClientController::class, 'destroy'])->name('clients.destroy');

    // Contratos
    Route::get   ('/contracts',                  [ContractController::class, 'index'])->name('contracts.index');
    Route::post  ('/contracts',                  [ContractController::class, 'store'])->name('contracts.store');
    Route::get   ('/contracts/{id}',             [ContractController::class, 'show'])->name('contracts.show');
    Route::post  ('/contracts/{id}',             [ContractController::class, 'update'])->name('contracts.update');
    Route::put   ('/contracts/{id}',             [ContractController::class, 'update']);
    Route::post  ('/contracts/{id}/cancel',      [ContractController::class, 'cancel'])->name('contracts.cancel');
    Route::post  ('/contracts/{id}/reactivate',  [ContractController::class, 'reactivate'])->name('contracts.reactivate');
    Route::get   ('/contracts/{id}/pdf',         [ContractController::class, 'viewPdf'])->name('contracts.pdf');
    Route::delete('/contracts/{id}',             [ContractController::class, 'destroy'])->name('contracts.destroy');

    // API auxiliar de lookup de clientes
    Route::get('/api/clients-lookup', [ContractController::class, 'clientsLookup']);

    // Pagamentos
    Route::get('/payments',   [PaymentController::class, 'index'])->name('payments.index');
    Route::get('/pagamentos', [PaymentController::class, 'index'])->name('pagamentos.index');

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
    |
    */
    Route::prefix('sys/importar')->group(function () {
        Route::get ('importar-contratos',         [ContractImportController::class, 'page'])->name('contracts.importer');
        Route::post('contratos/validar',          [ContractImportController::class, 'validateSpreadsheet'])->name('contracts.importer.validate');
        Route::post('contratos',                  [ContractImportController::class, 'store'])->name('contracts.importer.store');
        Route::get ('contratos/status/{import}',  [ContractImportController::class, 'status'])->name('contracts.importer.status');
    });

    /*
    |--------------------------------------------------------------------------
    | CRUD de Usuários administrativos (rotas "ocultas" - sem link no menu)
    |--------------------------------------------------------------------------
    |
    */
    Route::get('/usuarios', [UserController::class, 'index'])->name('users.index');

    Route::get   ('/api/users',         [UserController::class, 'list'])->name('users.list');
    Route::post  ('/api/users',         [UserController::class, 'store'])->name('users.store');
    Route::put   ('/api/users/{user}',  [UserController::class, 'update'])->name('users.update');
    Route::delete('/api/users/{user}',  [UserController::class, 'destroy'])->name('users.destroy');

    /*
    |--------------------------------------------------------------------------
    | CRUD de Tipos de Contrato (Gestão Interna)
    |--------------------------------------------------------------------------
    |
    | Lista, cadastra, edita e desativa/exclui tipos de contrato. A página
    | Inertia em /tipos-contrato consome a API /api/contract-types para
    | manter a UX igual à de Usuários (refresh sem reload completo).
    |
    */
    Route::get('/tipos-contrato', [ContractTypeController::class, 'index'])->name('contract-types.index');

    Route::get   ('/api/contract-types',                         [ContractTypeController::class, 'list'])->name('contract-types.list');
    Route::post  ('/api/contract-types',                         [ContractTypeController::class, 'store'])->name('contract-types.store');
    Route::put   ('/api/contract-types/{contractType}',          [ContractTypeController::class, 'update'])->name('contract-types.update');
    Route::patch ('/api/contract-types/{contractType}/toggle',   [ContractTypeController::class, 'toggleActive'])->name('contract-types.toggle');
    Route::delete('/api/contract-types/{contractType}',          [ContractTypeController::class, 'destroy'])->name('contract-types.destroy');

    /*
    |--------------------------------------------------------------------------
    | 🚀 Preferências Globais do Operador Logado (Banco de Dados + React Hook)
    |--------------------------------------------------------------------------
    |
    */
    Route::post('/api/user-preferences/columns', function (Request $request) {
        $request->validate([
            'table_key' => 'required|string',
            'visible_columns' => 'required|array',
        ]);

        // Executa o "Upsert" automático vinculando ao operador da sessão
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