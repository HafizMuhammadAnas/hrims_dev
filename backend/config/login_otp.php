<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Login email OTP
    |--------------------------------------------------------------------------
    |
    | Mandatory second factor after username/password for all users.
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
