<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssueIndicatorYear extends Model
{
    protected $table = 'issue_indicator_years';

    protected $fillable = [
        'issue_indicator_id',
        'collection_year_id',
    ];

    public function issueIndicator(): BelongsTo
    {
        return $this->belongsTo(IssueIndicator::class);
    }

    public function collectionYear(): BelongsTo
    {
        return $this->belongsTo(CollectionYear::class);
    }
}
