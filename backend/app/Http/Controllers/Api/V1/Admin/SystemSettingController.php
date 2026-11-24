<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\SystemSettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemSettingController extends Controller
{
    public function __construct(
        private readonly SystemSettingService $settings,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => [
                'login_otp_enabled' => $this->settings->isLoginOtpEnabled(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'login_otp_enabled' => ['required', 'boolean'],
        ]);

        $this->settings->setLoginOtpEnabled((bool) $data['login_otp_enabled']);

        return response()->json([
            'data' => [
                'login_otp_enabled' => $this->settings->isLoginOtpEnabled(),
            ],
            'message' => __('Login OTP settings updated.'),
        ]);
    }
}
