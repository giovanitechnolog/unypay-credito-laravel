<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Consignor extends Model
{
    protected $table = 'consignors';

    protected $fillable = [
        'document',
        'name',
        'phone',
        'email',
        'street',
        'number',
        'neighborhood',
        'zipCode',
        'complement',
        'city',
        'state',
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    /**
     * 🚀 Mantém os nomes de relacionamentos em camelCase no JSON serializado.
     *
     * Por padrão, o Eloquent converte chaves de relacionamentos para
     * snake_case ao serializar (relationsToArray), o que faria
     * `with('bankAccounts')` virar `bank_accounts` no payload — quebrando
     * o front que lê `consignor.bankAccounts`. Como todo o projeto usa
     * camelCase (clients.zipCode, contracts.clientId, …), padronizamos aqui.
     */
    public static $snakeAttributes = false;

    /**
     * Contas bancárias / chaves PIX do credor (1:N).
     * Cascade-on-delete configurado em nível de banco.
     */
    public function bankAccounts(): HasMany
    {
        return $this->hasMany(ConsignorBankAccount::class, 'consignorId');
    }
}
