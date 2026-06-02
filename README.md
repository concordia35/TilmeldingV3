# Tilmelding v3-v5 · Concordia 35

Denne version bruger Google Sheets + Apps Script som datakilde. Den gemmer kun valgt bruger lokalt i browseren. Tilmeldinger læses fra Google Sheet.

## Nye ting i v3-v5

- Afholdte arrangementer fjernes automatisk fra hjemmesiden.
- Tilmeldingsfrist kan sættes pr. arrangement.
- Når fristen er overskredet, kan man se sin status, men ikke ændre den.
- Køkkenoverblik bruger kun Google Sheet-data.
- Service worker/cache er opdateret til v3-v5.

## Sheet-faner

Brug disse faner:

- `Medlemmer`
- `Arrangementer`
- `Tilmeldinger`
- `Køkken`

## Arrangementer

Tilføj kolonnen `deadline` i fanen `Arrangementer`.

Anbefalede overskrifter:

```text
id | dato | tid | titel | beskrivelse | allowGuests | deadline | kategori
```

Eksempel:

```text
2026-09-30 | 2026-09-30 | 19:30 | Tag en ven med | Alm. arbejdsmøde. Tag en ven med. | yes | 2026-09-29 12:00 | IO
```

`deadline` kan skrives som:

```text
2026-09-29 12:00
```

eller:

```text
29.09.2026 12:00
```

Hvis `deadline` er tom, låses arrangementet ikke før det er afholdt.

## Apps Script

Erstat hele Apps Script-koden med `google-apps-script.gs`.

Derefter:

1. Gem.
2. Implementer → Administrer implementeringer.
3. Klik blyanten ved Webapp.
4. Vælg `Ny version`.
5. Klik Implementer.

## GitHub

Upload hele indholdet af mappen til GitHub-repoet.

Efter upload: åbn siden med `?v=5` første gang, fx:

```text
https://concordia35.github.io/TilmeldingV3/?v=5
```
