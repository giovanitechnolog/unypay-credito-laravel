<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractAsset extends Model
{
    protected $table = 'contract_assets';

    public const TYPE_VEHICLE     = 'vehicle';
    public const TYPE_REAL_ESTATE = 'real_estate';

    protected $fillable = [
        'contractId',
        'assetType',
        // Veículos
        'brand',
        'model',
        'manufactureYear',
        'modelYear',
        'plate',
        'renavam',
        'chassis',
        // Imóveis
        'description',
        'location',
        'registryNumber',
        'totalArea',
        'boundaries',
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $casts = [
        'manufactureYear' => 'integer',
        'modelYear'       => 'integer',
        'totalArea'       => 'decimal:2',
    ];

    /**
     * Contrato dono deste bem em garantia (1:N inverso).
     * O cascade está configurado na migration: apagar o contrato apaga seus bens.
     */
    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contractId');
    }
}
