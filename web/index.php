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
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="color-scheme" content="dark">
    <title><?= $appName ?></title>
    <link rel="stylesheet" href="assets/app.css">
  </head>
  <body>
    <header class="topbar">
      <div>
        <p class="eyebrow">Vitalzeichen</p>
        <h1><?= $appName ?></h1>
      </div>
      <div class="session">
        <span id="connectionStatus">Lädt...</span>
        <a class="button-link" id="accountLink" href="account.php" hidden>Konto</a>
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
          <p>Passkey nutzen. Optional E-Mail-Link, wenn konfiguriert.</p>
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
          <p>Einmaliger Setup-Link.</p>
          <input id="setupInput" name="setup" type="hidden">
          <button class="primary" type="submit">Passkey erstellen</button>
        </form>
      </section>

      <p class="message" id="authMessage" role="alert" hidden></p>

      <section class="workspace" id="workspace" hidden>
        <section class="measure-card">
          <div class="dog-row">
            <label>
              Hund
              <select id="dogSelect"></select>
            </label>
          </div>

          <div class="choice-block">
            <span class="control-title">Was messen?</span>
            <div class="big-switch" role="group" aria-label="Messart">
              <button type="button" class="is-active" data-measure-type="breath">Atemfrequenz</button>
              <button type="button" data-measure-type="pulse">Puls</button>
            </div>
          </div>

          <div class="choice-block">
            <span class="control-title">Modus</span>
            <div class="mode-grid" id="modeButtons" role="group" aria-label="Messmodus"></div>
          </div>

          <div class="choice-block">
            <span class="control-title">Dauer</span>
            <div class="segmented" role="group" aria-label="Messdauer">
              <button type="button" data-duration="15" class="is-active">15 Sekunden</button>
              <button type="button" data-duration="30">30 Sekunden</button>
            </div>
          </div>

          <div class="meter-stage" id="meterStage">
            <div class="meter-meta">
              <span id="meterStatus">Bereit</span>
              <span id="meterCount">0 Taps</span>
            </div>
            <button class="tap-button" id="tapButton" type="button">
              <span id="tapButtonMain">Messung starten</span>
              <small id="tapButtonSub">Erster Tap startet Timer</small>
            </button>
            <output class="result" id="measurementResult">-- / min</output>
            <button class="secondary-action" id="newMeasurementButton" type="button" hidden>Neue Messung</button>
          </div>

          <form class="save-panel" id="entryForm">
            <input name="measured_at" id="measuredAtInput" type="hidden">
            <div class="form-grid">
              <label>
                Ort
                <select id="locationInput" name="location">
                  <option value="home">Zuhause</option>
                  <option value="school">Schule</option>
                  <option value="away">Unterwegs</option>
                </select>
              </label>
              <label>
                Kontext
                <input id="contextInput" name="context" placeholder="z.B. viel aktiv, Arbeitstag">
              </label>
            </div>
            <label>
              Freitext
              <textarea id="notesInput" name="notes" rows="3" placeholder="Optional"></textarea>
            </label>
            <button class="primary" id="saveButton" type="submit" disabled>Messung speichern</button>
            <p id="saveState" class="muted" hidden></p>
          </form>
        </section>

        <section class="history">
          <div class="section-head">
            <h2>Verlauf</h2>
            <button id="refreshButton" type="button">Aktualisieren</button>
          </div>
          <div id="entriesList" class="entries"></div>
        </section>
      </section>
    </main>

    <footer><a href="https://github.doggylog.kimvosen.de" target="_blank" rel="noopener noreferrer">v<?= $version ?></a></footer>
    <script type="module" src="assets/app.js"></script>
  </body>
</html>
