<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    /** Allowed region slugs (matches regions seeded for the catalog). */
    public const REGION_SLUGS = [
        'ict',
        'punjab',
        'sindh',
        'balochistan',
        'kpk',
        'islamabad',
        'gb',
        'ajk',
    ];

    protected $fillable = [
        'code',
        'name',
        'type',
    ];

    public function regions(): BelongsToMany
    {
        return $this->belongsToMany(Region::class, 'department_region');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function departmentTasks(): HasMany
    {
        return $this->hasMany(DepartmentTask::class);
    }

    public function coversRegionSlug(string $slug): bool
    {
        if ($slug === 'federal') {
            $slug = 'ict';
        }

        return $this->regions()->where('slug', $slug)->exists();
    }
}
