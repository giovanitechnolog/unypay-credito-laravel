<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $fillable = [
        'name', 'document', 'email', 'phone', 'address', 
        'city', 'state', 'zipCode', 'personType', 'riskRating', 'notes'
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    // Um cliente tem muitos contratos
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'clientId');
    }

    /**
     * Fiadores vinculados a este cliente (NxN).
     */
    public function guarantors(): BelongsToMany
    {
        return $this->belongsToMany(
            Guarantor::class,
            'client_guarantor',
            'clientId',
            'guarantorId'
        )->withTimestamps('createdAt', 'updatedAt');
    }
}