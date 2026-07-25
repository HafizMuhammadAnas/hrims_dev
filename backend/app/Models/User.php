<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'name',
    'username',
    'email',
    'password',
    'region_id',
    'department_id',
    'convention_id',
    'is_active',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function convention(): BelongsTo
    {
        return $this->belongsTo(Convention::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(RbacRole::class, 'rbac_user_role', 'user_id', 'role_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function hasRole(string $slug): bool
    {
        return $this->roles()->where('slug', $slug)->exists();
    }

    public function hasPermission(string $slug): bool
    {
        return $this->roles->flatMap(fn (RbacRole $role) => $role->permissions)->contains('slug', $slug);
    }
}
