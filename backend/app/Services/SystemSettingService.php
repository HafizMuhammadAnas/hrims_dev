<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;

class SystemSettingService
{
    public const LOGIN_OTP_ENABLED = 'login_otp.enabled';

    private const CACHE_PREFIX = 'system_setting:';

    public function get(string $key, ?string $default = null): ?string
    {
        return Cache::remember(self::CACHE_PREFIX.$key, 3600, function () use ($key, $default) {
            $row = SystemSetting::query()->where('key', $key)->first();

            return $row?->value ?? $default;
        });
    }

    public function getBool(string $key, bool $default = false): bool
    {
        $raw = $this->get($key, $default ? '1' : '0');

        return in_array(strtolower((string) $raw), ['1', 'true', 'yes', 'on'], true);
    }

    public function set(string $key, ?string $value): void
    {
        SystemSetting::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value],
        );

        Cache::forget(self::CACHE_PREFIX.$key);
    }

    public function setBool(string $key, bool $value): void
    {
        $this->set($key, $value ? '1' : '0');
    }

    public function isLoginOtpEnabled(): bool
    {
        return $this->getBool(self::LOGIN_OTP_ENABLED, true);
    }

    public function setLoginOtpEnabled(bool $enabled): void
    {
        $this->setBool(self::LOGIN_OTP_ENABLED, $enabled);
    }
}
