<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UprRecommendation extends Model
{
    protected $fillable = [
        'session_label',
        'code',
        'title',
        'body',
        'sort_order',
    ];
}
