<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ContractController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\IpcaController;
use App\Http\Controllers\LancamentosController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\SerasaController;
use App\Http\Controllers\SimulatorController;
use App\Http\Controllers\UserController;
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
    Route::get   ('/contracts',      [ContractController::class, 'index'])->name('contracts.index');
    Route::post  ('/contracts',      [ContractController::class, 'store'])->name('contracts.store');
    Route::get   ('/contracts/{id}', [ContractController::class, 'show'])->name('contracts.show');
    Route::delete('/contracts/{id}', [ContractController::class, 'destroy'])->name('contracts.destroy');

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
    | CRUD de Usuários administrativos (rotas "ocultas" - sem link no menu)
    |--------------------------------------------------------------------------
    */
    Route::get('/usuarios', [UserController::class, 'index'])->name('users.index');

    Route::get   ('/api/users',         [UserController::class, 'list'])->name('users.list');
    Route::post  ('/api/users',         [UserController::class, 'store'])->name('users.store');
    Route::put   ('/api/users/{user}',  [UserController::class, 'update'])->name('users.update');
    Route::delete('/api/users/{user}',  [UserController::class, 'destroy'])->name('users.destroy');
});
