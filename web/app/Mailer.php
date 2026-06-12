<?php
declare(strict_types=1);

namespace DoggyLog;

final class Mailer
{
    private bool $enabled;
    private string $fromAddress;
    private string $fromName;
    private string $replyTo;
    private string $loginSubject;
    private string $timezone;
    private int $loginLinkTtlSeconds;

    /**
     * @param array<string, mixed> $config
     */
    public function __construct(array $config)
    {
        $mail = is_array($config['mail'] ?? null) ? $config['mail'] : [];
        $this->fromAddress = $this->cleanHeader((string) ($mail['from_address'] ?? ''));
        $this->fromName = $this->cleanHeader((string) ($mail['from_name'] ?? ($config['name'] ?? 'Doggy Log')));
        $this->replyTo = $this->cleanHeader((string) ($mail['reply_to'] ?? ''));
        $this->loginSubject = $this->cleanHeader((string) ($mail['login_subject'] ?? 'Login-Link für Doggy Log'));
        $this->timezone = is_string($config['timezone'] ?? null) ? $config['timezone'] : 'UTC';
        $auth = is_array($config['auth'] ?? null) ? $config['auth'] : [];
        $this->loginLinkTtlSeconds = is_numeric($auth['login_link_ttl_seconds'] ?? null)
            ? max(60, min(3600, (int) $auth['login_link_ttl_seconds']))
            : 600;
        $this->enabled = (bool) ($mail['enabled'] ?? false)
            && filter_var($this->fromAddress, FILTER_VALIDATE_EMAIL) !== false;
    }

    public function isLoginEnabled(): bool
    {
        return $this->enabled;
    }

    public function sendLoginLink(string $to, string $displayName, string $loginUrl, string $expiresAt): bool
    {
        if (!$this->enabled) {
            return false;
        }

        $to = $this->cleanHeader($to);
        if (filter_var($to, FILTER_VALIDATE_EMAIL) === false) {
            return false;
        }

        $name = trim($displayName) !== '' ? trim($displayName) : 'Benutzer';
        $expiresAtDisplay = $this->formatLoginExpiry($expiresAt);
        $expiresInDisplay = $this->formatLoginTtl();
        $body = implode("\n", [
            'Hallo ' . $name . ',',
            '',
            'hier ist dein Login-Link:',
            $loginUrl,
            '',
            'Der Link ist einmalig nutzbar und läuft in ' . $expiresInDisplay . ' ab:',
            $expiresAtDisplay,
            '',
            'Falls du keinen Login-Link angefordert hast, kannst du diese Mail ignorieren.',
        ]);

        $headers = [
            'From: ' . $this->mailbox($this->fromAddress, $this->fromName),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'X-Mailer: Doggy Log',
        ];
        if ($this->replyTo !== '' && filter_var($this->replyTo, FILTER_VALIDATE_EMAIL) !== false) {
            $headers[] = 'Reply-To: ' . $this->replyTo;
        }

        return mail(
            $to,
            $this->encodeHeader($this->loginSubject),
            $body,
            implode("\r\n", $headers)
        );
    }

    private function mailbox(string $address, string $name): string
    {
        if ($name === '') {
            return $address;
        }

        return $this->encodeHeader($name) . ' <' . $address . '>';
    }

    private function encodeHeader(string $value): string
    {
        if ($value === '') {
            return '';
        }

        if (preg_match('/^[\x20-\x7E]+$/', $value) === 1) {
            return $value;
        }

        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    private function cleanHeader(string $value): string
    {
        return trim(str_replace(["\r", "\n"], '', $value));
    }

    private function formatLoginExpiry(string $expiresAt): string
    {
        try {
            $date = new \DateTimeImmutable($expiresAt);
            $timezone = new \DateTimeZone($this->timezone);
        } catch (\Exception) {
            return $expiresAt;
        }

        return $date->setTimezone($timezone)->format('d.m.Y \u\m H:i \U\h\r') . ' (' . $timezone->getName() . ')';
    }

    private function formatLoginTtl(): string
    {
        if ($this->loginLinkTtlSeconds % 3600 === 0) {
            $hours = intdiv($this->loginLinkTtlSeconds, 3600);
            return $hours . ($hours === 1 ? ' Stunde' : ' Stunden');
        }

        if ($this->loginLinkTtlSeconds % 60 === 0) {
            $minutes = intdiv($this->loginLinkTtlSeconds, 60);
            return $minutes . ($minutes === 1 ? ' Minute' : ' Minuten');
        }

        return $this->loginLinkTtlSeconds . ($this->loginLinkTtlSeconds === 1 ? ' Sekunde' : ' Sekunden');
    }
}
