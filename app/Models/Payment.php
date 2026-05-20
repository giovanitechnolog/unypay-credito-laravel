<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    // Esta tabela não tem a coluna updatedAt, então avisamos o Laravel
    public $timestamps = false;
    
    protected $fillable = ['installmentId', 'amount', 'paidAt', 'method', 'notes', 'recordedBy', 'createdAt'];

    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class, 'installmentId');
    }
}