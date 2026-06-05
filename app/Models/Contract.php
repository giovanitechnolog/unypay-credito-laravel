<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Contract extends Model
{
    /** Papéis aceitos na pivot contract_guarantor. Reflete o ENUM da migration. */
    public const ROLE_FIADOR    = 'FIADOR';
    public const ROLE_CODEVEDOR = 'CODEVEDOR';

    protected $fillable = [
        'clientId', 'consignorId', 'code', 'contractName', 'creditor', 'contractType', 'contractDate',
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

    /**
     * Credor (Consignor) vinculado ao contrato — 1:N (um credor pode aparecer
     * em vários contratos; cada contrato tem no máximo um credor).
     *
     * Nullable: contratos podem existir sem credor associado. Use
     * `with('consignor.bankAccounts')` para carregar tudo de uma vez quando
     * for renderizar a aba "Consignante" no modal de edição.
     */
    public function consignor(): BelongsTo
    {
        return $this->belongsTo(Consignor::class, 'consignorId');
    }

    // Um contrato tem muitas parcelas
    public function installments(): HasMany
    {
        return $this->hasMany(Installment::class, 'contractId');
    }

    /**
     * Fiadores vinculados a este contrato (NxN — pivot contract_guarantor com role='FIADOR').
     *
     * O cadastro mestre (`guarantors`) é compartilhado entre Fiadores e Codevedores;
     * o que diferencia o papel é a coluna `role` na pivot. Por isso a relação aplica
     * `wherePivot('role', Contract::ROLE_FIADOR)` para escopar somente quem está
     * vinculado neste papel — e é por isso que `syncWithPivotValues()` é seguro:
     * o detach automático considera apenas as linhas que casam com o filtro.
     */
    public function guarantors(): BelongsToMany
    {
        return $this->belongsToMany(
            Guarantor::class,
            'contract_guarantor',
            'contractId',
            'guarantorId'
        )
            ->wherePivot('role', self::ROLE_FIADOR)
            ->withPivot('role')
            ->withTimestamps('createdAt', 'updatedAt');
    }

    /**
     * Codevedores vinculados a este contrato (NxN — pivot contract_guarantor com role='CODEVEDOR').
     *
     * Mesma estrutura da relação guarantors(), apenas com o filtro de role invertido.
     * Usar o mesmo cadastro `guarantors` evita duplicação e permite que a mesma
     * pessoa figure como Fiador em um contrato e Codevedor em outro.
     */
    public function codebtors(): BelongsToMany
    {
        return $this->belongsToMany(
            Guarantor::class,
            'contract_guarantor',
            'contractId',
            'guarantorId'
        )
            ->wherePivot('role', self::ROLE_CODEVEDOR)
            ->withPivot('role')
            ->withTimestamps('createdAt', 'updatedAt');
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