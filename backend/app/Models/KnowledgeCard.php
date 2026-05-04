<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KnowledgeCard extends Model
{
    protected $fillable = [
        'section',
        'icon',
        'title',
        'summary',
        'stat_1_value',
        'stat_1_label',
        'stat_2_value',
        'stat_2_label',
        'body',
        'sort_order',
    ];
}
