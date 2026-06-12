<?php
declare(strict_types=1);

$app = require __DIR__ . '/app/bootstrap.php';

\DoggyLog\Http::sendSecurityHeaders();

$config = $app['config'];
$version = htmlspecialchars((string) $app['version'], ENT_QUOTES, 'UTF-8');
$appName = htmlspecialchars((string) $config['name'], ENT_QUOTES, 'UTF-8');
$appJsVersion = (string) (filemtime(__DIR__ . '/assets/app.js') ?: $app['version']);
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
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="<?= $appName ?>">
    <title><?= $appName ?></title>
    <link rel="icon" href="assets/logo.png" type="image/png" sizes="any">
    <link rel="shortcut icon" href="assets/logo.png" type="image/png">
    <link rel="apple-touch-icon" href="assets/logo.png" sizes="180x180">
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

    <aside class="notice" id="configNotice" role="alert" hidden>
      <?php if ($configWarnings !== []): ?>
        <strong>Config</strong>
        <?php foreach ($configWarnings as $warning): ?>
          <span><?= $warning ?></span>
        <?php endforeach; ?>
      <?php endif; ?>
      <div id="accessControlWarning" hidden>
        <strong>Sicherheitsfehler: Server-Dateien sind öffentlich erreichbar</strong>
        <span>Die Website sollte nicht öffentlich betrieben werden. Prüfe, ob Apache die `.htaccess`-Dateien verarbeitet und Zugriffe auf `/app`, `/config`, `/data`, `/var` sowie `/bootstrap_setup.txt` mit HTTP 403 oder 404 ablehnt. Lade die Website nach der Korrektur neu.</span>
      </div>
    </aside>

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
              <div class="choice-grid dog-buttons" id="dogButtons" role="group" aria-label="Hund"></div>
            </div>
            <div class="dog-name" id="dogNameDisplay" hidden>
              <span class="control-title">Hund</span>
              <strong></strong>
            </div>
          </div>

          <div class="choice-block">
            <span class="control-title">Messung</span>
            <div class="big-switch" role="group" aria-label="Messart">
              <button type="button" class="is-active" data-measure-type="breath" data-icon="wind">Atmung</button>
              <button type="button" data-measure-type="pulse" data-icon="heart-pulse">Puls</button>
            </div>
          </div>

          <div class="meter-stage" id="meterStage">
            <div class="segmented" role="group" aria-label="Messdauer">
              <button type="button" data-duration="15" class="is-active" data-icon="clock">15 Sekunden</button>
              <button type="button" data-duration="30" data-icon="clock">30 Sekunden</button>
            </div>
            <div class="measurement-progress" id="measurementProgress" aria-hidden="true">
              <div class="measurement-progress-fill" id="measurementProgressFill"></div>
            </div>
            <div class="meter-meta">
              <span id="meterStatus">Bereit</span>
              <span id="meterCount">0 Taps</span>
            </div>
            <button class="tap-button" id="tapButton" type="button">
              <span class="tap-button-icon" id="tapButtonIcon" aria-hidden="true"></span>
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
              <span class="control-title">Ort</span>
              <div class="choice-grid" id="locationButtons" role="group" aria-label="Ort">
                <button class="icon-button compact" id="addLocationButton" type="button" aria-label="Ort hinzufuegen" title="Ort hinzufuegen" data-icon-only="plus"></button>
              </div>
            </div>
            <div class="choice-block">
              <span class="control-title">Kontext</span>
              <input id="contextInput" name="context" type="hidden">
              <div class="pill-grid" id="contextButtons" role="group" aria-label="Kontext">
                <button class="icon-button compact" id="addContextButton" type="button" aria-label="Kontext hinzufuegen" title="Kontext hinzufuegen" data-icon-only="plus"></button>
              </div>
            </div>
            <div class="choice-block">
              <span class="control-title">Notizen</span>
              <textarea id="notesInput" name="notes" rows="3"></textarea>
            </div>
            <button class="primary" id="saveButton" type="submit" disabled data-icon="save">Messung speichern</button>
            <p id="saveState" class="muted" hidden></p>
          </form>
          <div class="save-feedback" id="measurementSavedFeedback" aria-live="polite" hidden data-icon="check">Messung gespeichert</div>
        </section>

        <section class="history" id="recordsView" hidden>
          <div class="section-head record-filter-head">
            <div class="record-tools">
              <select id="recordDogFilter" aria-label="Hund filtern" hidden>
                <option value="">Alle Hunde</option>
              </select>
              <span class="single-dog-name" id="recordSingleDogName" hidden></span>
              <select id="recordTypeFilter" aria-label="Messart filtern">
                <option value="">Alle Messungen</option>
                <option value="breath">Atmung</option>
                <option value="pulse">Puls</option>
                <option value="both">Atmung + Puls</option>
              </select>
            </div>
            <button class="record-export-button" id="recordExportButton" type="button" data-icon="download">CSV</button>
          </div>
          <div id="entriesList" class="entries"></div>
          <section class="record-editor-page" id="recordEditorPage" role="dialog" aria-modal="true" aria-label="Messung bearbeiten" hidden></section>
        </section>

        <section class="account-card" id="accountView" hidden>
          <section class="access-card">
            <div class="section-head">
              <h2>Benutzerkonto</h2>
              <div class="section-actions">
                <button class="delete-entry" id="logoutButton" type="button" data-icon="logOut">Logout</button>
              </div>
            </div>
            <form class="account-profile-form" id="accountProfileForm">
              <label>
                <span class="control-title">Benutzername</span>
                <input name="username" autocomplete="username" required>
              </label>
              <label>
                <span class="control-title">Anzeigename</span>
                <input name="display_name" autocomplete="name">
              </label>
              <label>
                <span class="control-title">E-Mail-Adresse</span>
                <input name="email" type="email" autocomplete="email">
              </label>
            </form>
            <div class="account-setup-row">
              <button id="selfSetupButton" type="button" data-icon="key">Passkey auf diesem Gerät hinzufügen</button>
            </div>
            <div class="account-passkeys" id="accountPasskeys"></div>
            <p class="setup-link" id="selfSetupResult" hidden></p>
          </section>

          <section class="access-card">
            <div class="section-head">
              <h2 id="dogSectionTitle">Hunde</h2>
            </div>
            <button class="primary account-add-button" id="dogCreateButton" type="button" data-icon="plus">Hund hinzufügen</button>
            <div class="default-summary" id="defaultDogSummary"></div>
            <label class="checkbox-line hidden-taxonomy-toggle is-editable">
              <input id="showHiddenDogs" type="checkbox">
              Ausgeblendete anzeigen <span id="hiddenDogCount"></span>
            </label>
            <div class="entries" id="dogList"></div>
          </section>

          <section class="access-card">
            <div class="section-head">
              <h2 id="locationSectionTitle">Orte</h2>
            </div>
            <button class="primary account-add-button" id="locationCreateButton" type="button" data-icon="plus">Ort hinzuf&uuml;gen</button>
            <label class="checkbox-line hidden-taxonomy-toggle is-editable">
              <input id="showHiddenLocations" type="checkbox">
              Ausgeblendete anzeigen <span id="hiddenLocationCount"></span>
            </label>
            <div class="entries" id="locationList"></div>
          </section>

          <section class="access-card">
            <div class="section-head">
              <h2 id="contextSectionTitle">Kontexte</h2>
            </div>
            <button class="primary account-add-button" id="contextCreateButton" type="button" data-icon="plus">Kontext hinzuf&uuml;gen</button>
            <label class="checkbox-line hidden-taxonomy-toggle is-editable">
              <input id="showHiddenContexts" type="checkbox">
              Ausgeblendete anzeigen <span id="hiddenContextCount"></span>
            </label>
            <div class="entries" id="contextList"></div>
          </section>

          <section class="admin" id="userAdminPanel" hidden>
            <div class="section-head">
              <h2 id="userSectionTitle">Alle Benutzer</h2>
            </div>
            <button class="primary account-add-button" id="userCreateButton" type="button" data-icon="plus">Benutzer hinzufügen</button>
            <label class="checkbox-line hidden-taxonomy-toggle is-editable">
              <input id="showDisabledUsers" type="checkbox">
              Deaktivierte anzeigen <span id="disabledUserCount"></span>
            </label>
            <div id="userList" class="user-list"></div>
          </section>
        </section>
      </section>
    </main>
    <script src="assets/icons.js"></script>
    <script type="module" src="assets/app.js?v=<?= rawurlencode($appJsVersion) ?>"></script>
  </body>
</html>
