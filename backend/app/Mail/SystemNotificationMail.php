<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SystemNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $recipient,
        public string $notificationTitle,
        public string $notificationMessage,
        public ?string $actionUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->notificationTitle,
        );
    }

    public function content(): Content
    {
        $name = trim((string) $this->recipient->name);
        if ($name === '') {
            $name = 'Colleague';
        }

        return new Content(
            html: 'emails.system-notification',
            with: [
                'recipientName' => $name,
                'notificationTitle' => $this->notificationTitle,
                'notificationMessage' => $this->notificationMessage,
                'actionUrl' => $this->actionUrl,
                'supportEmail' => (string) config('mail.support_email'),
            ],
        );
    }
}
