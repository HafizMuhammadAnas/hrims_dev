<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FederalGroup extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'title',
        'conv',
        'initiated_on',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'initiated_on' => 'date',
        ];
    }

    public function hrRequests(): BelongsToMany
    {
        return $this->belongsToMany(
            HrRequest::class,
            'federal_group_hr_request',
            'federal_group_id',
            'hr_request_id'
        );
    }

    public function regionalResponses(): HasMany
    {
        return $this->hasMany(RegionalResponse::class, 'federal_group_id');
    }

    public function compiledRecords(): HasMany
    {
        return $this->hasMany(CompiledRecord::class, 'federal_group_id');
    }
}
