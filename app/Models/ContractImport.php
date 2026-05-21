<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContractImport extends Model
{
    protected $fillable = [
        'userId',
        'originalFilename',
        'storedPath',
        'status',
        'totalContracts',
        'totalInstallments',
        'processedRows',
        'successRows',
        'errorRows',
        'errorsJson',
        'summaryJson',
        'startedAt',
        'finishedAt',
    ];

    const CREATED_AT = 'createdAt';
    const UPDATED_AT = 'updatedAt';

    protected $casts = [
        'errorsJson'    => 'array',
        'summaryJson'   => 'array',
        'startedAt'     => 'datetime',
        'finishedAt'    => 'datetime',
    ];

    public const STATUS_QUEUED     = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_DONE       = 'done';
    public const STATUS_FAILED     = 'failed';
    public const STATUS_CANCELLED  = 'cancelled';

    public function isFinished(): bool
    {
        return in_array($this->status, [self::STATUS_DONE, self::STATUS_FAILED, self::STATUS_CANCELLED], true);
    }
}
