<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsignorBankAccount extends Model
{
    protected $table = 'consignor_bank_accounts';

    protected $fillable = [
        'consignorId',
        'bankName',
        'agency',
        'accountNumber',
        'accountType',
        'pixKey',
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    public function consignor(): BelongsTo
    {
        return $this->belongsTo(Consignor::class, 'consignorId');
    }
}
