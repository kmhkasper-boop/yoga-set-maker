# Yoga Set Maker

Een eenvoudige app om yogalessen (sets) samen te stellen, te bewaren, te printen en mee les te geven.
Gemaakt als cadeau voor Sterre van [Sterre's Yoga](https://www.sterresyoga.nl/).

**Open de app:** https://kmhkasper-boop.github.io/yoga-set-maker/

## Wat kan het?
- **Set maken** – kies houdingen uit 82 getekende houdingen (NL + Sanskriet, uitleg, aanwijzingen, makkelijkere varianten en ‘let op’ bij blessures en zwangerschap). Sleep kaarten in de goede volgorde, voeg tekst en kopjes toe, dupliceer of verwijder.
- **Tijd** – per houding in seconden of ademhalingen, rechts/links-knop (telt dubbel), totale lesduur loopt live mee.
- **Foto van papier** – maak een foto van een getekende les; die staat naast de set als voorbeeld.
- **Muziek** – Spotify-playlist per set (één knop) en eigen mp3’s die in de app spelen.
- **Bekijken, printen (PDF) en Les geven** – grote kaarten, timer, zachte bel, scherm blijft aan.
- **App op je beginscherm zetten** – knop in het welkomstscherm, bij Leg uit en in Instellingen: één tik op Android/Chrome/Edge, stap-voor-stap uitleg op iPhone/iPad.
- **Feedback / wens doorgeven** – via “Leg uit” of Instellingen: opent je mail-app met een ingevuld bericht (adres instelbaar), of kopieer de tekst.
- **Mijn sets** – zoeken, favorieten, dupliceren, voorbeeldsets, back-up maken en terugzetten.
- **Werkt offline** en is te installeren op iPhone, Android, tablet en laptop.
- **Leg uit** – knop rechtsboven geeft een rondleiding.
- Naam, logo en kleuren zijn aan te passen bij Instellingen.

## Installeren op je telefoon
**iPhone (Safari):** open de link › tik op Delen (vierkantje met pijl) › *Zet op beginscherm* › *Voeg toe*.
**Android (Chrome):** open de link › menu ⋮ › *App installeren* (of *Toevoegen aan startscherm*).

## Belangrijk: back-up
Je sets staan alleen op het apparaat zelf. Maak af en toe een back-up via **Instellingen › Back-up maken** en bewaar het bestand (bijv. in je mail of Drive).

## Offline-versie
`Yoga-Set-Maker.html` is de complete app in één bestand. Dubbelklik op een laptop om hem in de browser te openen – geen internet nodig.

## Techniek
Plain HTML/CSS/JS, geen build-stap, geen tracking. Gegevens in localStorage + IndexedDB. Illustraties worden als SVG getekend (`js/figure.js`, `js/geo.js`). Lettertypen Lato en Courgette (SIL Open Font License).
