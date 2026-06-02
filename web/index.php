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
    <meta name="theme-color" content="#121721">
    <title><?= $appName ?></title>
    <link rel="icon" href="assets/logo.png" type="image/png">
    <link rel="stylesheet" href="assets/app.css">
  </head>
  <body>
    <header class="topbar">
      <div class="brand-line">
        <div class="brand-title">
          <a class="brand-home-link" href="./" aria-label="<?= $appName ?> Startseite">
            <img class="brand-logo" src="assets/logo.png" width="40" height="40" alt="" aria-hidden="true">
            <h1><?= $appName ?></h1>
          </a>
          <a class="version-link" href="https://github.doggylog.kimvosen.de" target="_blank" rel="noopener noreferrer">v<?= $version ?></a>
        </div>
        <span class="connection-status" id="connectionStatus" hidden>Lädt...</span>
      </div>
      <nav class="top-tabs" id="topTabs" aria-label="Hauptnavigation" hidden>
        <button class="top-tab is-active" type="button" data-view-tab="measure" data-icon="activity">Messung</button>
        <button class="top-tab" type="button" data-view-tab="records" data-icon="history">Verlauf</button>
        <button class="top-tab" type="button" data-view-tab="account" data-icon="user">Konto</button>
        <button class="top-tab" id="loginButton" type="button" data-icon="key" hidden>Login</button>
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
          <button class="primary" id="passkeyLoginButton" type="button" data-icon="key">Mit Passkey einloggen</button>
          <form id="loginEmailForm" hidden>
            <p class="muted">Falls der Passkey nicht klappt, kannst du dir einen Login-Link schicken lassen.</p>
            <label>
              E-Mail
              <input id="loginEmailInput" name="email" type="email" autocomplete="email">
            </label>
            <button type="submit" data-icon="mail">Login-Link senden</button>
            <p id="loginEmailState" class="muted" hidden></p>
          </form>
        </div>

        <form id="setupForm" hidden>
          <h2>Passkey einrichten</h2>
          <p>Einmaliger Setup-Link.</p>
          <input id="setupInput" name="setup" type="hidden">
          <button class="primary" type="submit" data-icon="key">Passkey erstellen</button>
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
              <button type="button" class="is-active" data-measure-type="breath" data-icon="wind">Atemfrequenz</button>
              <button class="swap-type-button" id="swapMeasurementTypesButton" type="button" aria-label="Atemfrequenz und Puls tauschen" title="Atemfrequenz und Puls tauschen">
                <span aria-hidden="true">&#11013;</span>
                <span aria-hidden="true">&#10145;</span>
              </button>
              <button type="button" data-measure-type="pulse" data-icon="heart-pulse">Pulse</button>
            </div>
          </div>

          <div class="choice-block">
            <span class="control-title">Dauer</span>
            <div class="segmented" role="group" aria-label="Messdauer">
              <button type="button" data-duration="15" class="is-active" data-icon="clock">15 Sekunden</button>
              <button type="button" data-duration="30" data-icon="clock">30 Sekunden</button>
            </div>
          </div>

          <div class="meter-stage" id="meterStage">
            <div class="measurement-progress" id="measurementProgress" aria-hidden="true">
              <div class="measurement-progress-fill" id="measurementProgressFill"></div>
            </div>
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
                  <button class="icon-button compact" id="addLocationButton" type="button" aria-label="Ort hinzufuegen" title="Ort hinzufuegen" data-icon-only="plus"></button>
                  <button class="icon-button compact" id="deleteLocationButton" type="button" aria-label="Ort loeschen" title="Ort loeschen" data-icon-only="trash"></button>
                </div>
              </div>
              <div class="pill-grid" id="locationButtons" role="group" aria-label="Ort"></div>
            </div>
            <div class="choice-block">
              <div class="choice-head">
                <span class="control-title">Kontext</span>
                <div class="pill-actions">
                  <button class="icon-button compact" id="addContextButton" type="button" aria-label="Kontext hinzufuegen" title="Kontext hinzufuegen" data-icon-only="plus"></button>
                  <button class="icon-button compact" id="deleteContextButton" type="button" aria-label="Kontext loeschen" title="Kontext loeschen" data-icon-only="trash"></button>
                </div>
              </div>
              <input id="contextInput" name="context" type="hidden">
              <div class="pill-grid" id="contextButtons" role="group" aria-label="Kontext"></div>
            </div>
            <div class="choice-block">
              <span class="control-title">Notizen</span>
              <textarea id="notesInput" name="notes" rows="3"></textarea>
            </div>
            <button class="primary" id="saveButton" type="submit" disabled data-icon="save">Messung speichern</button>
            <p id="saveState" class="muted" hidden></p>
          </form>
        </section>

        <section class="history" id="recordsView" hidden>
          <div class="record-export-row">
            <button class="record-export-button" id="recordExportButton" type="button" data-icon="download">CSV exportieren</button>
          </div>
          <div class="section-head record-filter-head">
            <div class="record-tools">
              <select id="recordDogFilter" aria-label="Hund filtern" hidden>
                <option value="">Alle Hunde</option>
              </select>
              <span class="single-dog-name" id="recordSingleDogName" hidden></span>
              <select id="recordTypeFilter" aria-label="Messart filtern">
                <option value="">Alle Messungen</option>
                <option value="breath">Atemfrequenz</option>
                <option value="pulse">Pulse</option>
                <option value="both">Beides</option>
              </select>
            </div>
          </div>
          <div id="entriesList" class="entries"></div>
          <section class="record-editor-page" id="recordEditorPage" hidden></section>
        </section>

        <section class="account-card" id="accountView" hidden>
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
      </section>
    </main>
    <script src="assets/icons.js"></script>
    <script type="module" src="assets/app.js"></script>
  </body>
</html>
