@extends('emails.layouts.ministry')

@section('title', 'Password reset')

@section('content')
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#173d69;">
        PASSWORD RESET
    </p>

    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Dear {{ $recipientName }},
    </p>

    <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        We received a request to reset your HRIMS password. Click the button below to choose a new password.
    </p>

    <p style="margin:0 0 20px 0;text-align:center;">
        <a href="{{ $resetUrl }}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;background-color:#173d69;text-decoration:none;border-radius:4px;">
            Reset password
        </a>
    </p>

    <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;word-break:break-all;">
        Or paste this link into your browser:<br>
        <a href="{{ $resetUrl }}" style="color:#173d69;">{{ $resetUrl }}</a>
    </p>

    <table width="100%" cellpadding="8" cellspacing="0" border="1" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;border:1px solid #000000;margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        <tr>
            <td width="38%" bgcolor="#eaf0f7" style="width:38%;padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Valid for</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $expireMinutes }} minutes</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Requested By</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">Ministry of Human Rights</td>
        </tr>
    </table>

    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">
        If you did not request a password reset, you can ignore this email. For help, contact
        <a href="mailto:{{ $supportEmail }}" style="color:#173d69;">{{ $supportEmail }}</a>.
    </p>
@endsection
