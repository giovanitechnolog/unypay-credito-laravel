<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use App\Models\UserColumnPreference; // 🚀 IMPORTAÇÃO DO MODEL

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Props compartilhadas com TODAS as páginas Inertia.
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $user
                    ? [
                        'id'       => $user->id,
                        'name'     => $user->name,
                        'email'    => $user->email,
                        'role'     => $user->role,
                        'photoUrl' => $user->photoUrl,
                    ]
                    : null,
                
                // 🚀 INJEÇÃO DE PREFERÊNCIAS: Se o usuário estiver logado, busca as colunas e injeta globalmente
                'columnPreferences' => $user
                    ? UserColumnPreference::where('user_id', $user->id)
                        ->pluck('visible_columns', 'table_key')
                        ->toArray()
                    : [],
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error'   => fn () => $request->session()->get('error'),
                'status'  => fn () => $request->session()->get('status'),
            ],
            'csrf_token' => fn () => csrf_token(),
        ]);
    }
}