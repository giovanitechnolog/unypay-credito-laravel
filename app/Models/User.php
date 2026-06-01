<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use Notifiable;

    /**
     * Este modelo usa colunas em camelCase (createdAt, updatedAt, lastSignedIn,
     * openId, loginMethod, photo, etc.). Desabilitamos a conversão automática
     * para snake_case usada pelos accessors do estilo Attribute, garantindo
     * que `$appends = ['photoUrl']` resolva o método `photoUrl()` corretamente.
     */
    public static $snakeAttributes = false;

    /**
     * 🚀 ATRIBUIÇÃO EM MASSA ATUALIZADA
     * Liberados os novos campos para que o UserController consiga gravar e atualizar!
     */
    protected $fillable = [
        'openId',
        'name',
        'email',
        'password',
        'photo',
        'loginMethod',
        'role',
        'status',      // 👈 Novo status ativo/inativo
        'created_by',  // 👈 ID do admin que criou o registro (Auditoria)
        'lastSignedIn',
        'cpf',         // 👈 Novo campo CPF
        'rg',          // 👈 Novo campo RG
        'phone',       // 👈 Novo campo Telefone
        'birthDate',   // 👈 Novo campo Data de Nascimento
        'gender',      // 👈 Novo campo Gênero
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Sempre expõe a URL pública da foto no JSON, sem precisar montar no front.
     */
    protected $appends = ['photoUrl'];

    protected function casts(): array
    {
        return [
            'password'          => 'hashed',
            'email_verified_at' => 'datetime',
            'lastSignedIn'      => 'datetime',
        ];
    }

    /**
     * URL pública para exibir a foto na UI. Retorna null caso o usuário ainda
     * não tenha foto cadastrada.
     */
    protected function photoUrl(): Attribute
    {
        return Attribute::get(function () {
            if (empty($this->photo)) {
                return null;
            }
            return '/storage/' . ltrim($this->photo, '/');
        });
    }

    /**
     * A migration original definiu colunas customizadas para timestamps.
     */
    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    /**
     * Garante um openId não-nulo (UNIQUE no schema) caso não seja informado.
     */
    protected static function booted(): void
    {
        static::creating(function (self $user) {
            if (empty($user->openId)) {
                $user->openId = (string) Str::uuid();
            }
            if (empty($user->loginMethod)) {
                $user->loginMethod = 'password';
            }
        });
    }
}