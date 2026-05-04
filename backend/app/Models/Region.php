<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Region extends Model
{
    protected $fillable = [
        'name',
        'slug',
    ];

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'department_region');
    }

    public function districts(): HasMany
    {
        return $this->hasMany(District::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function hrRequests(): HasMany
    {
        return $this->hasMany(HrRequest::class);
    }
}
