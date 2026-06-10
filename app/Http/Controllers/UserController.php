<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Rules\Cpf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    private const PHOTO_DIR = 'users/photos';

    /**
     * Limites de tamanho por campo, espelhando exatamente o schema da
     * tabela `users` (migrations 0001 + add_cadastro_fields). Centralizados
     * aqui para que controller, attributes() e mensagens fiquem em sincronia
     * — e para tornar trivial a manutenção quando a coluna mudar.
     */
    private const LIMITS = [
        'name'      => 255,   // text na DDL, mas regulamos UX em 255
        'email'     => 320,   // string(320) — RFC 5321
        'password'  => 255,   // limite de bcrypt usável
        'cpf'       => 14,    // 000.000.000-00 → guardado sem máscara, 11 dígitos
        'rg'        => 20,
        'phone'     => 15,    // (00) 00000-0000 → guardado sem máscara, até 11 dígitos
        'gender'    => 20,
    ];

    /**
     * Nomes amigáveis em PT-BR para os :attribute das mensagens automáticas
     * do validation.php. Compartilhado entre store() e update() para garantir
     * consistência. Inclui também as chaves de confirmação (regra `confirmed`
     * do Laravel espera `email_confirmation` / `password_confirmation`).
     */
    private function attributes(): array
    {
        return [
            'name'                  => 'nome completo',
            'email'                 => 'e-mail',
            'email_confirmation'    => 'confirmação de e-mail',
            'password'              => 'nova senha',
            'password_confirmation' => 'confirmação da nova senha',
            'current_password'      => 'senha atual',
            'role'                  => 'nível de permissão',
            'status'                => 'status operacional',
            'photo'                 => 'foto',
            'cpf'                   => 'CPF',
            'rg'                    => 'RG',
            'phone'                 => 'telefone',
            'birthDate'             => 'data de nascimento',
            'gender'                => 'gênero',
        ];
    }

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
     *
     * Camadas de segurança:
     *   • email  → exige `email_confirmation` casando (regra `confirmed`).
     *   • senha  → exige `password_confirmation` casando (regra `confirmed`).
     *   • CPF    → valida algoritmo dos dois dígitos verificadores (Rule Cpf).
     *   • limites → todos os max:N espelham o schema (self::LIMITS).
     */
    public function store(Request $request): JsonResponse
    {
        $rules = [
            'name'                  => ['required', 'string', 'max:' . self::LIMITS['name']],
            'email'                 => ['required', 'email', 'max:' . self::LIMITS['email'], 'confirmed', 'unique:users,email'],
            'email_confirmation'    => ['required', 'email', 'max:' . self::LIMITS['email']],
            'password'              => ['required', 'string', 'min:6', 'max:' . self::LIMITS['password'], 'confirmed'],
            'password_confirmation' => ['required', 'string'],
            'role'                  => ['required', Rule::in(['user', 'admin'])],
            'status'                => ['required', Rule::in(['Ativo', 'Inativo'])],
            'photo'                 => ['nullable', 'file', 'image', 'max:2048'],
            'cpf'                   => ['nullable', 'string', 'max:' . self::LIMITS['cpf'], new Cpf(), 'unique:users,cpf'],
            'rg'                    => ['nullable', 'string', 'max:' . self::LIMITS['rg']],
            'phone'                 => ['nullable', 'string', 'max:' . self::LIMITS['phone']],
            'birthDate'             => ['nullable', 'date'],
            'gender'                => ['nullable', 'string', 'max:' . self::LIMITS['gender']],
        ];

        $request->validate($rules, $this->messages(), $this->attributes());

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
            'user'    => $user->append('photoUrl'),
        ], 201);
    }

    /**
     * PUT/POST /api/users/{id} — atualiza a ficha do operador.
     *
     * Camadas de segurança específicas da edição:
     *   • email_confirmation só é exigida se o e-mail mudou em relação ao
     *     valor atual do usuário (digitar tudo de novo seria UX ruim).
     *   • password é totalmente OPCIONAL: se vazio, mantém a senha atual.
     *     Quando o operador envia uma nova senha, exige:
     *       - current_password (validada via Hash::check)
     *       - password_confirmation casando com password
     *     Se NENHUM dos três campos foi enviado, ignora todo o bloco.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $emailChanged = Str::lower((string) $request->input('email'))
            !== Str::lower((string) $user->email);

        $changingPassword = $request->filled('password')
            || $request->filled('password_confirmation')
            || $request->filled('current_password');

        $rules = [
            'name'   => ['required', 'string', 'max:' . self::LIMITS['name']],
            'email'  => [
                'required',
                'email',
                'max:' . self::LIMITS['email'],
                $emailChanged ? 'confirmed' : 'nullable',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'role'      => ['required', Rule::in(['user', 'admin'])],
            'status'    => ['required', Rule::in(['Ativo', 'Inativo'])],
            'photo'     => ['nullable', 'file', 'image', 'max:2048'],
            'cpf'       => [
                'nullable',
                'string',
                'max:' . self::LIMITS['cpf'],
                new Cpf(),
                Rule::unique('users', 'cpf')->ignore($user->id),
            ],
            'rg'        => ['nullable', 'string', 'max:' . self::LIMITS['rg']],
            'phone'     => ['nullable', 'string', 'max:' . self::LIMITS['phone']],
            'birthDate' => ['nullable', 'date'],
            'gender'    => ['nullable', 'string', 'max:' . self::LIMITS['gender']],
        ];

        if ($emailChanged) {
            $rules['email_confirmation'] = ['required', 'email', 'max:' . self::LIMITS['email']];
        }

        if ($changingPassword) {
            $rules['current_password']      = ['required', 'string'];
            $rules['password']               = ['required', 'string', 'min:6', 'max:' . self::LIMITS['password'], 'confirmed'];
            $rules['password_confirmation']  = ['required', 'string'];
        }

        $request->validate($rules, $this->messages(), $this->attributes());

        // Confere a senha atual ANTES de aplicar mudanças, para nunca trocar
        // credenciais de alguém só porque a sessão dele estava aberta.
        if ($changingPassword && ! Hash::check((string) $request->input('current_password'), (string) $user->password)) {
            return response()->json([
                'message' => 'A senha atual informada está incorreta.',
                'errors'  => ['current_password' => ['A senha atual informada está incorreta.']],
            ], 422);
        }

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

        if ($changingPassword) {
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
            'message' => 'Usuário atualizado com sucesso.',
            'user'    => $user->append('photoUrl'),
        ]);
    }

    /**
     * Mensagens 100% PT-BR para as regras com nuance de domínio (regras
     * básicas tipo `required`/`max` continuam vindo do
     * `lang/pt_BR/validation.php` com :attribute amigável).
     */
    private function messages(): array
    {
        return [
            'email.confirmed'                     => 'O e-mail e a confirmação de e-mail não conferem.',
            'email.unique'                        => 'Este e-mail já está vinculado a outro operador.',
            'email_confirmation.required'         => 'Confirme o e-mail digitando-o novamente.',
            'password.confirmed'                  => 'A nova senha e a confirmação não conferem.',
            'password_confirmation.required'      => 'Confirme a nova senha digitando-a novamente.',
            'password.min'                        => 'A nova senha deve ter pelo menos :min caracteres.',
            'current_password.required'           => 'Informe a senha atual para alterar a senha.',
            'cpf.unique'                          => 'Este CPF já está vinculado a outro operador.',
            'role.in'                             => 'Selecione um nível de permissão válido (Operador ou Diretor).',
            'status.in'                           => 'Selecione um status válido (Ativo ou Inativo).',
            'photo.image'                         => 'A foto deve ser uma imagem válida (JPG, PNG ou WEBP).',
            'photo.max'                           => 'A foto não pode ultrapassar 2 MB.',
        ];
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