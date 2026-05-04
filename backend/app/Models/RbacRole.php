<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class RbacRole extends Model
{
    protected $table = 'rbac_roles';

    public $timestamps = true;

    protected $fillable = [
        'slug',
        'name',
        'description',
    ];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(
            RbacPermission::class,
            'rbac_role_permission',
            'role_id',
            'permission_id'
        );
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'rbac_user_role', 'role_id', 'user_id');
    }
}
