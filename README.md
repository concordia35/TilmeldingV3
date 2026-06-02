# Tilmelding v3-v6 · Concordia 35

Denne version bruger Google Sheet som eneste datakilde for både medlemmer, arrangementer og tilmeldinger. `events.json` bruges ikke længere.

## Upload til GitHub

Upload/erstat disse filer i repoet:

- `index.html`
- `style.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- mappen `icons/`

`events.json` kan slettes fra GitHub, men det gør ikke noget, hvis den bliver liggende. Den bliver ignoreret.

## Google Sheet faner

### Medlemmer

Kolonner:

```text
id | navn
```

### Arrangementer

Kolonner:

```text
id | dato | tid | titel | beskrivelse | allowGuests | deadline | kategori
```

Eksempel:

```text
2026-09-30 | 2026-09-30 | 19:30 | Alm. Arbejdsmøde | Tag en ven med | ja | 2026-09-29 12:00 | IO
```

Vigtigt:
- `id` skal helst være samme datoformat som `dato`, fx `2026-09-30`.
- `allowGuests` kan være `ja` eller `nej`.
- `deadline` kan være fx `2026-09-29 12:00`.
- Afholdte arrangementer skjules automatisk på hjemmesiden.

### Tilmeldinger

Kolonner:

```text
timestamp | memberId | navn | eventId | deltager | mad | guest | guestName | guestFood | note
```

### Køkken

Genereres automatisk af Apps Script, når nogen gemmer en tilmelding.

## Apps Script

Erstat hele Apps Script-koden med indholdet fra:

```text
google-apps-script.gs
```

Derefter:

1. Gem.
2. Implementer → Administrer implementeringer.
3. Klik blyanten ved webappen.
4. Vælg **Ny version**.
5. Klik **Implementer**.

Hvis du laver en helt ny webapp-adresse, skal den nye adresse sættes ind i `app.js` ved `GOOGLE_APPS_SCRIPT_URL`.

## Cache

Efter upload til GitHub: åbn siden med:

```text
?v=6
```

eller tryk `Ctrl + F5`.
