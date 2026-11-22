<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\LoginOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    private const PENDING_USER_KEY = 'pending_2fa_user_id';

    private const PENDING_REMEMBER_KEY = 'pending_2fa_remember';

    public function __construct(
        private readonly LoginOtpService $loginOtp,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        /** @var User|null $user */
        $user = User::query()->where('username', $credentials['username'])->first();
        if ($user === null || ! Hash::check($credentials['password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'username' => [__('auth.failed')],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'username' => [__('Your account is inactive.')],
            ]);
        }

        $this->loginOtp->assertUserCanReceiveOtp($user);

        // Ensure no authenticated session until OTP succeeds.
        Auth::guard('web')->logout();

        try {
            $issued = $this->loginOtp->issue($user);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            report($e);

            throw ValidationException::withMessages([
                'username' => [__('Could not send the verification email. Please try again or contact an administrator.')],
            ]);
        }

        $request->session()->regenerate();
        $request->session()->put(self::PENDING_USER_KEY, (int) $user->id);
        $request->session()->put(self::PENDING_REMEMBER_KEY, (bool) ($credentials['remember'] ?? false));

        return response()->json([
            'requires_2fa' => true,
            'message' => __('Enter the verification code sent to your email.'),
            'masked_email' => $issued['masked_email'],
            'resend_available_in' => $issued['resend_available_in'],
        ]);
    }

    public function verifyTwoFactor(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:32'],
        ]);

        $user = $this->pendingUser($request);
        if ($user === null) {
            throw ValidationException::withMessages([
                'code' => [__('Your sign-in session expired. Please sign in again.')],
            ]);
        }

        if (! $user->is_active) {
            $this->clearPending($request);
            throw ValidationException::withMessages([
                'code' => [__('Your account is inactive.')],
            ]);
        }

        try {
            $this->loginOtp->verify($user, $data['code']);
        } catch (ValidationException $e) {
            $messages = $e->errors();
            $codeMsg = $messages['code'][0] ?? '';
            if (str_contains($codeMsg, 'sign in again') || str_contains($codeMsg, 'expired') || str_contains($codeMsg, 'Too many')) {
                $this->clearPending($request);
            }
            throw $e;
        }

        $remember = (bool) $request->session()->get(self::PENDING_REMEMBER_KEY, false);
        $this->clearPending($request);

        Auth::login($user, $remember);
        $request->session()->regenerate();
        $this->storeSessionPasswordHash($request, $user);
        ActivityLogService::record('login', $user, $request);

        return response()->json([
            'data' => $this->userPayload($user->load(['roles.permissions', 'region', 'department'])),
        ]);
    }

    public function resendTwoFactor(Request $request): JsonResponse
    {
        $user = $this->pendingUser($request);
        if ($user === null) {
            throw ValidationException::withMessages([
                'code' => [__('Your sign-in session expired. Please sign in again.')],
            ]);
        }

        if (! $user->is_active) {
            $this->clearPending($request);
            throw ValidationException::withMessages([
                'code' => [__('Your account is inactive.')],
            ]);
        }

        try {
            $issued = $this->loginOtp->resend($user);
        } catch (ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            report($e);

            throw ValidationException::withMessages([
                'code' => [__('Could not send the verification email. Please try again or contact an administrator.')],
            ]);
        }

        return response()->json([
            'message' => __('A new verification code was sent.'),
            'masked_email' => $issued['masked_email'],
            'resend_available_in' => $issued['resend_available_in'],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = Auth::user();
        if ($user) {
            ActivityLogService::record('logout', $user, $request);
        }

        Auth::guard('web')->logout();
        $this->clearPending($request);

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

    private function pendingUser(Request $request): ?User
    {
        $id = $request->session()->get(self::PENDING_USER_KEY);
        if (! is_numeric($id)) {
            return null;
        }

        return User::query()->find((int) $id);
    }

    private function clearPending(Request $request): void
    {
        $request->session()->forget([self::PENDING_USER_KEY, self::PENDING_REMEMBER_KEY]);
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
