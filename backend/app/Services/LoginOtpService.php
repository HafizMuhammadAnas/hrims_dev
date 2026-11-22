<?php

namespace App\Services;

use App\Mail\LoginOtpMail;
use App\Models\LoginOtp;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class LoginOtpService
{
    public function maskEmail(string $email): string
    {
        $email = trim($email);
        $parts = explode('@', $email, 2);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            return '***';
        }

        $local = $parts[0];
        $domain = $parts[1];
        $visible = mb_substr($local, 0, min(2, mb_strlen($local)));

        return $visible.'***@'.$domain;
    }

    public function assertUserCanReceiveOtp(User $user): void
    {
        $email = trim((string) $user->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages([
                'username' => [__('Your account has no valid email address. Contact an administrator.')],
            ]);
        }
    }

    /**
     * Invalidate previous codes, create a new OTP, and email it.
     *
     * @return array{otp: LoginOtp, masked_email: string, resend_available_in: int}
     */
    public function issue(User $user): array
    {
        $this->assertUserCanReceiveOtp($user);

        LoginOtp::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        $plain = $this->generateCode();
        $ttl = (int) config('login_otp.ttl_minutes', 30);

        $otp = LoginOtp::query()->create([
            'user_id' => $user->id,
            'code_hash' => Hash::make($plain),
            'expires_at' => now()->addMinutes($ttl),
            'attempts' => 0,
            'last_sent_at' => now(),
        ]);

        Mail::to($user->email)->send(new LoginOtpMail($user, $plain, $ttl));

        return [
            'otp' => $otp,
            'masked_email' => $this->maskEmail((string) $user->email),
            'resend_available_in' => (int) config('login_otp.resend_cooldown_seconds', 60),
        ];
    }

    /**
     * @return array{otp: LoginOtp, masked_email: string, resend_available_in: int}
     */
    public function resend(User $user): array
    {
        $this->assertUserCanReceiveOtp($user);

        $latest = LoginOtp::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->orderByDesc('id')
            ->first();

        $cooldown = (int) config('login_otp.resend_cooldown_seconds', 60);
        if ($latest && $latest->last_sent_at) {
            $wait = $cooldown - $latest->last_sent_at->diffInSeconds(now());
            if ($wait > 0) {
                throw ValidationException::withMessages([
                    'code' => [__('Please wait :seconds seconds before requesting a new code.', ['seconds' => $wait])],
                ]);
            }
        }

        return $this->issue($user);
    }

    public function verify(User $user, string $code): void
    {
        $otp = LoginOtp::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->orderByDesc('id')
            ->first();

        if ($otp === null) {
            throw ValidationException::withMessages([
                'code' => [__('No verification code is pending. Please sign in again.')],
            ]);
        }

        if ($otp->isExpired()) {
            $otp->forceFill(['consumed_at' => now()])->save();
            throw ValidationException::withMessages([
                'code' => [__('This verification code has expired. Please sign in again.')],
            ]);
        }

        $maxAttempts = (int) config('login_otp.max_attempts', 5);
        if ((int) $otp->attempts >= $maxAttempts) {
            $otp->forceFill(['consumed_at' => now()])->save();
            throw ValidationException::withMessages([
                'code' => [__('Too many incorrect attempts. Please sign in again.')],
            ]);
        }

        $normalized = preg_replace('/\s+/', '', trim($code)) ?? '';
        if ($normalized === '' || ! Hash::check($normalized, $otp->code_hash)) {
            $otp->increment('attempts');
            $otp->refresh();
            if ((int) $otp->attempts >= $maxAttempts) {
                $otp->forceFill(['consumed_at' => now()])->save();
                throw ValidationException::withMessages([
                    'code' => [__('Too many incorrect attempts. Please sign in again.')],
                ]);
            }

            throw ValidationException::withMessages([
                'code' => [__('Invalid verification code.')],
            ]);
        }

        $otp->forceFill(['consumed_at' => now()])->save();
    }

    private function generateCode(): string
    {
        $test = config('login_otp.test_code');
        if (app()->environment('testing') && is_string($test) && $test !== '') {
            $digits = preg_replace('/\D+/', '', $test) ?? '';
            $len = (int) config('login_otp.length', 6);

            return str_pad(substr($digits, 0, $len), $len, '0', STR_PAD_LEFT);
        }

        $len = (int) config('login_otp.length', 6);
        $max = (10 ** $len) - 1;

        return str_pad((string) random_int(0, $max), $len, '0', STR_PAD_LEFT);
    }
}
