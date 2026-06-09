# Doggy Log

Mobile PHP-Webseite zum Erfassen von Atemfrequenz und Puls eines Hundes.

## Nutzung

- Inhalte aus `web/` auf einen PHP-8-Host deployen.
- `web/config/app.json` anpassen: `auth.base_url`, `auth.origin`, `auth.rp_id` und `auth.allowed_hosts` muessen auf die oeffentliche Produktionsdomain zeigen. `auth.trusted_proxies` darf nur feste Proxy-IP-Adressen enthalten.
- Erster Start erzeugt `web/bootstrap_setup.txt`; den Setup-Link daraus oeffnen und einen Passkey registrieren.
- Login laeuft per Passkey, optional per E-Mail-Link wenn `mail.enabled` konfiguriert ist. Setup- und Login-Tokens stehen im URL-Fragment und werden nicht an den Webserver gesendet.
- JSON-Requests sind auf 64 KiB begrenzt. Aktive WebAuthn-Challenges sind global, fuer Login und pro Benutzer begrenzt; pro Benutzer bleibt hoechstens ein E-Mail-Login-Link aktiv.

## Daten

- Hunde liegen in `web/data/dogs/`, Vitalwerte in `web/data/vitals/`.
- Auth-, Session- und Setupdaten liegen in `web/var/auth/`.
- `.htaccess` schuetzt `app/`, `config/`, `data/`, `var/` und `bootstrap_setup.txt` vor direktem Webzugriff.

## Deploy

`deploy.bat` spiegelt `web/` nach `X:\doggylog`.
