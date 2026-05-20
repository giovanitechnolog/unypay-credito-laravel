<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Installment extends Model
{
    protected $fillable = ['contractId', 'installmentNumber', 'dueDate', 'originalAmount', 'status', 'notes'];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contractId');
    }

    // Uma parcela tem muitos pagamentos (caso haja pagamento parcial)
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'installmentId');
    }
}