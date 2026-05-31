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
      <div class="brand-line">
        <div class="brand-title">
          <h1><?= $appName ?> <a class="version-link" href="https://github.doggylog.kimvosen.de" target="_blank" rel="noopener noreferrer">v<?= $version ?></a></h1>
        </div>
        <span class="connection-status" id="connectionStatus" hidden>Lädt...</span>
      </div>
      <nav class="top-tabs" id="topTabs" aria-label="Hauptnavigation" hidden>
        <button class="top-tab is-active" type="button" data-view-tab="measure">Messung</button>
        <button class="top-tab" type="button" data-view-tab="records">Verlauf</button>
        <a class="top-tab" id="accountLink" href="account.php" hidden>Konto</a>
        <button class="top-tab" id="loginButton" type="button" hidden>Login</button>
      </nav>
    </header>

    <?php if ($configWarnings !== []): ?>
      <aside class="notice" id="configNotice" role="alert" hidden>
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
          <p>Mit Passkey einloggen.</p>
          <button class="primary" id="passkeyLoginButton" type="button">Mit Passkey einloggen</button>
          <form id="loginEmailForm" hidden>
            <p class="muted">Falls der Passkey nicht klappt, kannst du dir einen Login-Link schicken lassen.</p>
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
        <section class="measure-card" id="measurementView">
          <div class="dog-row">
            <div class="choice-block" id="dogSelectLabel">
              <span class="control-title">Hund</span>
              <input id="dogSelect" type="hidden">
              <div class="pill-grid dog-buttons" id="dogButtons" role="group" aria-label="Hund"></div>
            </div>
            <div class="dog-name" id="dogNameDisplay" hidden>
              <span class="control-title">Hund</span>
              <strong></strong>
            </div>
          </div>

          <div class="choice-block">
            <span class="control-title">Messung</span>
            <div class="big-switch" role="group" aria-label="Messart">
              <button type="button" class="is-active" data-measure-type="breath">Atemfrequenz</button>
              <button type="button" data-measure-type="pulse">Puls</button>
            </div>
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
            <button class="secondary-action danger-action" id="newMeasurementButton" type="button" hidden>Neue Messung</button>
          </div>

          <div class="choice-block">
            <span class="control-title">Modus</span>
            <div class="mode-grid" id="modeButtons" role="group" aria-label="Messmodus"></div>
          </div>

          <form class="save-panel" id="entryForm">
            <input name="measured_at" id="measuredAtInput" type="hidden">
            <div class="choice-block">
              <div class="choice-head">
                <span class="control-title">Ort</span>
                <div class="pill-actions">
                  <button class="icon-button compact" id="addLocationButton" type="button" aria-label="Ort hinzufuegen" title="Ort hinzufuegen">+</button>
                  <button class="icon-button compact" id="deleteLocationButton" type="button" aria-label="Ort loeschen" title="Ort loeschen">-</button>
                </div>
              </div>
              <div class="pill-grid" id="locationButtons" role="group" aria-label="Ort"></div>
            </div>
            <div class="choice-block">
              <div class="choice-head">
                <span class="control-title">Kontext</span>
                <div class="pill-actions">
                  <button class="icon-button compact" id="addContextButton" type="button" aria-label="Kontext hinzufuegen" title="Kontext hinzufuegen">+</button>
                  <button class="icon-button compact" id="deleteContextButton" type="button" aria-label="Kontext loeschen" title="Kontext loeschen">-</button>
                </div>
              </div>
              <input id="contextInput" name="context" type="hidden">
              <div class="pill-grid" id="contextButtons" role="group" aria-label="Kontext"></div>
            </div>
            <div class="choice-block">
              <span class="control-title">Notizen</span>
              <textarea id="notesInput" name="notes" rows="3"></textarea>
            </div>
            <button class="primary" id="saveButton" type="submit" disabled>Messung speichern</button>
            <p id="saveState" class="muted" hidden></p>
          </form>
        </section>

        <section class="history" id="recordsView" hidden>
          <div class="section-head">
            <h2>Verlauf</h2>
            <button id="refreshButton" type="button">Aktualisieren</button>
          </div>
          <div id="entriesList" class="entries"></div>
        </section>
      </section>
    </main>
    <script type="module" src="assets/app.js"></script>
  </body>
</html>
