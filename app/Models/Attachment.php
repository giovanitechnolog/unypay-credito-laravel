<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attachment extends Model
{
    public $timestamps = false; // Só tem createdAt

    protected $fillable = [
        'contractId', 'clientId', 'attachmentType', 'originalName', 
        'storageKey', 'storageUrl', 'mimeType', 'fileSize', 'notes', 'uploadedBy', 'createdAt'
    ];

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contractId');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'clientId');
    }
}