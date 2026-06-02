<?php
declare(strict_types=1);

$app = require __DIR__ . '/app/bootstrap.php';

\DoggyLog\Http::sendSecurityHeaders();

$config = $app['config'];
$version = htmlspecialchars((string) $app['version'], ENT_QUOTES, 'UTF-8');
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
      <div class="brand-line">
        <div class="brand-title">
          <h1><?= $appName ?> <a class="version-link" href="https://github.doggylog.kimvosen.de" target="_blank" rel="noopener noreferrer">v<?= $version ?></a></h1>
        </div>
        <p class="connection-status" id="connectionStatus" hidden></p>
      </div>
      <nav class="top-tabs" id="topTabs" aria-label="Hauptnavigation" hidden>
        <a class="top-tab" href="./#measure" data-icon="activity">Messung</a>
        <a class="top-tab" href="./#records" data-icon="history">Verlauf</a>
        <a class="top-tab is-active" href="account.php" data-icon="user">Konto</a>
      </nav>
    </header>

    <main>
      <p class="message" id="accountMessage" role="alert" hidden></p>

      <section class="account-card" id="accountPage" hidden>
        <section class="access-card">
          <div class="section-head">
            <h2>Zugang</h2>
            <div class="section-actions">
              <button id="selfSetupButton" type="button" data-icon="key">Setup-Link erstellen</button>
              <button class="delete-entry" id="logoutButton" type="button" data-icon="logOut">Logout</button>
            </div>
          </div>
          <p class="muted">Einmaliger Link für weiteren Passkey dieses Benutzers.</p>
          <p class="setup-link" id="selfSetupResult" hidden></p>
        </section>

        <section class="access-card">
          <div class="section-head">
            <h2>Hunde</h2>
          </div>
          <form class="inline-form" id="dogCreateForm">
            <input name="name" placeholder="Hundename" autocomplete="off" required>
            <button type="submit" data-icon="plus">Hund anlegen</button>
          </form>
          <div class="entries" id="dogList"></div>
        </section>

        <section class="admin" id="adminPanel" hidden>
          <div class="section-head">
            <h2>Benutzer</h2>
          </div>
          <form id="createUserForm" class="inline-form user-create-form">
            <input name="username" placeholder="Benutzername" autocomplete="off" required>
            <input name="display_name" placeholder="Anzeigename" autocomplete="name">
            <label class="checkbox-line">
              <input name="manage_users" type="checkbox" value="1">
              Benutzerverwaltung
            </label>
            <button type="submit" data-icon="key">Setup-Link erstellen</button>
          </form>
          <p class="setup-link" id="setupResult" hidden></p>
          <div id="userList" class="user-list"></div>
        </section>
      </section>
    </main>

    <script src="assets/icons.js"></script>
    <script type="module" src="assets/account.js"></script>
  </body>
</html>
