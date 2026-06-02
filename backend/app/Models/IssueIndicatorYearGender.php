<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IssueIndicatorYearGender extends Model
{
    protected $table = 'issue_indicator_year_gender';

    protected $fillable = [
        'issue_indicator_id',
        'collection_year_id',
        'collection_gender_id',
    ];

    public function issueIndicator(): BelongsTo
    {
        return $this->belongsTo(IssueIndicator::class);
    }

    public function collectionYear(): BelongsTo
    {
        return $this->belongsTo(CollectionYear::class);
    }

    public function collectionGender(): BelongsTo
    {
        return $this->belongsTo(CollectionGender::class);
    }
}
