@extends('emails.layouts.ministry')

@section('title', 'Data Collection Request – '.$requestId)

@section('content')
    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#173d69;">
        DATA COLLECTION REQUEST
    </p>

    <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Request Reference:
        <span style="color:#173d69;font-weight:700;">{{ $requestId }}</span>
    </p>

    <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        <strong>Subject:</strong> Data Collection Request – {{ $requestId }}
    </p>

    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Dear {{ $recipientLabel }},
    </p>

    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        The Ministry of Human Rights, Government of Pakistan, requests your cooperation in providing the required data through the designated data collection system.
    </p>

    <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Please review the request details below and submit the requested information within the specified deadline.
    </p>

    {{-- Exact template table: gray label column + white value column, black borders --}}
    <table width="100%" cellpadding="8" cellspacing="0" border="1" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;border:1px solid #000000;margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        <tr>
            <td width="38%" bgcolor="#eaf0f7" style="width:38%;padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Request ID</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $requestId }}</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Request Type</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $requestType }}</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Requested By</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">Ministry of Human Rights</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Submission Deadline</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $deadline }}</td>
        </tr>
        <tr>
            <td bgcolor="#eaf0f7" style="padding:10px 12px;border:1px solid #000000;background-color:#eaf0f7;font-weight:700;color:#000000;">Status</td>
            <td bgcolor="#ffffff" style="padding:10px 12px;border:1px solid #000000;background-color:#ffffff;color:#000000;">{{ $status }}</td>
        </tr>
    </table>

    <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#173d69;">
        Action Required
    </p>

    <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Please use the link below to access the data collection application and submit the required information:
    </p>

    <p style="margin:0 0 18px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;">
        <a href="{{ $actionUrl }}" style="color:#0000ff;font-weight:700;text-decoration:underline;font-size:15px;">[SUBMIT REQUESTED DATA]</a>
    </p>

    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        Kindly ensure that all information is accurate, complete, and submitted before the deadline. Please mention request reference
        <a href="{{ $actionUrl }}" style="color:#0000ff;font-weight:700;text-decoration:underline;">{{ $requestId }}</a>
        in any correspondence regarding this request.
    </p>

    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#000000;">
        For technical assistance or clarification, please contact
        <a href="mailto:{{ $supportEmail }}" style="color:#0000ff;text-decoration:underline;">{{ $supportEmail }}</a>.
    </p>
@endsection
