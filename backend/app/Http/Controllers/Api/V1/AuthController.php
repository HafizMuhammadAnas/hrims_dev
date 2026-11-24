<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetMail;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\LoginOtpService;
use App\Services\SystemSettingService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    private const PENDING_USER_KEY = 'pending_2fa_user_id';

    private const PENDING_REMEMBER_KEY = 'pending_2fa_remember';

    public function __construct(
        private readonly LoginOtpService $loginOtp,
        private readonly SystemSettingService $settings,
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

        $remember = (bool) ($credentials['remember'] ?? false);

        // Super Admin never requires email OTP. Global toggle can also disable OTP for everyone.
        if ($user->hasRole('super_admin') || ! $this->settings->isLoginOtpEnabled()) {
            return $this->completeLogin($request, $user, $remember);
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
        $request->session()->put(self::PENDING_REMEMBER_KEY, $remember);

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

        return $this->completeLogin($request, $user, $remember);
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
     * Send a password-reset link only when username + email both match the same account.
     * The link is always mailed to that account's registered email (never to a mismatched address).
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
        ], [
            'username.required' => __('Username is required.'),
            'email.required' => __('Email is required.'),
            'email.email' => __('Enter a valid email address.'),
        ]);

        $username = trim($data['username']);
        $email = Str::lower(trim($data['email']));

        /** @var User|null $user */
        $user = User::query()->where('username', $username)->first();

        if ($user === null) {
            throw ValidationException::withMessages([
                'username' => [__('No account was found for that username.')],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'username' => [__('Your account is inactive.')],
            ]);
        }

        $accountEmail = Str::lower(trim((string) $user->email));
        if ($accountEmail === '' || ! filter_var((string) $user->email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages([
                'email' => [__('This account has no valid email address. Contact an administrator.')],
            ]);
        }

        if ($accountEmail !== $email) {
            throw ValidationException::withMessages([
                'email' => [__('This email does not match the account for that username.')],
            ]);
        }

        try {
            Password::broker()->sendResetLink(
                ['email' => $user->email],
                function (User $user, string $token): void {
                    $frontend = rtrim((string) (config('app.frontend_url') ?: config('app.url')), '/');
                    $expire = (int) config('auth.passwords.users.expire', 60);
                    $url = $frontend.'/reset-password?'.http_build_query([
                        'token' => $token,
                        'email' => $user->email,
                    ]);

                    Mail::to($user->email)->send(new PasswordResetMail($user, $url, $expire));
                }
            );
        } catch (Throwable $e) {
            report($e);

            throw ValidationException::withMessages([
                'email' => [__('Could not send the reset email. Please try again or contact an administrator.')],
            ]);
        }

        return response()->json([
            'message' => __('A password reset link has been sent to the email registered for this account.'),
        ]);
    }

    /**
     * Complete password reset using the emailed token.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'token.required' => __('Reset link is invalid or incomplete.'),
            'email.required' => __('Email is required.'),
            'email.email' => __('Enter a valid email address.'),
            'password.required' => __('Choose a new password.'),
            'password.min' => __('Password must be at least 8 characters.'),
            'password.confirmed' => __('Password confirmation does not match.'),
        ]);

        $status = Password::broker()->reset(
            [
                'email' => $data['email'],
                'password' => $data['password'],
                'password_confirmation' => $data['password_confirmation'] ?? $request->input('password_confirmation'),
                'token' => $data['token'],
            ],
            function (User $user, string $password): void {
                if (! $user->is_active) {
                    throw ValidationException::withMessages([
                        'email' => [__('Your account is inactive.')],
                    ]);
                }

                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

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

    private function completeLogin(Request $request, User $user, bool $remember): JsonResponse
    {
        $this->clearPending($request);

        Auth::login($user, $remember);
        $request->session()->regenerate();
        $this->storeSessionPasswordHash($request, $user);
        ActivityLogService::record('login', $user, $request);

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
