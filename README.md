# Tilmelding v3 · v3

Indeholder:
- Direkte Google Sheet via Apps Script
- Navneliste i stedet for mail/login
- Medlemslisten fra det uploadede billede er lagt ind som startliste
- Gæstefunktion for udvalgte aftener
- Køkkenoverblik opdelt pr. aften
- PWA-installationsknap

## Hjemmesiden
Upload disse filer til GitHub Pages:
- index.html
- style.css
- app.js
- events.json
- manifest.webmanifest
- sw.js
- icons/

## Google Sheet
1. Opret et nyt Google Sheet.
2. Gå til Udvidelser > Apps Script.
3. Slet alt i editoren.
4. Indsæt hele `google-apps-script.gs`.
5. Gem projektet.
6. Vælg funktionen `setupSheet` og tryk Kør.
7. Godkend rettighederne.
8. Gå tilbage til dit Google Sheet. Fanerne er nu oprettet.
9. Ret fanen `Medlemmer`, så den indeholder alle brødre.

## Deploy Apps Script
1. Tryk Deploy > New deployment.
2. Vælg Web app.
3. Execute as: Me.
4. Who has access: Anyone.
5. Tryk Deploy.
6. Kopiér Web App URL.
7. Indsæt URL'en i `app.js` i feltet `GOOGLE_APPS_SCRIPT_URL`.
8. Upload den ændrede `app.js` til GitHub.

## Faner
- Medlemmer: dem der kan vælge navn på siden.
- Arrangementer: alle aftener.
- Tilmeldinger: rå historik. Lad den være.
- Køkken: automatisk oversigt til madansvarlig.
