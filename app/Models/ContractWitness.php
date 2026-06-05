<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractWitness extends Model
{
    protected $table = 'contract_witnesses';

    protected $fillable = [
        'contractId',
        'name',
        'cpf',
        'ci',
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    /**
     * Contrato dono desta testemunha (1:N inverso).
     * Cascade configurado na migration: apagar o contrato apaga suas testemunhas.
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contractId');
    }
}
