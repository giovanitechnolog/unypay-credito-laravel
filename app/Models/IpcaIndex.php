<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IpcaIndex extends Model
{
    protected $fillable = ['monthRef', 'monthEnd', 'monthlyRate', 'sourceName', 'sourceUrl'];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';
}