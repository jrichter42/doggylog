<?php
declare(strict_types=1);

use DoggyLog\AuthStore;
use DoggyLog\Http;
use DoggyLog\StorageConflictException;
use DoggyLog\WebAuthn;

$app = require __DIR__ . '/app/bootstrap.php';

Http::sendSecurityHeaders();

$storage = $app['storage'];
$config = $app['config'];
$auth = $app['auth'];
$mailer = $app['mailer'];
$webauthn = WebAuthn::fromRequest($config);
$version = $app['version'];
$action = $_GET['action'] ?? 'status';

/**
 * @return array<string, mixed>
 */
function require_user(AuthStore $auth): array
{
    $user = $auth->currentUser();
    if ($user === null) {
        Http::json(['ok' => false, 'error' => 'Authentication required'], 401);
    }

    return $user;
}

/**
 * @return array<string, mixed>
 */
function require_permission(AuthStore $auth, string $permission): array
{
    $user = require_user($auth);
    $permissions = is_array($user['permissions'] ?? null) ? $user['permissions'] : [];
    if (!in_array($permission, $permissions, true)) {
        Http::json(['ok' => false, 'error' => 'Permission denied'], 403);
    }

    return $user;
}

/**
 * @param array<string, mixed> $user
 */
function data_username(array $user): string
{
    $username = trim((string) ($user['username'] ?? ''));
    if ($username !== '') {
        return $username;
    }

    $displayName = trim((string) ($user['display_name'] ?? ''));
    return $displayName;
}

/**
 * @param array<string, mixed> $body
 * @param array<string, mixed> $user
 */
function edit_source(array $body, array $user): string
{
    $source = trim((string) ($body['source'] ?? ''));
    return $source !== '' ? $source : data_username($user);
}

/**
 * @param array<string, mixed> $body
 */
function require_csrf(AuthStore $auth, array $body): void
{
    require_user($auth);
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($body['csrf'] ?? null);
    try {
        $auth->assertCsrf(is_string($token) ? $token : null);
    } catch (InvalidArgumentException $exception) {
        Http::json(['ok' => false, 'error' => 'Invalid CSRF token'], 403);
    }
}

/**
 * @param array<string, mixed> $payload
 */
function email_login_json(float $startedAt, array $payload, int $status = 200): void
{
    $targetMicros = 1250000 + random_int(0, 500000);
    $elapsedMicros = (int) ((microtime(true) - $startedAt) * 1000000);
    $remainingMicros = $targetMicros - $elapsedMicros;
    if ($remainingMicros > 0) {
        usleep($remainingMicros);
    }

    Http::json($payload, $status);
}

try {
    switch ($action) {
        case 'status':
            Http::requireMethod('GET');
            $authStatus = $auth->status();
            $includeCounts = ($_GET['counts'] ?? '1') !== '0';
            $currentUser = is_array($authStatus['user'] ?? null) ? $authStatus['user'] : null;
            $username = $currentUser !== null ? (string) ($currentUser['username'] ?? '') : null;
            Http::json([
                'ok' => true,
                'app' => [
                    'name' => $config['name'],
                    'version' => $version,
                    'timezone' => $config['timezone'],
                    'show_warnings' => $config['show_warnings'],
                    'warnings' => $config['warnings'] !== [] ? $config['warnings'] : null,
                ],
                'auth' => $authStatus,
                'mail' => [
                    'login_enabled' => $mailer->isLoginEnabled(),
                ],
                'webauthn' => $webauthn->publicContext(),
                'storage' => $storage->status($includeCounts && $username !== null, $username),
            ]);
            break;

        case 'objects':
            Http::requireMethod('GET');
            $user = require_user($auth);
            $type = (string) ($_GET['type'] ?? '');
            $objects = $storage->listObjects($type, (string) $user['username']);
            Http::json([
                'ok' => true,
                'type' => $type,
                'objects' => $objects,
            ]);
            break;

        case 'object-changes':
            Http::requireMethod('GET');
            $user = require_user($auth);
            Http::json([
                'ok' => true,
                'changes' => $storage->recentChanges((string) $user['username']),
            ]);
            break;

        case 'object':
            Http::requireMethod('GET');
            $user = require_user($auth);
            $type = (string) ($_GET['type'] ?? '');
            $id = (string) ($_GET['id'] ?? '');
            $object = $storage->readObject($type, $id, (string) $user['username']);
            Http::json([
                'ok' => true,
                'type' => $type,
                'object' => $object,
            ]);
            break;

        case 'object-schema':
            Http::requireMethod('GET');
            require_user($auth);
            Http::json([
                'ok' => true,
                'schemas' => $storage->schemas(),
            ]);
            break;

        case 'object-create':
            Http::requireMethod('POST');
            $editor = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $type = (string) ($body['type'] ?? '');
            $payload = is_array($body['object'] ?? null) ? $body['object'] : [];
            Http::json([
                'ok' => true,
                'type' => $type,
                'object' => $storage->createObject($type, $payload, (string) $editor['username'], edit_source($body, $editor)),
            ]);
            break;

        case 'object-update':
            Http::requireMethod('POST');
            $editor = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $type = (string) ($body['type'] ?? '');
            $id = (string) ($body['id'] ?? '');
            $payload = is_array($body['object'] ?? null) ? $body['object'] : (is_array($body['patch'] ?? null) ? $body['patch'] : []);
            $baseRevision = (int) ($body['base_revision'] ?? 0);
            $initialWrite = ($body['initial_revision'] ?? false) === true;
            $storage->readObject($type, $id, (string) $editor['username']);
            Http::json([
                'ok' => true,
                'type' => $type,
                'object' => $storage->updateObject($type, $id, $baseRevision, $payload, (string) $editor['username'], edit_source($body, $editor), $initialWrite),
            ]);
            break;

        case 'object-delete':
            Http::requireMethod('POST');
            $editor = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $type = (string) ($body['type'] ?? '');
            $id = (string) ($body['id'] ?? '');
            $baseRevision = (int) ($body['base_revision'] ?? 0);
            $storage->readObject($type, $id, (string) $editor['username']);
            Http::json([
                'ok' => true,
                'type' => $type,
                'object' => $storage->deleteObject($type, $id, $baseRevision, (string) $editor['username'], edit_source($body, $editor)),
            ]);
            break;

        case 'auth-login-options':
            Http::requireMethod('POST');
            $challenge = $auth->createChallenge('login', [], 300);
            Http::json([
                'ok' => true,
                'challenge_id' => $challenge['id'],
                'publicKey' => $webauthn->authenticationOptions($challenge['challenge']),
            ]);
            break;

        case 'auth-login-verify':
            Http::requireMethod('POST');
            $body = Http::readJsonBody();
            $challengeId = (string) ($body['challenge_id'] ?? '');
            $credential = $body['credential'] ?? null;
            if ($challengeId === '' || !is_array($credential)) {
                Http::json(['ok' => false, 'error' => 'Missing login response'], 400);
            }

            $challenge = $auth->consumeChallengeById('login', $challengeId);
            $credentialId = (string) ($credential['id'] ?? $credential['rawId'] ?? '');
            $stored = $auth->findCredential($credentialId);
            if (!($stored['user']['enabled'] ?? false)) {
                Http::json(['ok' => false, 'error' => 'User is disabled'], 403);
            }

            $verified = $webauthn->verifyAuthentication($credential, (string) $challenge['challenge'], $stored['credential']);
            $auth->updateCredentialAfterLogin((string) $stored['user']['username'], (string) $verified['credential_id'], (int) $verified['sign_count']);
            $user = $auth->loginUser((string) $stored['user']['username']);
            Http::json(['ok' => true, 'user' => $user, 'csrf' => $auth->csrfToken()]);
            break;

        case 'auth-email-login-request':
            $emailLoginStartedAt = microtime(true);
            Http::requireMethod('POST');
            $body = Http::readJsonBody();
            if (!$mailer->isLoginEnabled()) {
                Http::json(['ok' => false, 'error' => 'Email login is not configured.'], 400);
            }

            $email = trim((string) ($body['email'] ?? ''));
            if ($email === '') {
                Http::json(['ok' => false, 'error' => 'Email address is required.'], 400);
            }

            $link = $auth->createEmailLoginLink($email);
            if ($link !== null && ($link['created'] ?? false) === true) {
                $sent = $mailer->sendLoginLink(
                    (string) ($link['email'] ?? $email),
                    (string) (($link['user']['display_name'] ?? '') ?: ($link['user']['username'] ?? '')),
                    (string) ($link['login_url'] ?? ''),
                    (string) ($link['expires_at'] ?? '')
                );
                if (!$sent) {
                    $auth->revokeEmailLoginLink((string) ($link['id'] ?? ''), 'mail_failed');
                    error_log('Login email could not be sent.');
                }
            }

            email_login_json($emailLoginStartedAt, [
                'ok' => true,
                'message' => 'If the email address is registered, a login link was sent.',
            ]);
            break;

        case 'auth-email-login-verify':
            Http::requireMethod('POST');
            $body = Http::readJsonBody();
            $token = (string) ($body['token'] ?? $body['login'] ?? '');
            $user = $auth->consumeEmailLoginToken($token);
            Http::json(['ok' => true, 'user' => $user, 'csrf' => $auth->csrfToken()]);
            break;

        case 'auth-register-options':
            Http::requireMethod('POST');
            $body = Http::readJsonBody();
            $setupInput = (string) ($body['setup'] ?? $body['token'] ?? '');
            $resolved = $auth->resolveSetupToken($setupInput);
            $user = $resolved['user'];

            $challenge = $auth->createChallenge('register', [
                'setup_token_id' => (string) $resolved['token']['id'],
                'username' => (string) $user['username'],
            ], 300);

            Http::json([
                'ok' => true,
                'challenge_id' => $challenge['id'],
                'publicKey' => $webauthn->registrationOptions($challenge['challenge'], $user, $user['credentials'] ?? []),
            ]);
            break;

        case 'auth-register-verify':
            Http::requireMethod('POST');
            $body = Http::readJsonBody();
            $setupInput = (string) ($body['setup'] ?? $body['token'] ?? '');
            $challengeId = (string) ($body['challenge_id'] ?? '');
            $credential = $body['credential'] ?? null;
            if ($setupInput === '' || $challengeId === '' || !is_array($credential)) {
                Http::json(['ok' => false, 'error' => 'Missing registration response'], 400);
            }

            $resolved = $auth->resolveSetupToken($setupInput);
            $challenge = $auth->consumeChallengeById('register', $challengeId);
            $context = is_array($challenge['context'] ?? null) ? $challenge['context'] : [];
            if (($context['setup_token_id'] ?? '') !== ($resolved['token']['id'] ?? '')
                || ($context['username'] ?? '') !== ($resolved['user']['username'] ?? '')) {
                Http::json(['ok' => false, 'error' => 'Registration challenge did not match setup token'], 400);
            }

            $storedCredential = $webauthn->verifyRegistration($credential, (string) $challenge['challenge']);
            $auth->addCredential((string) $resolved['user']['username'], $storedCredential);
            $auth->consumeSetupToken((string) $resolved['token']['id']);
            $user = $auth->loginUser((string) $resolved['user']['username']);
            Http::json(['ok' => true, 'user' => $user, 'csrf' => $auth->csrfToken()]);
            break;

        case 'auth-logout':
            Http::requireMethod('POST');
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $auth->logout();
            Http::json(['ok' => true]);
            break;

        case 'account':
            Http::requireMethod('GET');
            $user = require_user($auth);
            Http::json(['ok' => true, 'account' => $auth->account((string) $user['username'])]);
            break;

        case 'account-update':
            Http::requireMethod('POST');
            $user = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $updated = $auth->updateAccount((string) $user['username'], $body);
            Http::json([
                'ok' => true,
                'user' => $updated,
                'account' => $auth->account((string) $updated['username']),
            ]);
            break;

        case 'account-passkey-options':
            Http::requireMethod('POST');
            $user = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $registrationUser = $auth->userForPasskeyRegistration((string) $user['username']);
            $challenge = $auth->createChallenge('account-register', [
                'username' => (string) $registrationUser['username'],
            ], 300);
            Http::json([
                'ok' => true,
                'challenge_id' => $challenge['id'],
                'publicKey' => $webauthn->registrationOptions(
                    $challenge['challenge'],
                    $registrationUser,
                    is_array($registrationUser['credentials'] ?? null) ? $registrationUser['credentials'] : []
                ),
            ]);
            break;

        case 'account-passkey-verify':
            Http::requireMethod('POST');
            $user = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $challengeId = (string) ($body['challenge_id'] ?? '');
            $credential = $body['credential'] ?? null;
            if ($challengeId === '' || !is_array($credential)) {
                Http::json(['ok' => false, 'error' => 'Missing registration response'], 400);
            }

            $challenge = $auth->consumeChallengeById('account-register', $challengeId);
            $context = is_array($challenge['context'] ?? null) ? $challenge['context'] : [];
            if (($context['username'] ?? '') !== ($user['username'] ?? '')) {
                Http::json(['ok' => false, 'error' => 'Registration challenge did not match user'], 400);
            }

            $storedCredential = $webauthn->verifyRegistration($credential, (string) $challenge['challenge']);
            $auth->addCredential((string) $user['username'], $storedCredential);
            Http::json(['ok' => true, 'account' => $auth->account((string) $user['username'])]);
            break;

        case 'account-delete-passkey':
            Http::requireMethod('POST');
            $user = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $credentialId = (string) ($body['credential_id'] ?? '');
            $auth->deleteCredential((string) $user['username'], $credentialId);
            Http::json(['ok' => true, 'account' => $auth->account((string) $user['username'])]);
            break;

        case 'account-create-setup-token':
            Http::requireMethod('POST');
            $user = require_user($auth);
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $setup = $auth->createSetupToken((string) $user['username'], (string) $user['username']);
            Http::json(['ok' => true, 'setup' => $setup]);
            break;

        case 'admin-users':
            Http::requireMethod('GET');
            require_permission($auth, 'manage_users');
            Http::json([
                'ok' => true,
                'permissions' => AuthStore::PERMISSIONS,
                'users' => $auth->listUsers(),
                'setup_tokens' => $auth->listSetupTokens(),
            ]);
            break;

        case 'admin-audit':
            Http::requireMethod('GET');
            require_permission($auth, 'manage_users');
            Http::json([
                'ok' => true,
                'audit' => $auth->listAuditLog(),
            ]);
            break;

        case 'admin-create-user':
            Http::requireMethod('POST');
            $admin = require_permission($auth, 'manage_users');
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $username = trim((string) ($body['username'] ?? ''));
            if ($username === '') {
                Http::json(['ok' => false, 'error' => 'Username is required'], 400);
            }

            $permissions = is_array($body['permissions'] ?? null) ? $body['permissions'] : [];
            $user = $auth->createUser(
                $username,
                (string) ($body['display_name'] ?? ''),
                $permissions,
                (string) $admin['username']
            );
            $setup = $auth->createSetupToken((string) $user['username'], (string) $admin['username']);
            Http::json(['ok' => true, 'user' => $user, 'setup' => $setup]);
            break;

        case 'admin-update-user':
            Http::requireMethod('POST');
            $admin = require_permission($auth, 'manage_users');
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $username = (string) ($body['username'] ?? '');
            if ($username === '') {
                Http::json(['ok' => false, 'error' => 'Username is required'], 400);
            }

            $user = $auth->updateUser($username, $body, (string) $admin['username'], true, true);
            Http::json(['ok' => true, 'user' => $user]);
            break;

        case 'admin-delete-user':
            Http::requireMethod('POST');
            $admin = require_permission($auth, 'manage_users');
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $username = (string) ($body['username'] ?? '');
            if ($username === '') {
                Http::json(['ok' => false, 'error' => 'Username is required'], 400);
            }

            $auth->deleteUser($username, (string) $admin['username']);
            Http::json([
                'ok' => true,
                'users' => $auth->listUsers(),
                'setup_tokens' => $auth->listSetupTokens(),
            ]);
            break;

        case 'admin-create-setup-token':
            Http::requireMethod('POST');
            $admin = require_permission($auth, 'manage_users');
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $username = (string) ($body['username'] ?? '');
            if ($username === '') {
                Http::json(['ok' => false, 'error' => 'Username is required'], 400);
            }

            $setup = $auth->createSetupToken($username, (string) $admin['username']);
            Http::json(['ok' => true, 'setup' => $setup]);
            break;

        case 'admin-delete-setup-token':
            Http::requireMethod('POST');
            $admin = require_permission($auth, 'manage_users');
            $body = Http::readJsonBody();
            require_csrf($auth, $body);
            $tokenId = (string) ($body['token_id'] ?? '');
            if ($tokenId === '') {
                Http::json(['ok' => false, 'error' => 'Setup token ID is required'], 400);
            }

            $auth->deleteSetupToken($tokenId, (string) $admin['username']);
            Http::json(['ok' => true, 'setup_tokens' => $auth->listSetupTokens()]);
            break;

        default:
            Http::json(['ok' => false, 'error' => 'Unknown action'], 404);
    }
} catch (StorageConflictException $exception) {
    Http::json([
        'ok' => false,
        'error' => $exception->getMessage(),
        'conflict' => true,
        'current' => $exception->currentObject(),
    ], 409);
} catch (InvalidArgumentException $exception) {
    Http::json(['ok' => false, 'error' => $exception->getMessage()], 400);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    Http::json(['ok' => false, 'error' => 'Internal server error'], 500);
}
