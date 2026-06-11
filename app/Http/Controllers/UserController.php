<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Rules\Cpf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Throwable;

class UserController extends Controller
{
    private const PHOTO_DIR  = 'users/photos';
    private const PHOTO_DISK = 'public';

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

        try {
            $photoPath = $request->hasFile('photo')
                ? $this->storeUserPhoto($request->file('photo'))
                : null;
        } catch (RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'errors'  => ['photo' => [$e->getMessage()]],
            ], 500);
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
            try {
                $newPhoto = $this->storeUserPhoto($request->file('photo'));
            } catch (RuntimeException $e) {
                return response()->json([
                    'message' => $e->getMessage(),
                    'errors'  => ['photo' => [$e->getMessage()]],
                ], 500);
            }

            $oldPhoto = $user->photo;
            $payload['photo'] = $newPhoto;

            if ($oldPhoto && Storage::disk(self::PHOTO_DISK)->exists($oldPhoto)) {
                Storage::disk(self::PHOTO_DISK)->delete($oldPhoto);
            }

            // Em ambientes sem symlink, removemos também a cópia física que
            // o `storeUserPhoto()` colocou em `public/storage/...` — caso
            // contrário, o arquivo antigo continuaria sendo servido pelo
            // webserver mesmo após a troca da foto.
            $this->unmirrorPhotoFromPublic($oldPhoto);
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

        if ($user->photo && Storage::disk(self::PHOTO_DISK)->exists($user->photo)) {
            Storage::disk(self::PHOTO_DISK)->delete($user->photo);
        }

        // Limpa eventual cópia física em `public/storage/...` (ambientes
        // sem symlink). Em ambientes com symlink válido este helper é no-op.
        $this->unmirrorPhotoFromPublic($user->photo);

        $user->delete();

        return response()->json([
            'message' => 'Usuário excluído com sucesso.',
        ]);
    }

    /**
     * Persiste a foto enviada com várias camadas de defesa contra os modos de
     * falha que tornam upload de imagem "silencioso" em produção:
     *
     *   1. Garante que `storage/app/public/users/photos` exista (o Flysystem
     *      cria sob demanda, mas em servidores Linux com `open_basedir`
     *      restritivo ou perms 700 a criação implícita pode falhar).
     *   2. Verifica que `store()` retornou uma string não vazia — em alguns
     *      cenários (disco cheio, perms negadas) o Flysystem devolve `false`.
     *   3. Confirma que o arquivo realmente está em disco depois do `store()`
     *      — protege contra o caso em que o driver retornou um path mas o
     *      arquivo final não foi gravado.
     *   4. Loga em `laravel.log` todos os detalhes técnicos relevantes em
     *      caso de falha (root do disco, perms, tamanho/mime do arquivo).
     *
     * Em caso de problema lança `RuntimeException` com mensagem amigável,
     * que o controller converte em JSON 500 com `errors.photo` preenchido.
     */
    private function storeUserPhoto(UploadedFile $file): string
    {
        $disk = Storage::disk(self::PHOTO_DISK);

        try {
            if (!$disk->exists(self::PHOTO_DIR)) {
                $disk->makeDirectory(self::PHOTO_DIR);
            }

            $path = $file->store(self::PHOTO_DIR, self::PHOTO_DISK);

            if (!is_string($path) || $path === '') {
                throw new RuntimeException('Flysystem retornou path vazio ao salvar a foto.');
            }

            if (!$disk->exists($path)) {
                throw new RuntimeException("Arquivo não persistiu no disco após store() (path: {$path}).");
            }

            // 🚀 Garante que a foto fique acessível publicamente, independente
            // do ambiente. Em servidores onde `php artisan storage:link` nunca
            // foi executado (ou onde o deploy descartou o symlink) o arquivo
            // físico existe em `storage/app/public/...` mas não é servido pelo
            // webserver via `/storage/...`. O helper abaixo:
            //   1) tenta criar/recriar o symlink quando ausente;
            //   2) se a criação não for possível (open_basedir, perms,
            //      hosting com restrição), faz cópia física para
            //      `public/storage/users/photos/...`.
            // Assim a URL `/storage/users/photos/foo.png` sempre resolve.
            $this->mirrorPhotoToPublic($path);

            return $path;
        } catch (\Throwable $e) {
            Log::error('[UserController@storeUserPhoto] Falha ao gravar foto', [
                'message'             => $e->getMessage(),
                'disk'                => self::PHOTO_DISK,
                'dir'                 => self::PHOTO_DIR,
                'root'                => config('filesystems.disks.' . self::PHOTO_DISK . '.root'),
                'file_size'           => $file->getSize(),
                'file_mime'           => $file->getMimeType(),
                'file_origin'         => $file->getClientOriginalName(),
                'storage_writable'    => is_writable(storage_path('app/public')),
                'storage_link_exists' => file_exists(public_path('storage')),
            ]);

            throw new RuntimeException(
                'Falha ao salvar a foto no servidor. Verifique se o diretório ' .
                '`storage/app/public/users/photos` existe e tem permissão de escrita ' .
                'para o usuário do PHP, e se `php artisan storage:link` foi executado. ' .
                'Rode `php artisan storage:check --fix` para diagnóstico/reparo automático. ' .
                'Detalhes técnicos em storage/logs/laravel.log.'
            );
        }
    }

    /**
     * Garante que `$relativePath` (ex.: `users/photos/abc.png`) fique
     * publicamente acessível via URL `/storage/{relativePath}`.
     *
     * Estratégia em 3 camadas (da mais barata à mais robusta):
     *   1) Verifica se `public/storage` já é um symlink/junction válido
     *      apontando para `storage/app/public`. Se sim, nada a fazer —
     *      o arquivo recém-salvo já é visível pelo link.
     *   2) Se `public/storage` não existe, tenta executar `storage:link`
     *      programaticamente. Funciona em ambientes onde o usuário do PHP
     *      tem permissão de criar symlinks (Laragon local, maioria dos
     *      VPS Linux, Plesk com SymlinkProtection desabilitado, etc.).
     *   3) Se nenhum dos passos anteriores resultar em link válido,
     *      cai no fallback de cópia física: copia o arquivo de
     *      `storage/app/public/{path}` para `public/storage/{path}`.
     *      Funciona até em hospedagens compartilhadas onde symlink via
     *      PHP é proibido — o webserver passa a servir a cópia direta.
     *
     * Nunca lança — falhas são logadas e ignoradas para não quebrar o
     * upload (a foto continua persistida no disco principal).
     */
    private function mirrorPhotoToPublic(string $relativePath): void
    {
        $relativePath = ltrim($relativePath, '/\\');
        $publicLink   = public_path('storage');
        $appPublic    = storage_path('app/public');
        $sourceFile   = $appPublic . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

        if (!is_file($sourceFile)) {
            return;
        }

        if ($this->publicStorageIsLinked($publicLink, $appPublic)) {
            return;
        }

        if (!file_exists($publicLink)) {
            try {
                Artisan::call('storage:link');
            } catch (Throwable $e) {
                Log::warning('[UserController@mirrorPhotoToPublic] storage:link falhou', [
                    'message' => $e->getMessage(),
                ]);
            }

            if ($this->publicStorageIsLinked($publicLink, $appPublic)) {
                return;
            }
        }

        try {
            $targetFile = public_path('storage' . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath));
            $targetDir  = dirname($targetFile);

            if (!is_dir($targetDir) && !@mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
                Log::warning('[UserController@mirrorPhotoToPublic] mkdir falhou', [
                    'targetDir' => $targetDir,
                ]);
                return;
            }

            if (!@copy($sourceFile, $targetFile)) {
                Log::warning('[UserController@mirrorPhotoToPublic] copy falhou', [
                    'sourceFile' => $sourceFile,
                    'targetFile' => $targetFile,
                ]);
            }
        } catch (Throwable $e) {
            Log::warning('[UserController@mirrorPhotoToPublic] cópia falhou', [
                'message'      => $e->getMessage(),
                'relativePath' => $relativePath,
            ]);
        }
    }

    /**
     * Contraparte de `mirrorPhotoToPublic`: quando uma foto é removida
     * (na atualização, troca ou exclusão do usuário), esta rotina apaga
     * a cópia física eventualmente existente em `public/storage/...`.
     *
     * Se `public/storage` for um symlink/junction válido para
     * `storage/app/public`, a deleção via `Storage::disk('public')->delete()`
     * já apagou o arquivo "lá e cá" — nada a fazer aqui.
     *
     * Caso contrário, a cópia física pode ainda existir no diretório
     * `public/storage/users/photos/` e precisa ser removida para evitar
     * "fotos órfãs" servidas após o usuário trocar/remover sua imagem.
     */
    private function unmirrorPhotoFromPublic(?string $relativePath): void
    {
        if (!$relativePath) {
            return;
        }

        $relativePath = ltrim($relativePath, '/\\');
        $publicLink   = public_path('storage');
        $appPublic    = storage_path('app/public');

        if ($this->publicStorageIsLinked($publicLink, $appPublic)) {
            return;
        }

        $targetFile = public_path('storage' . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath));

        if (is_file($targetFile)) {
            @unlink($targetFile);
        }
    }

    /**
     * Detecta se `public/storage` está corretamente "linkado" a
     * `storage/app/public`.
     *
     * Em vez de depender só de `is_link()` (que retorna `false` para
     * junctions do Windows), comparamos o `realpath` dos dois caminhos:
     * se ambos resolvem para o mesmo diretório real, o link é válido —
     * seja symlink Unix, junction Windows, ou qualquer estrutura
     * equivalente que o sistema operacional resolva transparentemente.
     */
    private function publicStorageIsLinked(string $publicLink, string $appPublic): bool
    {
        if (!file_exists($publicLink)) {
            return false;
        }

        $publicReal = realpath($publicLink);
        $appReal    = realpath($appPublic);

        return $publicReal !== false
            && $appReal !== false
            && $publicReal === $appReal;
    }
}