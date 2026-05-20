<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use Notifiable;

    protected $fillable = ['openId', 'name', 'email', 'loginMethod', 'role', 'lastSignedIn'];
    
    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';
}