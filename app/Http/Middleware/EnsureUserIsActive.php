<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    public const INACTIVE_MESSAGE = 'Seu acesso está inativo. Entre em contato com o administrador do sistema.';

    /**
     * Encerra a sessão de operadores inativos (ex.: desativados após o login).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->isActive()) {
            Auth::guard('web')->logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()
                ->route('login')
                ->withErrors(['email' => self::INACTIVE_MESSAGE]);
        }

        return $next($request);
    }
}
