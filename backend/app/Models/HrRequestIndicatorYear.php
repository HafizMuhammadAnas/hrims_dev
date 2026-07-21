<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrRequestIndicatorYear extends Model
{
    public const KIND_QUANTITATIVE = 'quantitative';

    public const KIND_QUALITATIVE = 'qualitative';

    protected $fillable = [
        'hr_request_id',
        'issue_indicator_id',
        'collection_year_id',
        'kind',
    ];

    public function hrRequest(): BelongsTo
    {
        return $this->belongsTo(HrRequest::class, 'hr_request_id', 'id');
    }

    public function issueIndicator(): BelongsTo
    {
        return $this->belongsTo(IssueIndicator::class, 'issue_indicator_id');
    }

    public function collectionYear(): BelongsTo
    {
        return $this->belongsTo(CollectionYear::class, 'collection_year_id');
    }
}
