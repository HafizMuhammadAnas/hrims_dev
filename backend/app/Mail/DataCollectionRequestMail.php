<?php

namespace App\Mail;

use App\Models\HrRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DataCollectionRequestMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $recipient,
        public HrRequest $hrRequest,
        public string $actionUrl,
    ) {}

    public function envelope(): Envelope
    {
        $ref = (string) $this->hrRequest->id;

        return new Envelope(
            subject: 'Data Collection Request — '.$ref,
        );
    }

    public function content(): Content
    {
        $recipientLabel = trim((string) $this->recipient->name);
        if ($this->recipient->department?->name) {
            $recipientLabel = $recipientLabel !== ''
                ? $recipientLabel.' / '.$this->recipient->department->name
                : $this->recipient->department->name;
        }
        if ($recipientLabel === '') {
            $recipientLabel = 'Colleague';
        }

        $deadline = $this->hrRequest->due_date
            ? $this->hrRequest->due_date->format('d-m-Y')
            : '—';

        return new Content(
            html: 'emails.data-collection-request',
            with: [
                'recipientLabel' => $recipientLabel,
                'requestId' => (string) $this->hrRequest->id,
                'requestTitle' => (string) ($this->hrRequest->title ?: 'Data Collection Request'),
                'requestType' => (string) ($this->hrRequest->request_type ?: 'Data Collection'),
                'deadline' => $deadline,
                'status' => 'Pending Submission',
                'actionUrl' => $this->actionUrl,
                'supportEmail' => (string) config('mail.support_email'),
            ],
        );
    }
}
