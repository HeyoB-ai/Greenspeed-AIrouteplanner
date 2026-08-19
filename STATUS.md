# Status — koeriersfeedback

Bijgewerkt: 17 augustus 2026

Statuswaarden: `open` · `in behandeling` · `gedaan` · `vervallen`

## Tabel 1 — Koeriersfeedback

### App

| Punt | Omschrijving | Status | Commit |
|:--|:--|:--|:--|
| 1 | Camera blijft live in plaats van foto maken bij scan | gedaan | `8f80b93` |
| 2 | Laatst gescande adres bovenaan / lijst omgekeerd sorteren | gedaan | `f04ce75` |
| 3 | Verwijderd pakket blijft in de lijst staan | open | `?` |
| 4 | Opmerkingenveld per adres | vervallen | — |
| 5 | Status afgeleverd niet terug te draaien | in behandeling | `6edf051` |
| 6 | Melding bij tweede scan van hetzelfde adres | in behandeling | `531e082` |
| 7 | Huisnummer onzichtbaar bij lange straatnaam | open | `?` |

### Kaart

| Punt | Omschrijving | Status | Commit |
|:--|:--|:--|:--|
| K1 | Nummers tonen bezorgvolgorde in plaats van pakketnummers | open | `?` |
| K2 | Tijdsindicatie zonder bezorgtijd per pakje | gedaan | `268511c` |
| K3 | Echte route tekenen | vervallen | — |

## Toelichting per punt

**1 — Camera blijft live.** De foto was altijd al klaar op het moment van de flits; de camera bleef alleen zichtbaar tijdens de 6-7 seconden Gemini-verwerking. Opgelost met een banner "📸 Foto gemaakt — je kunt verder scannen", gekoppeld aan `pendingScans`.

**2 — Omgekeerd sorteren.** Vóór routeoptimalisatie aflopend op `scanNumber` (nieuwste bovenaan), erna oplopend op `routeIndex` (eerste stop bovenaan). De modus wordt één keer voor de hele lijst bepaald.

**3 — Verwijderd pakket blijft staan.** Bevestigd in de code: `CourierView.tsx:166` retourneert `[...sortedActionable, ...sortedDone, ...removed]`, dus `REMOVED`-pakketten staan onderaan de lijst met `opacity-60` in plaats van eruit te verdwijnen. Geen commit gevonden die dit adresseert. Te beslissen: helemaal verbergen, of achter een "toon verwijderde"-schakelaar.

**4 — Opmerkingenveld.** Bewuste keuze om dit niet te bouwen.

**5 — Afgeleverd terugdraaien.** De knop "↩ Ongedaan maken" staat op pakketten met status `DELIVERED` en zet ze terug naar `ASSIGNED`. Werkt niet voor pakketten in de grijze lijst — nog te reproduceren en af te bakenen welke statussen daar precies onder vallen. Bewust níét van toepassing op `MAILBOX`, `NEIGHBOUR`, `RETURN`, `MOVED` en `OTHER_LOCATION`.

**6 — Melding bij tweede scan.** Gebouwd op de gedeelde helper `utils/addressKey.ts`: amber melding in het scankader, eigen attentietoon, en een amber label op de tegels. Blokkeert niets — het pakket wordt altijd toegevoegd. **Nog niet op een toestel bevestigd.** Bijbehorende openstaande melding: een tweede pakket op hetzelfde adres verdween in de praktijk; de tijdelijke `[DubbelAdres]`-logging uit `ad6f8dd` staat nog live om dat te herleiden. Mogelijk dezelfde oorzaak als de verlopen sessie (zie Openstaande diagnostiek).

**7 — Huisnummer onzichtbaar.** Bevestigd in de code: `CourierView.tsx:678` zet `truncate` op de regel `{street} {houseNumber}`, dus bij een lange straatnaam valt juist het huisnummer weg — het deel dat de koerier nodig heeft. Geen commit gevonden. Mogelijke oplossingen: huisnummer in een apart element dat niet meekrimpt (`shrink-0`), of de straatnaam laten afbreken in plaats van de hele regel.

**K1 — Nummering op de kaart.** Geen commit gevonden, en het punt is nog niet eenduidig. In `RouteMapModal.tsx:128` worden de markers al genummerd met `i + 1` over de geoptimaliseerde volgorde — dat ís de bezorgvolgorde. De pakkettegels in de lijst tonen wél het scannummer (`CourierView.tsx:672`, `pkg.scanNumber`). Voordat hier iets aan verandert: navragen of de klacht over de kaartmarkers of over de tegels gaat. Let op dat `scanNumber` het nummer is dat de koerier fysiek op het pakje schrijft — dat mag niet zomaar de routepositie worden.

**K2 — Tijdsindicatie.** De rijtijd kwam al van de Google Routes API, maar zonder stoptijd. Nu inclusief bezorgtijd per adres, getoond als "Totaal ~Z min (indicatie)" met de splitsing eronder.

**K3 — Echte route tekenen.** Vervallen wegens API-kosten. De rechte lijnen tussen stops blijven.

## Aannames en constanten

Deze getallen zijn **schattingen, geen gemeten waarden**. Zodra er echte tijdregistratie per stop is, horen ze daaruit te komen.

| Constante | Waarde | Waar | Betekenis |
|:--|:--|:--|:--|
| `STOP_SECONDS_PER_ADDRESS` | 90 s | `components/RouteMapModal.tsx` | Aanbellen, overdracht, terug naar de fiets — per uniek afleveradres |
| `STOP_SECONDS_PER_EXTRA_PACKAGE` | 15 s | `components/RouteMapModal.tsx` | Tweede/derde pakket op hetzelfde adres. Twee pakketten op één adres = 105 s, niet 180 s |

**Fietssnelheid: geen aanname.** De rij-afstand en rijtijd komen rechtstreeks uit de Google Routes API (`travelMode: BICYCLE`) via `netlify/functions/maps.ts`. Er staat nergens een km/u in de code, en de afstand is werkelijke wegafstand — geen hemelsbrede lijn. Een omwegfactor toepassen zou een al correct getal opblazen.

### Overige vaste waarden in de scan- en routeketen

| Constante | Waarde | Waar | Betekenis |
|:--|:--|:--|:--|
| `MAX_CONCURRENT` | 2 | `Scanner.tsx` | Gelijktijdige Gemini-aanroepen tijdens burst-scannen |
| cooldown na capture | 2000 ms | `Scanner.tsx` | Voorkomt rate-limit bursts |
| duur adresmelding | 4000 ms | `Scanner.tsx` | Of tot de volgende scan |
| `MAX_RETRIES` | 3 | `services/geminiService.ts` | Alleen bij status 503; 429 wordt bewust niet geretryd |
| `maxClusterSize` | 23 | `services/geminiService.ts` | Stops per cluster; de Routes API accepteert er 25 per aanroep |
| `MAX_CALLS_PER_HOUR` | 500 | `netlify/functions/gemini.ts` | Circuit breaker per warme container, geen harde globale limiet |
| `minSecondsLeft` | 300 s | `services/supabaseService.ts` | Onder deze resterende geldigheid wordt de sessie ververst bij het openen van de scanner |

## Openstaande diagnostiek

Tijdelijke logging die nog live staat en verwijderd moet worden zodra de bijbehorende bug gesloten is:

| Prefix | Commit | Waarvoor |
|:--|:--|:--|
| `[DubbelAdres]` | `ad6f8dd` | Tweede pakket op hetzelfde adres verdwijnt — nog niet herleid |

Opgeloste diagnostiek, logging inmiddels verwijderd of vervangen door permanente foutafhandeling:

| Prefix | Commit | Uitkomst |
|:--|:--|:--|
| `[ScanCam]` | `ec792b5` | Zwart camerabeeld op iOS — camerarechten niet gegeven in standalone-modus. Opgelost met een uitleg-melding in `9a7ff0d`; manifest ongewijzigd |
| `[ScanFout]` | `b765319` | "Verwerking mislukt" bij elke scan — verlopen Supabase-sessie, afgewezen door `verifyAuth` vóór de eerste `[gemini]`-log. Opgelost in `1950bf6` |

## Bekende techniek-schuld

- **`tsc --noEmit` checkt nul bestanden.** `tsconfig.json` heeft `"include": ["src"]` terwijl alle bronbestanden in de root staan. Een echte typecheck vereist een tijdelijke config die `App.tsx`, `Scanner.tsx`, `components`, `services` en `utils` meeneemt. Baseline: 15 fouten (2 `App.tsx`, 2 `ArchiveView.tsx`, 8 `DienstCheck.tsx`, 3 `supabaseService.ts`).
- **De `packages`-tabel staat niet in `supabase/migrations/`.** Migraties 001-012 maken hem niet aan; het schema is buiten versiebeheer om aangelegd. Constraints en indexen op die tabel zijn daardoor niet uit de repo af te leiden.
- **`onUpdate` is een lege stub.** `App.tsx` geeft `onUpdate={() => {}}` door aan `CourierView`; alle statuswijzigingen lopen via `onUpdateMany`. Een aanroep van `onUpdate` doet stil niets.
- **`verifyAuth` logt alleen in `gemini.ts`.** `maps.ts`, `pdok.ts` en de overige functies gebruiken dezelfde helper en hebben nog steeds een onzichtbaar auth-faalpad.
