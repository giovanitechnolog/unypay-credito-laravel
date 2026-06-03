<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends Model
{
    protected $fillable = [
        'clientId', 'code', 'contractName', 'creditor', 'contractType', 'contractDate',
        'status', 'validated', 'principalAmount', 'financedTotal', 'tacAmount', 'iofAmount',
        'installmentCount', 'installmentAmount', 'firstDueDate', 'monthlyInterestRate',
        'moraRateMonthly', 'penaltyRate', 'penaltyBaseType', 'penaltyScope', 'correctionIndex',
        'honoraryRate', 'accelerates', 'accelerationRule', 'accelerationConsecutiveThreshold',
        'accelerationAlternateThreshold', 'guarantees', 'guarantors', 'validationUrl',
        'sourcePdfName', 'contractPdfPath', 'observations', 'contract_type_id',
        'chosenBankAccount', 'paymentMethod', 'forumLocation',
        'confessionOfDebt',
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $casts = [
        'validated' => 'boolean',
        'accelerates' => 'boolean',
        'confessionOfDebt' => 'boolean',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'clientId');
    }

    // Um contrato tem muitas parcelas
    public function installments(): HasMany
    {
        return $this->hasMany(Installment::class, 'contractId');
    }

    /**
     * Fiadores vinculados a este contrato (NxN — substitui o antigo campo texto `guarantors`).
     */
    public function guarantors(): BelongsToMany
    {
        return $this->belongsToMany(
            Guarantor::class,
            'contract_guarantor',
            'contractId',
            'guarantorId'
        )->withTimestamps('createdAt', 'updatedAt');
    }

    /**
     * Bens ofertados em garantia (1:N — veículos e imóveis).
     *
     * Estratégia de update no controller: diff manual (preserva IDs e createdAt
     * dos registros que continuam) — definido na Etapa 2 desta feature.
     * Cascade configurado na migration de contract_assets.
     */
    public function assets(): HasMany
    {
        return $this->hasMany(ContractAsset::class, 'contractId');
    }
}