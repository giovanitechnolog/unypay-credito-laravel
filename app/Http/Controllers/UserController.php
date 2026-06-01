<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    private const PHOTO_DIR = 'users/photos';

    /**
     * Renderiza a página /usuarios via Inertia.
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
            ->select([
                'id', 'created_by', 'name', 'email', 'photo', 'role', 
                'status', 'cpf', 'rg', 'phone', 'birthDate', 'gender',
                'createdAt', 'updatedAt', 'lastSignedIn'
            ]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('cpf', 'like', "%{$search}%");
            });
        }

        $users = $query->orderBy('name')->paginate($perPage);

        return response()->json($users);
    }

    /**
     * POST /api/users — cria um novo usuário administrativo.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'      => 'required|string|max:255',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:6',
            'role'      => 'required|in:user,admin',
            'status'    => 'required|in:Ativo,Inativo',
            'photo'     => 'nullable|file|image|max:2048',
            'cpf'       => 'nullable|string|max:14|unique:users,cpf',
            'rg'        => 'nullable|string|max:20',
            'phone'     => 'nullable|string|max:15',
            'birthDate' => 'nullable|date',
            'gender'    => 'nullable|string|max:20',
        ]);

        $photoPath = null;
        if ($request->hasFile('photo')) {
            $photoPath = $request->file('photo')->store(self::PHOTO_DIR, 'public');
        }

        $cpf   = $request->input('cpf') ? preg_replace('/\D/', '', $request->input('cpf')) : null;
        $phone = $request->input('phone') ? preg_replace('/\D/', '', $request->input('phone')) : null;

        $user = User::create([
            'created_by'   => Auth::id(),
            'name'         => $request->input('name'),
            'email'        => Str::lower($request->input('email')),
            'password'     => $request->input('password'), 
            'photo'        => $photoPath,
            'role'         => $request->input('role', 'user'),
            'status'       => $request->input('status', 'Ativo'),
            'loginMethod'  => 'password',
            'cpf'          => $cpf,
            'rg'           => $request->input('rg'),
            'phone'        => $phone,
            'birthDate'    => $request->input('birthDate'),
            'gender'       => $request->input('gender'),
            'lastSignedIn' => now(),
        ]);

        return response()->json([
            'message' => 'Usuário criado com sucesso.',
            'user'    => $user->append('photoUrl'), // 🚀 Injeta a URL virtual amigável na resposta imediata
        ], 201);
    }

    /**
     * PUT/POST /api/users/{id} — atualiza a ficha do operador.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $request->validate([
            'name'      => 'required|string|max:255',
            'email'     => 'required|email|unique:users,email,' . $user->id,
            'password'  => 'nullable|string|min:6',
            'role'      => 'required|in:user,admin',
            'status'    => 'required|in:Ativo,Inativo',
            'photo'     => 'nullable|file|image|max:2048',
            'cpf'       => 'nullable|string|max:14|unique:users,cpf,' . $user->id,
            'rg'        => 'nullable|string|max:20',
            'phone'     => 'nullable|string|max:15',
            'birthDate' => 'nullable|date',
            'gender'    => 'nullable|string|max:20',
        ]);

        $cpf   = $request->input('cpf') ? preg_replace('/\D/', '', $request->input('cpf')) : null;
        $phone = $request->input('phone') ? preg_replace('/\D/', '', $request->input('phone')) : null;

        $payload = [
            'name'      => $request->input('name'),
            'email'     => Str::lower($request->input('email')),
            'role'      => $request->input('role', $user->role),
            'status'    => $request->input('status', $user->status),
            'cpf'       => $cpf,
            'rg'        => $request->input('rg'),
            'phone'     => $phone,
            'birthDate' => $request->input('birthDate'),
            'gender'    => $request->input('gender'),
        ];

        if ($request->filled('password')) {
            $payload['password'] = $request->input('password');
        }

        if ($request->hasFile('photo')) {
            $oldPhoto = $user->photo;
            $payload['photo'] = $request->file('photo')->store(self::PHOTO_DIR, 'public');

            if ($oldPhoto && Storage::disk('public')->exists($oldPhoto)) {
                Storage::disk('public')->delete($oldPhoto);
            }
        }

        $user->update($payload);

        return response()->json([
            'message' => 'Usuário actualizado com sucesso.',
            'user'    => $user->append('photoUrl'), // 🚀 Injeta a URL virtual amigável na resposta imediata
        ]);
    }

    /**
     * DELETE /api/users/{id} — remove o usuário administrativo.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'Você não pode excluir o próprio usuário operacional.',
            ], 422);
        }

        if ($user->photo && Storage::disk('public')->exists($user->photo)) {
            Storage::disk('public')->delete($user->photo);
        }

        $user->delete();

        return response()->json([
            'message' => 'Usuário excluído com sucesso.',
        ]);
    }
}