# Doggy Log

Mobile PHP-Webseite zum Erfassen von Atemfrequenz und Puls eines Hundes.

## Nutzung

- Inhalte aus `web/` auf einen PHP-8-Host deployen.
- `web/config/app.json` anpassen: `auth.base_url` muss die oeffentliche URL sein.
- Erster Start erzeugt `web/bootstrap_setup.txt`; den Setup-Link daraus oeffnen und einen Passkey registrieren.
- Login laeuft per Passkey, optional per E-Mail-Link wenn `mail.enabled` konfiguriert ist.

## Daten

- Hunde liegen in `web/data/dogs/`, Vitalwerte in `web/data/vitals/`.
- Auth-, Session- und Setupdaten liegen in `web/var/auth/`.
- `.htaccess` schuetzt `app/`, `config/`, `data/`, `var/` und `bootstrap_setup.txt` vor direktem Webzugriff.

## Deploy

`deploy.bat` spiegelt `web/` nach `X:\doggylog`.
