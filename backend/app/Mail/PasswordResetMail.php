<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable
{
    use SerializesModels;

    public function __construct(
        public User $recipient,
        public string $resetUrl,
        public int $expireMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'HRIMS password reset',
        );
    }

    public function content(): Content
    {
        $name = trim((string) $this->recipient->name);
        if ($name === '') {
            $name = 'Colleague';
        }

        return new Content(
            html: 'emails.password-reset',
            with: [
                'recipientName' => $name,
                'resetUrl' => $this->resetUrl,
                'expireMinutes' => $this->expireMinutes,
                'supportEmail' => (string) config('mail.support_email'),
            ],
        );
    }
}
