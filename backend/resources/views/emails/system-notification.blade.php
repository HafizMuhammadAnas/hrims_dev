@extends('emails.layouts.ministry')

@section('title', $notificationTitle)

@section('content')
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#173d69;">
        {{ strtoupper($notificationTitle) }}
    </p>

    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Dear {{ $recipientName }},
    </p>

    <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        {{ $notificationMessage }}
    </p>

    <table width="100%" cellpadding="8" cellspacing="0" border="1" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;border:1px solid #000000;margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        <tr>
            <td width="38%" bgcolor="#eaf0f7" style="width:38%;padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Notification</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $notificationTitle }}</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Details</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $notificationMessage }}</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Requested By</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">Ministry of Human Rights</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Status</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">Action Required</td>
        </tr>
    </table>

    @if ($actionUrl)
        <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#173d69;">
            Action Required
        </p>

        <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
            Please use the link below to access the data collection application:
        </p>

        <p style="margin:0 0 18px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;">
            <a href="{{ $actionUrl }}" style="color:#0000ff;font-weight:700;text-decoration:underline;font-size:15px;">[OPEN IN HRIMS]</a>
        </p>
    @endif

    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        For technical assistance or clarification, please contact
        <a href="mailto:{{ $supportEmail }}" style="color:#0000ff;text-decoration:underline;">{{ $supportEmail }}</a>.
    </p>
@endsection
