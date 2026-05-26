<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

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
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user()
                    ? [
                        'id'       => $request->user()->id,
                        'name'     => $request->user()->name,
                        'email'    => $request->user()->email,
                        'role'     => $request->user()->role,
                        'photoUrl' => $request->user()->photoUrl,
                    ]
                    : null,
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
