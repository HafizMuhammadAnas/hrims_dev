<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompiledRecord extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'federal_group_id',
        'title',
        'region_names',
        'compilation_date',
        'submitted_to',
        'submission_date',
        'status',
        'attachment',
        'summary',
    ];

    protected function casts(): array
    {
        return [
            'region_names' => 'array',
            'compilation_date' => 'date',
            'submission_date' => 'date',
        ];
    }

    public function federalGroup(): BelongsTo
    {
        return $this->belongsTo(FederalGroup::class, 'federal_group_id');
    }
}
