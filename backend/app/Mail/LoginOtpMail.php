<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LoginOtpMail extends Mailable
{
    use SerializesModels;

    public function __construct(
        public User $recipient,
        public string $otpCode,
        public int $ttlMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'HRIMS login verification code',
        );
    }

    public function content(): Content
    {
        $name = trim((string) $this->recipient->name);
        if ($name === '') {
            $name = 'Colleague';
        }

        return new Content(
            html: 'emails.login-otp',
            with: [
                'recipientName' => $name,
                'otpCode' => $this->otpCode,
                'ttlMinutes' => $this->ttlMinutes,
                'supportEmail' => (string) config('mail.support_email'),
            ],
        );
    }
}
