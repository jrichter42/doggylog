<?php
declare(strict_types=1);

$app = require __DIR__ . '/app/bootstrap.php';

\DoggyLog\Http::sendSecurityHeaders();

$config = $app['config'];
$version = htmlspecialchars((string) $app['version'], ENT_QUOTES, 'UTF-8');
$appName = htmlspecialchars((string) $config['name'], ENT_QUOTES, 'UTF-8');
$configWarnings = array_map(
    static fn (string $warning): string => htmlspecialchars($warning, ENT_QUOTES, 'UTF-8'),
    $config['show_warnings'] ? ($config['warnings'] ?? []) : []
);
?>
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title><?= $appName ?></title>
    <link rel="stylesheet" href="assets/app.css">
  </head>
  <body>
    <header class="topbar">
      <div>
        <p class="eyebrow">Vitalzeichen-Logbuch</p>
        <h1><?= $appName ?></h1>
      </div>
      <div class="session">
        <span id="connectionStatus">Laedt...</span>
        <button id="loginButton" type="button" hidden>Login</button>
        <button id="logoutButton" type="button" hidden>Logout</button>
      </div>
    </header>

    <?php if ($configWarnings !== []): ?>
      <aside class="notice" role="alert">
        <strong>Config</strong>
        <?php foreach ($configWarnings as $warning): ?>
          <span><?= $warning ?></span>
        <?php endforeach; ?>
      </aside>
    <?php endif; ?>

    <main>
      <section class="auth-card" id="authScreen" hidden>
        <div id="loginPanel">
          <h2>Einloggen</h2>
          <p>Doggy Log nutzt Passkeys. Optional kann ein Login-Link per E-Mail aktiviert werden.</p>
          <button class="primary" id="passkeyLoginButton" type="button">Mit Passkey einloggen</button>
          <form id="loginEmailForm" hidden>
            <label>
              E-Mail
              <input id="loginEmailInput" name="email" type="email" autocomplete="email">
            </label>
            <button type="submit">Login-Link senden</button>
            <p id="loginEmailState" class="muted" hidden></p>
          </form>
        </div>

        <form id="setupForm" hidden>
          <h2>Passkey einrichten</h2>
          <p>Dieser einmalige Setup-Link erstellt den ersten Zugang.</p>
          <input id="setupInput" name="setup" type="hidden">
          <button class="primary" type="submit">Passkey erstellen</button>
        </form>
      </section>

      <p class="message" id="authMessage" role="alert" hidden></p>

      <section class="workspace" id="workspace" hidden>
        <section class="meter-grid">
          <article class="meter-card">
            <div class="card-head">
              <h2>Atemfrequenz</h2>
              <span>Atemzuege/min</span>
            </div>
            <output class="big-number" id="breathRate">--</output>
            <div class="segmented" role="group" aria-label="Messdauer">
              <button type="button" data-breath-window="15">15 s</button>
              <button type="button" data-breath-window="30" class="is-active">30 s</button>
              <button type="button" data-breath-window="60">60 s</button>
            </div>
            <button class="tap-button" id="breathTapButton" type="button">Atemzug tippen</button>
            <p class="muted" id="breathHelp">Tippe jeden Atemzug waehrend dein Hund ruhig liegt.</p>
          </article>

          <article class="meter-card">
            <div class="card-head">
              <h2>Puls</h2>
              <span>Schlaege/min</span>
            </div>
            <output class="big-number" id="pulseRate">--</output>
            <div class="segmented" role="group" aria-label="Puls Messdauer">
              <button type="button" data-pulse-window="15">15 s</button>
              <button type="button" data-pulse-window="30" class="is-active">30 s</button>
              <button type="button" data-pulse-window="60">60 s</button>
            </div>
            <button class="tap-button pulse" id="pulseTapButton" type="button">Puls tippen</button>
            <p class="muted" id="pulseHelp">Tippe jeden gefuehlten Herzschlag oder trage den Wert direkt ein.</p>
          </article>
        </section>

        <form class="entry-form" id="entryForm">
          <h2>Eintrag speichern</h2>
          <div class="form-grid">
            <label>
              Zeitpunkt
              <input name="measured_at" id="measuredAtInput" type="datetime-local" required>
            </label>
            <label>
              Atemfrequenz
              <input name="breaths_per_minute" id="breathInput" type="number" min="0" max="400" step="0.1" inputmode="decimal">
            </label>
            <label>
              Puls
              <input name="pulse_per_minute" id="pulseInput" type="number" min="0" max="400" step="0.1" inputmode="decimal">
            </label>
            <label>
              Zustand
              <select name="state" id="stateInput">
                <option value="resting">Ruhe</option>
                <option value="sleeping">Schlaf</option>
                <option value="after_walk">Nach Spaziergang</option>
                <option value="excited">Aufgeregt</option>
                <option value="other">Sonstiges</option>
              </select>
            </label>
          </div>
          <label>
            Notizen
            <textarea name="notes" id="notesInput" rows="3"></textarea>
          </label>
          <button class="primary" type="submit">Speichern</button>
          <p id="saveState" class="muted" hidden></p>
        </form>

        <section class="history">
          <div class="section-head">
            <h2>Verlauf</h2>
            <button id="refreshButton" type="button">Aktualisieren</button>
          </div>
          <div id="entriesList" class="entries"></div>
        </section>

        <section class="admin" id="adminPanel" hidden>
          <h2>Benutzer</h2>
          <form id="createUserForm" class="inline-form">
            <input name="username" placeholder="Benutzername" autocomplete="off" required>
            <input name="display_name" placeholder="Anzeigename" autocomplete="name">
            <button type="submit">Setup-Link erstellen</button>
          </form>
          <p class="setup-link" id="setupResult" hidden></p>
          <div id="userList" class="user-list"></div>
        </section>
      </section>
    </main>

    <footer>v<?= $version ?></footer>
    <script type="module" src="assets/app.js"></script>
  </body>
</html>
