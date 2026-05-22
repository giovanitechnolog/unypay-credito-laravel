<?php

namespace App\Http\Controllers;

use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Renderiza a página /usuarios via Inertia.
     * A lista é carregada via /api/users (JSON), permitindo refresh sem reload.
     */
    public function index(): Response
    {
        return Inertia::render('Users');
    }

    /**
     * GET /api/users — lista paginada/filtrável em JSON.
     */
    public function list(Request $request): JsonResponse
    {
        $search  = trim((string) $request->input('search', ''));
        $perPage = (int) $request->input('per_page', 25);

        $query = User::query()
            ->select(['id', 'name', 'email', 'role', 'createdAt', 'updatedAt', 'lastSignedIn']);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->orderBy('name')->paginate($perPage);

        return response()->json($users);
    }

    /**
     * POST /api/users — cria um novo usuário administrativo.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = User::create([
            'name'         => $request->string('name'),
            'email'        => $request->string('email')->lower(),
            'password'     => $request->string('password'),
            'role'         => $request->input('role', 'admin'),
            'loginMethod'  => 'password',
            'lastSignedIn' => now(),
        ]);

        return response()->json([
            'message' => 'Usuário criado com sucesso.',
            'user'    => $user->only(['id', 'name', 'email', 'role']),
        ], 201);
    }

    /**
     * PUT /api/users/{user} — atualiza nome/e-mail/role e, opcionalmente, senha.
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $payload = [
            'name'  => $request->string('name'),
            'email' => $request->string('email')->lower(),
            'role'  => $request->input('role', $user->role),
        ];

        if ($request->filled('password')) {
            $payload['password'] = $request->string('password');
        }

        $user->update($payload);

        return response()->json([
            'message' => 'Usuário atualizado com sucesso.',
            'user'    => $user->only(['id', 'name', 'email', 'role']),
        ]);
    }

    /**
     * DELETE /api/users/{user} — remove o usuário.
     * Não permite que o próprio usuário se exclua.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'Você não pode excluir o próprio usuário.',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'message' => 'Usuário excluído com sucesso.',
        ]);
    }
}
