<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = [
        'openId',
        'name',
        'email',
        'password',
        'loginMethod',
        'role',
        'lastSignedIn',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password'          => 'hashed',
            'email_verified_at' => 'datetime',
            'lastSignedIn'      => 'datetime',
        ];
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
