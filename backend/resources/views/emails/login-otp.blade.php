@extends('emails.layouts.ministry')

@section('title', 'Login verification code')

@section('content')
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#173d69;">
        LOGIN VERIFICATION CODE
    </p>

    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Dear {{ $recipientName }},
    </p>

    <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Use the following one-time code to complete your sign-in to HRIMS. Do not share this code with anyone.
    </p>

    <p style="margin:0 0 20px 0;text-align:center;">
        <span style="display:inline-block;padding:14px 28px;font-family:Consolas,Monaco,monospace;font-size:28px;font-weight:700;letter-spacing:6px;color:#173d69;border:2px solid #173d69;background:#eaf0f7;">
            {{ $otpCode }}
        </span>
    </p>

    <table width="100%" cellpadding="8" cellspacing="0" border="1" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;border:1px solid #000000;margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        <tr>
            <td width="38%" bgcolor="#eaf0f7" style="width:38%;padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Valid for</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $ttlMinutes }} minutes</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Requested By</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">Ministry of Human Rights</td>
        </tr>
    </table>

    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">
        If you did not try to sign in, you can ignore this email. For help, contact
        <a href="mailto:{{ $supportEmail }}" style="color:#173d69;">{{ $supportEmail }}</a>.
    </p>
@endsection
