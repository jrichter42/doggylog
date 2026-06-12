<?php
declare(strict_types=1);

use DoggyLog\Config;
use DoggyLog\AuthStore;
use DoggyLog\Http;
use DoggyLog\Mailer;
use DoggyLog\Storage;

define('DOGGYLOG_BASE_PATH', dirname(__DIR__));
define('DOGGYLOG_VERSION', '1.0.0');

spl_autoload_register(static function (string $class): void {
    $prefix = 'DoggyLog\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $path = __DIR__ . '/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($path)) {
        require $path;
    }
});

$config = Config::load(DOGGYLOG_BASE_PATH . '/config/app.json');

date_default_timezone_set('UTC');
error_reporting(E_ALL);
ini_set('display_errors', '0');

Http::enforceProductionSecurity($config);
Http::configureSession();

$storage = new Storage(DOGGYLOG_BASE_PATH);
$storage->ensureStructure();
$auth = new AuthStore(DOGGYLOG_BASE_PATH, $config);
$mailer = new Mailer($config);

return [
    'config' => $config,
    'storage' => $storage,
    'auth' => $auth,
    'mailer' => $mailer,
    'version' => DOGGYLOG_VERSION,
];
