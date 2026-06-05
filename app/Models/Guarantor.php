<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Guarantor extends Model
{
    protected $table = 'guarantors';

    protected $fillable = [
        'name',
        'personType',
        'nationality',
        'maritalStatus',
        'cpf',
        'rg',
        'cnpj',
        'tradeName',
        'stateRegistration',
        'street',
        'number',
        'complement',
        'neighborhood',
        'city',
        'state',
        'zipCode',
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    /**
     * Clientes vinculados a este fiador (NxN).
     */
    public function clients(): BelongsToMany
    {
        return $this->belongsToMany(
            Client::class,
            'client_guarantor',
            'guarantorId',
            'clientId'
        )
        ->using(\Illuminate\Database\Eloquent\Relations\Pivot::class)
        ->withTimestamps('createdAt', 'updatedAt');
    }

    /**
     * Contratos vinculados a este fiador (NxN — para uso futuro no CRUD de contratos).
     */
    public function contracts(): BelongsToMany
    {
        return $this->belongsToMany(
            Contract::class,
            'contract_guarantor',
            'guarantorId',
            'contractId'
        )
        ->using(\Illuminate\Database\Eloquent\Relations\Pivot::class)
        ->withTimestamps('createdAt', 'updatedAt');
    }
}
