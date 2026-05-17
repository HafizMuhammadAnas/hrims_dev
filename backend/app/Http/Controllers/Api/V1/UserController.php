<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\RbacRole;
use App\Models\Region;
use App\Models\User;
use App\Support\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $creator = $request->user();
        if (! $creator->hasRole('super_admin') && ! $creator->hasRole('federal_admin') && ! $creator->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = User::query()->with(['roles.permissions', 'region', 'department'])->orderBy('name');

        if ($creator->hasRole('super_admin')) {
            $rows = $query
                ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['federal_admin', 'regional_admin']))
                ->get();
        } elseif ($creator->hasRole('federal_admin')) {
            $rows = $query
                ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['department_admin', 'viewer']))
                ->whereHas('department.regions', fn ($r) => $r->where('slug', 'ict'))
                ->get();
        } else {
            if ($creator->region_id === null) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $creatorSlug = Region::query()->whereKey($creator->region_id)->value('slug');
            $rows = $query
                ->whereHas('roles', fn ($r) => $r->whereIn('slug', ['department_admin', 'viewer']))
                ->whereHas('department.regions', fn ($r) => $r->where('slug', $creatorSlug))
                ->get();
        }

        return response()->json([
            'data' => $rows->map(fn (User $user) => $this->serialize($user)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $creator = $request->user();
        if (! $creator->hasRole('super_admin') && ! $creator->hasRole('federal_admin') && ! $creator->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $roleSlugsAllowed = $creator->hasRole('super_admin')
            ? ['federal_admin', 'regional_admin']
            : ['department_admin', 'viewer'];

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role_slug' => ['required', Rule::in($roleSlugsAllowed)],
            'region_id' => ['nullable', 'integer', 'exists:regions,id'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'is_active' => ['sometimes', 'boolean'],
        ], [
            'name.required' => 'Full name is required.',
            'username.required' => 'Username is required.',
            'username.unique' => 'This username is already taken.',
            'email.email' => 'Enter a valid email address.',
            'email.unique' => 'This email is already registered.',
            'password.required' => 'Password is required.',
            'password.min' => 'Password must be at least 8 characters.',
            'role_slug.required' => 'Select a role.',
            'role_slug.in' => 'Select a valid role.',
            'department_id.exists' => 'Select a valid department.',
        ]);

        if ($creator->hasRole('super_admin')) {
            if ($data['role_slug'] === 'federal_admin') {
                $data['region_id'] = Region::query()->where('slug', 'ict')->value('id');
                $data['department_id'] = null;
            } else {
                if (empty($data['region_id'])) {
                    return response()->json(['message' => 'region_id is required for regional administrators.'], 422);
                }
                $data['department_id'] = null;
            }
        } else {
            $department = Department::query()->with('regions')->findOrFail($data['department_id']);
            if ($creator->hasRole('federal_admin')) {
                if (! $department->coversRegionSlug('ict')) {
                    return response()->json(['message' => 'Choose an ICT / national-line department for this user.'], 422);
                }
                $data['region_id'] = (int) Region::query()->where('slug', 'ict')->value('id');
            } elseif ($creator->hasRole('regional_admin')) {
                if ($creator->region_id === null) {
                    return response()->json(['message' => 'Forbidden'], 403);
                }
                $creatorSlug = Region::query()->whereKey($creator->region_id)->value('slug');
                if (! $department->coversRegionSlug((string) $creatorSlug)) {
                    return response()->json(['message' => 'Choose a department in your region.'], 422);
                }
                $data['region_id'] = (int) $creator->region_id;
            }
        }

        $role = RbacRole::query()->where('slug', $data['role_slug'])->firstOrFail();

        $user = User::query()->create([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'] ?? null,
            'password' => Hash::make($data['password']),
            'region_id' => $data['region_id'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);
        $user->roles()->sync([$role->id]);
        $user->load(['roles.permissions', 'region', 'department']);
        app(NotificationService::class)->notifyUserManaged(
            $user,
            $creator,
            'user.created',
            'User created',
            sprintf('%s created user %s.', $creator->name, $user->username)
        );

        return response()->json(['data' => $this->serialize($user)], 201);
    }

    public function update(Request $request, int $user): JsonResponse
    {
        $creator = $request->user();
        if (! $creator->hasRole('super_admin') && ! $creator->hasRole('federal_admin') && ! $creator->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = User::query()->find($user);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if ((int) $model->id === (int) $creator->id) {
            return response()->json(['message' => 'You cannot edit your own account from this screen.'], 422);
        }
        if ($model->roles()->where('slug', 'super_admin')->exists()) {
            return response()->json(['message' => 'Super administrator accounts cannot be edited here.'], 422);
        }

        if ($creator->hasRole('super_admin')) {
            if (! $model->roles()->whereIn('slug', ['federal_admin', 'regional_admin'])->exists()) {
                return response()->json(['message' => 'Only federal and regional administrator accounts can be managed here.'], 403);
            }
        } elseif ($creator->hasRole('federal_admin')) {
            if (! $model->department?->coversRegionSlug('ict')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } elseif ($creator->hasRole('regional_admin')) {
            $creatorSlug = Region::query()->whereKey($creator->region_id)->value('slug');
            if (! $model->department?->coversRegionSlug((string) $creatorSlug)) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'string', 'min:8'],
        ]);

        if (isset($data['email']) && $data['email'] !== null) {
            $exists = User::query()->where('email', $data['email'])->where('id', '!=', $model->id)->exists();
            if ($exists) {
                return response()->json(['message' => 'This email is already registered.'], 422);
            }
        }

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $wasActive = (bool) $model->is_active;
        $model->fill($data);
        $model->save();
        $model->load(['roles.permissions', 'region', 'department']);
        app(NotificationService::class)->notifyUserManaged(
            $model,
            $creator,
            ! $model->is_active && $wasActive ? 'user.deactivated' : 'user.updated',
            ! $model->is_active && $wasActive ? 'User deactivated' : 'User updated',
            ! $model->is_active && $wasActive
                ? sprintf('%s deactivated user %s.', $creator->name, $model->username)
                : sprintf('%s updated user %s.', $creator->name, $model->username)
        );

        return response()->json(['data' => $this->serialize($model)]);
    }

    public function destroy(Request $request, int $user): JsonResponse
    {
        if (! $request->user()->hasRole('super_admin') && ! $request->user()->hasRole('federal_admin') && ! $request->user()->hasRole('regional_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $model = User::query()->with(['roles', 'department'])->find($user);
        if (! $model) {
            return response()->json(['message' => 'Not found'], 404);
        }
        if ((int) $model->id === (int) $request->user()->id) {
            return response()->json(['message' => 'Cannot delete your own account'], 422);
        }

        if ($model->roles->contains('slug', 'super_admin')) {
            return response()->json(['message' => 'Super administrator accounts cannot be deleted.'], 422);
        }

        $creator = $request->user();
        if ($creator->hasRole('super_admin')) {
            if (! $model->roles()->whereIn('slug', ['federal_admin', 'regional_admin'])->exists()) {
                return response()->json(['message' => 'Only federal and regional administrator accounts can be managed here.'], 403);
            }
        } elseif ($creator->hasRole('federal_admin')) {
            if (! $model->department?->coversRegionSlug('ict')) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } elseif ($creator->hasRole('regional_admin')) {
            $creatorSlug = Region::query()->whereKey($creator->region_id)->value('slug');
            if (! $model->department?->coversRegionSlug((string) $creatorSlug)) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $username = $model->username;
        $model->delete();

        app(NotificationService::class)->notifyUserManaged(
            $model,
            $creator,
            'user.deleted',
            'User deleted',
            sprintf('%s deleted user %s.', $creator->name, $username)
        );

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'region' => $user->region ? [
                'id' => $user->region->id,
                'name' => $user->region->name,
                'slug' => $user->region->slug,
            ] : null,
            'department' => $user->department ? [
                'id' => $user->department->id,
                'name' => $user->department->name,
            ] : null,
            'roles' => $user->roles->map(fn ($role) => [
                'slug' => $role->slug,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('slug')->values()->all(),
            ]),
        ];
    }
}
