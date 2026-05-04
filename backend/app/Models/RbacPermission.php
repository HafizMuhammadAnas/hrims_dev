<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class RbacPermission extends Model
{
    protected $table = 'rbac_permissions';

    public $timestamps = true;

    protected $fillable = [
        'slug',
        'name',
        'description',
    ];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(
            RbacRole::class,
            'rbac_role_permission',
            'permission_id',
            'role_id'
        );
    }
}
