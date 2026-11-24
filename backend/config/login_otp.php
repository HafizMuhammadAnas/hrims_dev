<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Login email OTP
    |--------------------------------------------------------------------------
    |
    | Second factor after username/password. Super Admin always skips OTP.
    | All other users follow system_settings key login_otp.enabled (default on).
    |
    */

    'length' => 6,

    'ttl_minutes' => 30,

    'max_attempts' => 5,

    'resend_cooldown_seconds' => 60,

    /*
    | Fixed code used only when APP_ENV=testing (see phpunit.xml).
    | Leave null/empty in production.
    */
    'test_code' => env('LOGIN_OTP_TEST_CODE'),

];
