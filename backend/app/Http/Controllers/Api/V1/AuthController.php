<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        if (! Auth::attempt([
            'username' => $credentials['username'],
            'password' => $credentials['password'],
        ], $credentials['remember'] ?? false)) {
            throw ValidationException::withMessages([
                'username' => [__('auth.failed')],
            ]);
        }

        /** @var User $user */
        $user = Auth::user();
        if (! $user->is_active) {
            Auth::logout();

            throw ValidationException::withMessages([
                'username' => [__('Your account is inactive.')],
            ]);
        }

        $request->session()->regenerate();
        $this->storeSessionPasswordHash($request, $user);

        return response()->json([
            'data' => $this->userPayload($user->load(['roles.permissions', 'region', 'department'])),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out']);
    }

    /**
     * Guest password reset without email: user sets a new password on this screen.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'exists:users,username'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'username.required' => __('Username is required.'),
            'username.exists' => __('No account was found for that username.'),
            'password.required' => __('Choose a new password.'),
            'password.min' => __('Password must be at least 8 characters.'),
            'password.confirmed' => __('Password confirmation does not match.'),
        ]);

        /** @var User $user */
        $user = User::query()->where('username', $data['username'])->firstOrFail();

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'username' => [__('Your account is inactive.')],
            ]);
        }

        $user->forceFill([
            'password' => $data['password'],
        ])->save();

        return response()->json([
            'message' => __('Your password has been updated. You can sign in.'),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'data' => $this->userPayload($user->load(['roles.permissions', 'region', 'department'])),
        ]);
    }

    private function storeSessionPasswordHash(Request $request, User $user): void
    {
        $guard = Auth::guard('web');
        $hash = $user->getAuthPassword();
        if ($hash === null || $hash === '') {
            return;
        }
        if (method_exists($guard, 'hashPasswordForCookie')) {
            $hash = $guard->hashPasswordForCookie($hash);
        }
        $request->session()->put('password_hash_web', $hash);
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'is_active' => $user->is_active,
            'created_at' => optional($user->created_at)?->toIso8601String(),
            'updated_at' => optional($user->updated_at)?->toIso8601String(),
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
