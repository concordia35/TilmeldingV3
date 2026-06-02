# Tilmelding v3-v4

Denne version bruger Google Sheet som eneste kilde til tilmeldinger. Browseren husker kun valgt navn.

Vigtigt:
1. Upload alle webfiler til GitHub Pages.
2. Erstat hele Apps Script-koden med `google-apps-script.gs`.
3. Vælg Implementer → Administrer implementeringer → Rediger → Ny version → Implementer.
4. Åbn webapp-url med `?action=kitchen` én gang for at opdatere Køkken-arket.

Forventede ark:
- Medlemmer: `id | navn`
- Arrangementer: `id | dato | tid | titel | beskrivelse | allowGuests`
- Tilmeldinger: `timestamp | memberId | navn | eventId | deltager | mad | guest | guestName | guestFood | note`
- Køkken: automatisk
