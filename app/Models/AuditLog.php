<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public $timestamps = false; // Só tem createdAt

    protected $fillable = ['entityType', 'entityId', 'action', 'description', 'performedBy', 'payloadJson', 'createdAt'];
}