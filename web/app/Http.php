<?php
declare(strict_types=1);

namespace DoggyLog;

final class Http
{
    private const MAX_JSON_BODY_BYTES = 65536;

    /**
     * @param array<string, mixed> $config
     */
    public static function enforceProductionSecurity(array $config): void
    {
        $auth = is_array($config['auth'] ?? null) ? $config['auth'] : [];
        $origin = is_string($auth['origin'] ?? null) ? rtrim($auth['origin'], '/') : '';
        $allowedHosts = is_array($auth['allowed_hosts'] ?? null) ? $auth['allowed_hosts'] : [];
        $trustedProxies = is_array($auth['trusted_proxies'] ?? null) ? $auth['trusted_proxies'] : [];

        if ($origin === '' || parse_url($origin, PHP_URL_SCHEME) !== 'https' || $allowedHosts === []) {
            throw new \RuntimeException('Production auth origin and allowed hosts are not configured.');
        }

        $requestHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        if (preg_match('/^[a-z0-9.-]+(?::\d+)?$/D', $requestHost) !== 1) {
            self::rejectInvalidHost();
        }
        $host = preg_replace('/:\d+$/', '', $requestHost) ?: '';
        if (!in_array($host, $allowedHosts, true)) {
            self::rejectInvalidHost();
        }

        if (!self::isHttpsRequest($trustedProxies)) {
            $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
            if (preg_match('/[\r\n]/', $requestUri) === 1 || $requestUri === '' || $requestUri[0] !== '/' || strncmp($requestUri, '//', 2) === 0) {
                $requestUri = '/';
            }
            header('Location: ' . $origin . $requestUri, true, 301);
            exit;
        }
    }

    public static function configureSession(): void
    {
        if (session_status() !== PHP_SESSION_NONE) {
            return;
        }

        session_name('doggylog_session');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }

    public static function sendSecurityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: same-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        header('Strict-Transport-Security: max-age=31536000');
        header("Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'");
    }

    /**
     * @param array<int, mixed> $trustedProxies
     */
    private static function isHttpsRequest(array $trustedProxies): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off') {
            return true;
        }

        $remoteAddress = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        return in_array($remoteAddress, $trustedProxies, true)
            && strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    }

    private static function rejectInvalidHost(): void
    {
        http_response_code(400);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Invalid Host header';
        exit;
    }

    /**
     * @return array<string, mixed>
     */
    public static function readJsonBody(): array
    {
        $contentLength = filter_var($_SERVER['CONTENT_LENGTH'] ?? null, FILTER_VALIDATE_INT);
        if (is_int($contentLength) && $contentLength > self::MAX_JSON_BODY_BYTES) {
            self::json(['ok' => false, 'error' => 'Request body too large'], 413);
        }

        $raw = file_get_contents('php://input', false, null, 0, self::MAX_JSON_BODY_BYTES + 1);
        if ($raw === false || trim($raw) === '') {
            return [];
        }
        if (strlen($raw) > self::MAX_JSON_BODY_BYTES) {
            self::json(['ok' => false, 'error' => 'Request body too large'], 413);
        }

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            self::json(['ok' => false, 'error' => 'Invalid JSON body'], 400);
        }

        if (!is_array($decoded)) {
            self::json(['ok' => false, 'error' => 'JSON body must be an object'], 400);
        }

        return $decoded;
    }

    public static function requireMethod(string $method): void
    {
        if ($_SERVER['REQUEST_METHOD'] !== $method) {
            self::json(['ok' => false, 'error' => 'Method not allowed'], 405);
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
