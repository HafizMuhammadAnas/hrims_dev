<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssueIndicatorYearReligion extends Model
{
    protected $table = 'issue_indicator_year_religion';

    protected $fillable = [
        'issue_indicator_id',
        'collection_year_id',
        'collection_religion_id',
    ];

    public function issueIndicator(): BelongsTo
    {
        return $this->belongsTo(IssueIndicator::class);
    }

    public function collectionYear(): BelongsTo
    {
        return $this->belongsTo(CollectionYear::class);
    }

    public function collectionReligion(): BelongsTo
    {
        return $this->belongsTo(CollectionReligion::class);
    }
}
