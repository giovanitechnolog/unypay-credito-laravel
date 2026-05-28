<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserColumnPreference extends Model
{
    // Define a tabela que você acabou de criar no banco
    protected $table = 'user_column_preferences';

    // Permite a gravação em massa desses campos
    protected $fillable = ['user_id', 'table_key', 'visible_columns'];

    // 🚀 O PULO DO GATO: Converte automaticamente o JSON do banco em um Array do PHP e vice-versa
    protected $casts = [
        'visible_columns' => 'array'
    ];

    /**
     * Relacionamento com o Usuário dono da configuração
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}