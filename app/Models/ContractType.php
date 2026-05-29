<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContractType extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'contract_type_id');
    }

    /**
     * Quantidade de contratos com status "Ativo" associados a este tipo.
     * Usado pelo ContractTypeController para bloquear a exclusão e expor
     * o badge na tabela do front-end.
     */
    public function activeContractsCount(): int
    {
        return $this->contracts()->where('status', 'Ativo')->count();
    }
}
