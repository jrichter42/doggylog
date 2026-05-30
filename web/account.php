<?php
declare(strict_types=1);

$app = require __DIR__ . '/app/bootstrap.php';

\DoggyLog\Http::sendSecurityHeaders();

$config = $app['config'];
$appName = htmlspecialchars((string) $config['name'], ENT_QUOTES, 'UTF-8');
?>
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="color-scheme" content="dark">
    <title>Konto - <?= $appName ?></title>
    <link rel="stylesheet" href="assets/app.css">
  </head>
  <body>
    <header class="topbar">
      <div>
        <p class="eyebrow">Konto</p>
        <h1><?= $appName ?></h1>
      </div>
      <div class="session">
        <a class="button-link" href="./">Messen</a>
      </div>
    </header>

    <main>
      <p class="message" id="accountMessage" role="alert" hidden></p>

      <section class="account-card" id="accountPage" hidden>
        <section class="access-card">
          <div class="section-head">
            <h2>Zugang</h2>
            <button id="selfSetupButton" type="button">Setup-Link erstellen</button>
          </div>
          <p class="muted">Einmaliger Link fuer weiteren Passkey dieses Benutzers.</p>
          <p class="setup-link" id="selfSetupResult" hidden></p>
        </section>

        <section class="access-card">
          <div class="section-head">
            <h2>Hunde</h2>
          </div>
          <form class="inline-form" id="dogCreateForm">
            <input name="name" placeholder="Hundename" autocomplete="off" required>
            <button type="submit">Hund anlegen</button>
          </form>
          <div class="entries" id="dogList"></div>
        </section>
      </section>
    </main>

    <script type="module" src="assets/account.js"></script>
  </body>
</html>
