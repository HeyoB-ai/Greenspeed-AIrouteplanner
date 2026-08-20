# Status — koeriersfeedback

Bijgewerkt: 19 augustus 2026

Statuswaarden: `open` · `in behandeling` · `gedaan` · `vervallen`

## Livegang

**Doel: binnen een maand live, gesteld op 19 augustus 2026.**

De app is nog **niet in productie**. Er wordt met echte pakjes en echte routes getest, maar dit is een testomgeving.

Bij de livegang wordt alle data gewist en wordt met een schone database begonnen. Daarna worden **67 apotheken** en **meer dan 50 bezorgers** ingevoerd en aan de juiste apotheken gekoppeld. Pas daarna gaat het systeem echt van start.

Twee kaders waar al het werk hieronder binnen valt:

- **Alle openstaande punten in dit document worden vóór de livegang opgepakt.** Er wordt niets doorgeschoven naar erna.
- **Geen grote refactor van de bestaande code.** Het schema-werk valt samen met het opzetten van de schone database; dat is het natuurlijke moment en er is geen tweede.

### Fasering

**Week 1 — Fundament**

Schema in migraties vastleggen: `packages`, `statusHistory` en de RLS-policies staan nu buiten versiebeheer. De policy uit `c2ee76c` testen en meenemen. `tsconfig.json` repareren en de 15 typefouten wegwerken.

Parallel, en dit is vragen stellen in plaats van code schrijven: uitzoeken hoe de import van apotheken en het koppelproces voor koeriers eruit moeten zien. Dat is de grootste onbekende.

**Week 2 — Koerierspunten**

De tien punten uit de tweede feedbackronde plus de openstaande punten uit de eerste.

De retour-bug voorop: een opmerking bij "andere reden" zet het pakket op retour terwijl het bezorgd is (`NotHomeSheet.tsx`, de optie `custom` heeft `status: PackageStatus.RETURN`). De apotheek krijgt daardoor verkeerde informatie over waar medicijnen zijn.

**Week 3 — Livegang-machinerie**

Import van 67 apotheken. Koppelproces voor 50+ koeriers. Accounts opschonen. Database leegmaken en opnieuw opbouwen uit migraties.

**Week 4 — Testen en marge**

Op echte toestellen met echte koeriers. Ritcontrole en Gemini-healthcheck erbij. Ruimte voor wat er dan blijkt.

## Koeriersfeedback — eerste ronde

### App

| Punt | Omschrijving | Status | Commit |
|:--|:--|:--|:--|
| 1 | Camera blijft live in plaats van foto maken bij scan | gedaan | `8f80b93` |
| 2 | Laatst gescande adres bovenaan / lijst omgekeerd sorteren | gedaan | `f04ce75` |
| 3 | Verwijderd pakket blijft in de lijst staan | open | `?` |
| 4 | Opmerkingenveld per adres | vervallen | — |
| 5 | Status afgeleverd/niet-thuis niet terug te draaien | in behandeling | `6edf051` → `fa6f9c5` → `c2d72b3` |
| 6 | Melding bij tweede scan van hetzelfde adres | in behandeling | `531e082` |
| 7 | Huisnummer onzichtbaar bij lange straatnaam | open | `?` |

### Kaart

| Punt | Omschrijving | Status | Commit |
|:--|:--|:--|:--|
| K1 | Nummers tonen bezorgvolgorde in plaats van pakketnummers | gedaan | zie tweede ronde punt 1 |
| K2 | Tijdsindicatie zonder bezorgtijd per pakje | gedaan | `268511c` |
| K3 | Echte route tekenen | vervallen | — |

## Koeriersfeedback — tweede ronde

| Punt | Omschrijving | Status | Commit |
|:--|:--|:--|:--|
| 1 | Kaart toont bezorgvolgorde in plaats van pakketnummers | gedaan | `?` |
| 2 | Doorklikken naar Google Maps vertrok vanaf de apotheek | gedaan | `39b74b8` |
| 3 | Na een niet-thuis-melding niets meer kunnen wijzigen | in behandeling | zie punt 5 eerste ronde |
| 4 | Scanteller begint opnieuw bij 1 na onderbreken | open | `?` |
| 5 | Opmerking bij "andere reden" zet het pakket op retour terwijl het bezorgd is | gedaan | `?` |
| 6 | Geen duidelijke reactie na het aantikken van "bezorgd" | open | `?` |
| 7 | Bij buren kan alleen een huisnummer worden ingevuld, geen naam | open | `?` |
| 8 | Zelf het laatste adres van de rit kiezen | vervallen | — |
| 9 | Handmatig invoeren vereist een volledige postcode | open | `?` |
| 10 | Meerdere apotheken op één rit | vervallen | — |

## Toelichting — eerste ronde

**1 — Camera blijft live.** De foto was altijd al klaar op het moment van de flits; de camera bleef alleen zichtbaar tijdens de 6-7 seconden Gemini-verwerking. Opgelost met een banner "📸 Foto gemaakt — je kunt verder scannen", gekoppeld aan `pendingScans`.

**2 — Omgekeerd sorteren.** Vóór routeoptimalisatie aflopend op `scanNumber` (nieuwste bovenaan), erna oplopend op `routeIndex` (eerste stop bovenaan). De modus wordt één keer voor de hele lijst bepaald.

**3 — Verwijderd pakket blijft staan.** Bevestigd in de code: `CourierView.tsx:166` retourneert `[...sortedActionable, ...sortedDone, ...removed]`, dus `REMOVED`-pakketten staan onderaan de lijst met `opacity-60` in plaats van eruit te verdwijnen. Geen commit gevonden die dit adresseert. Te beslissen: helemaal verbergen, of achter een "toon verwijderde"-schakelaar.

**4 — Opmerkingenveld.** Bewuste keuze om dit niet te bouwen.

**5 — Afgeleverd en niet-thuis terugdraaien.** Elke afgeronde tegel heeft een "Wijzigen"-chip in de statusrij die de statusknoppen terugbrengt, voor alle eindstatussen. `REMOVED` vraagt eerst om bevestiging; afgeleverd en niet-thuis ontgrendelen direct.

Verloop: `6edf051` gaf alleen `DELIVERED` een tekstknop op ~1,9:1 contrast. `fa6f9c5` verving die door een long-press van 800 ms met een hint op ~1,7:1 — dekking van alle statussen, maar de vindbaarheid ging erop achteruit. Daarna vervangen door een aantikbare chip met rand en pictogram op 5,86:1, waarmee de long-press-machinerie volledig is verwijderd.

**Staat op "in behandeling", niet op "gedaan": geen van deze drie varianten is op een toestel bevestigd.** Te controleren: of de chip met 44 px raakhoogte goed te raken is naast de statusbadge, en of de bevestigingsdialoog bij `REMOVED` op iOS niet in de weg zit.

**6 — Melding bij tweede scan.** Gebouwd op de gedeelde helper `utils/addressKey.ts`: amber melding in het scankader, eigen attentietoon, en een amber label op de tegels. Blokkeert niets — het pakket wordt altijd toegevoegd. **Nog niet op een toestel bevestigd.** Bijbehorende openstaande melding: een tweede pakket op hetzelfde adres verdween in de praktijk; de tijdelijke `[DubbelAdres]`-logging uit `ad6f8dd` staat nog live om dat te herleiden. Mogelijk dezelfde oorzaak als de verlopen sessie (zie Openstaande diagnostiek).

**7 — Huisnummer onzichtbaar.** Bevestigd in de code: `CourierView.tsx:678` zet `truncate` op de regel `{street} {houseNumber}`, dus bij een lange straatnaam valt juist het huisnummer weg — het deel dat de koerier nodig heeft. Geen commit gevonden. Mogelijke oplossingen: huisnummer in een apart element dat niet meekrimpt (`shrink-0`), of de straatnaam laten afbreken in plaats van de hele regel.

**K1 — Nummering op de kaart.** Zelfde onderwerp als punt 1 van de tweede ronde; wat er is gebeurd staat daar.

**K2 — Tijdsindicatie.** De rijtijd kwam al van de Google Routes API, maar zonder stoptijd. Nu inclusief bezorgtijd per adres, getoond als "Totaal ~Z min (indicatie)" met de splitsing eronder.

**K3 — Echte route tekenen.** Vervallen wegens API-kosten. De rechte lijnen tussen stops blijven.

## Toelichting — tweede ronde

**1 — Kaart toont bezorgvolgorde in plaats van pakketnummers.** *(zelfde punt als K1 eerste ronde)*

De markers kwamen uit `coords` — de leg-punten van de Routes API (`maps.ts:117-121`), inclusief vertrek- en eindpunt. Bij de standaard "vanaf apotheek, terug naar apotheek" bevatte `coords` twee elementen méér dan er pakketten zijn, en bij meer dan 25 stops werden de coords van meerdere clusters aan elkaar geplakt. Marker 1 was dus de apotheek, en `coords[i]` verwees niet naar `orderedIds[i]`.

Opgelost door de markers uit de geordende pakketten te renderen. `coords` voedt alleen nog de `Polyline`, zodat de lijn de werkelijke route blijft volgen. Op de marker staat het **scannummer** — het nummer dat de koerier fysiek op het pakje schrijft. Bewust geen routepositie erbij: twee getallen zijn op 26 px onleesbaar. De volgorde blijft afleesbaar uit de lijn.

Vertrek- en eindpunt hebben nu een eigen marker: kleiner, zonder nummer, donkerblauw voor vertrek en oranje voor eind. Ze worden alleen getekend als ze niet samenvallen met het eerste of laatste pakket (marge ~20 m) — zonder extern startpunt ís `coords[0]` het eerste pakket.

De stops-teller telt nu pakketten in plaats van `coords.length`, en heet "pakketten".

**Pakketten zonder coördinaten krijgen geen marker.** Ze worden niet stil weggelaten maar boven de kaart genoemd met scannummer en adres, met de zin dat ze wel bezorgd moeten worden. `FitBounds` neemt de pakketposities mee, zodat er niets buiten beeld valt als de Routes API weinig teruggaf.

**2 — Doorklikken naar Google Maps.** `handleNavigate` bepaalde een `origin` op basis van de positie in de lijst: bij de eerste stop het apotheekadres, daarna het adres van de vorige stop. Omdat afgehandelde pakketten uit die lijst verdwijnen, is het doelpakket bijna altijd de eerste — dus kreeg de koerier telkens de route vanaf de apotheek. De hele `originParam`-berekening is verwijderd; zonder `origin` vertrekt Google Maps vanaf de GPS-positie van het toestel. `handleNavigateToInstitution` had deze constructie niet en is ongewijzigd.

**3 — Niets meer kunnen wijzigen na niet-thuis.** Zelfde onderwerp als punt 5 van de eerste ronde; daar staat het verloop en wat er nog te controleren is.

**4 — Scanteller begint opnieuw bij 1.** **Geblokkeerd: er is geen ritbegrip om de teller aan te hangen.**

`nextScanNumberRef = useRef(1)` staat op 1 bij elke mount van `App` en wordt nergens hersteld. Commit `2b6e2bb` verwijderde de initialisatie die hem op `todayMax + 1` zette. Die berekening liep over álle opgehaalde pakketten van vandaag, dus over alle koeriers heen: koerier B die na koerier A begon, startte bij #41. Het weghalen was terecht; wat ontbreekt is een grens die wél klopt.

`handleNewRit` is die grens niet. Het toont een bevestiging en verwijdert de pakketten van deze koerier uit de **lokale** state — er wordt niets weggeschreven en er is geen rit-id. Na een herlaad haalt `fetchPackages` alles terug en toont `visiblePackages` ze weer, want dat filtert op `courierId` plus datum. "Gearchiveerd" is dus niet wat er gebeurt.

Los daarvan: `App.tsx:399-402` kent `scanNumber` retroactief toe met `pkg.scanNumber ?? index + 1`. Bestaande nummers worden niet overschreven, maar de `index` loopt over de volledige opgehaalde lijst, gesorteerd op `createdAt` — de comment erboven zegt "per apotheek", de code groepeert nergens op. Alleen in het geheugen, tenzij het pakket later wordt gesynct.

Drie mogelijke afbakeningen, oplopend in ingrijpendheid — hier is een keuze nodig voordat er iets gebouwd wordt:

1. **Teller uit de eigen pakketten van vandaag.** Bij het laden `max(scanNumber)` nemen over pakketten met de eigen `courierId` én van vandaag. Geen schemawijziging. Nadeel: twee ritten op één dag lopen door in plaats van opnieuw te beginnen.
2. **Rit-id op het pakket.** Een `ritId`-kolom die `handleNewRit` roteert, teller uit `max(scanNumber)` binnen de huidige `ritId`. Klopt altijd, maar vraagt een kolom — past in het schema-werk van week 1.
3. **Teller in localStorage naast `courierPharmacyIds`.** Snel, maar gaat verloren bij een ander toestel of gewiste opslag, en het scannummer staat fysiek op het pakje.

**5 — "Andere reden" zet het pakket op retour.** `NotHomeSheet.tsx` had zes opties maar vijf statussen: `custom` mapte op `RETURN`. Wie "in de schuur gelegd" typte, zag de apotheek als retour, en de patiënt kreeg via Track & Trace te horen dat zijn medicijnen waren teruggebracht.

Opgelost met een nieuwe status **`NOT_HOME`** — patiënt niet thuis, afgehandeld volgens de toelichting van de koerier. Hernoemen kon niet: `RETURN` wordt ook gezet door de optie "Terug naar apotheek", waar hij correct is.

`NOT_HOME` en `OTHER_LOCATION` tellen allebei **niet** als bezorgd. In beide gevallen weet de app niet wat er met het pakket is gebeurd, en bij medicijnen is niet-weten hetzelfde als niet-zeker-afgeleverd. `OTHER_LOCATION` is daarom uit de bezorgd-set van `track-and-trace.ts` gehaald, waar hij als enige plek wél als bezorgd telde.

`NOT_HOME` is ontgrendelbaar via de Wijzigen-chip, net als de andere eindstatussen — dat volgt automatisch uit `isActionable`.

**De bestaande rijen worden bewust niet gecorrigeerd.** Het opschoonbestand staat klaar in `supabase/cleanup_notHome.sql`, maar wordt niet uitgevoerd: bij de livegang gaat de data er toch uit, en tot die tijd kijkt niemand naar deze pakketten behalve de beheerder zelf. De bestanden blijven staan voor het geval dat verandert.

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

## Openstaande data-opschoning

**Verweesde `deliveredAt`-waarden.** `updateMultipleStatus` behield het bezorgtijdstip bij elke statuswijziging zonder evidence, dus een pakket dat werd teruggezet naar `ASSIGNED` hield zijn oude `deliveredAt`. Dat werkt door in de urenberekening (`lastDelivery` → `totalHours` → gefactureerde uren, in `supabaseService.ts` en `netlify/functions/users-overview.ts`) en in het tijdstip dat Track & Trace aan de patiënt toont.

De code schrijft ze niet meer: bij een status in de actieve groep of `REMOVED` wordt `deliveredAt` nu expliciet op `null` gezet.

**De bestaande rijen staan er nog.** Opschoonqueries staan klaar in `supabase/cleanup_deliveredAt.sql` — bewust buiten `supabase/migrations/` zodat ze niet met een deploy meelopen. Volgorde: eerst tellen, dan de risicoquery, dan pas de update. Nog niet uitgevoerd.

## Ontbrekende controles

**Er bestaat geen ritcontrole.** Nergens wordt gecontroleerd of alles van vandaag is afgehandeld. Wat er is, zijn tellers zonder bewaking:

| Wat | Waar | Kijkt naar |
|:--|:--|:--|
| `actionableCount` / `doneCount` / voortgangspercentage | `CourierView.tsx` | `status` via `isActionable` |
| `"{n} te bezorgen · {n} klaar"` | `CourierView.tsx` | idem |
| `"Alle stops afgerond"` | `CourierView.tsx`, stops-lijst | `stops.length === 0` |
| `canFinish` | `Scanner.tsx` | `pendingScans` — gaat over Gemini-verwerking, niet over bezorging |
| `deliveryRate` per apotheek | `PharmacyOverview.tsx` | `status` |

Geen daarvan blokkeert of waarschuwt. "Nieuwe rit starten" (`handleNewRit`) vraagt alleen "Nieuwe rit starten? De huidige rit wordt gearchiveerd" en verwijdert de pakketten van deze koerier uit de lokale state, ongeacht hoeveel er nog op `ASSIGNED` of `PICKED_UP` staan. Een koerier kan dus met onbezorgde pakketten een nieuwe rit beginnen zonder dat iets dat opmerkt.

Te beslissen: waarschuwing bij het starten van een nieuwe rit met openstaande pakketten, en of er een dagafsluiting hoort te zijn die de apotheek meldt wat er is blijven liggen.

## Eén definitie van bezorgd

Er stonden **vier** verschillende definities in de code:

| Waar | Set |
|:--|:--|
| `PharmacyOverview.tsx:12` | DELIVERED, MAILBOX, NEIGHBOUR, BILLED |
| `SinglePharmacyDashboard.tsx:182` | DELIVERED, MAILBOX, NEIGHBOUR, BILLED |
| `track-and-trace.ts:7` | DELIVERED, MAILBOX, NEIGHBOUR, **OTHER_LOCATION** |
| `archiveService.ts:60` en `:88` | DELIVERED, MAILBOX, NEIGHBOUR (zonder BILLED) |

Samengebracht in **`utils/packageStatus.ts`**: `DELIVERED_STATUSES` (enum-set), `isDelivered()`, `DELIVERED_STATUS_VALUES` (kale strings voor de Netlify-functies) en `NEEDS_FOLLOW_UP_STATUSES` — de oude `RETURNED_STATUSES`, nu inclusief `NOT_HOME`.

`BILLED` telt mee: factureren kan alleen na een geslaagde bezorging. Dat `archiveService` hem miste was een omissie, geen keuze.

**Eén verschil is bewust blijven bestaan:** `CourierView.tsx:70` heeft `const done = [DELIVERED, MAILBOX, NEIGHBOUR]`. Dat is geen telling maar een kleurgroepering voor de statusbadge — welk label groen is. `BILLED` komt in de koeriersweergave niet voor. Die lijst is dus niet omgezet.

## Bekende techniek-schuld

- **`tsc --noEmit` checkt nul bestanden.** `tsconfig.json` heeft `"include": ["src"]` terwijl alle bronbestanden in de root staan. Een echte typecheck vereist een tijdelijke config die `App.tsx`, `Scanner.tsx`, `components`, `services` en `utils` meeneemt. Baseline: 15 fouten (2 `App.tsx`, 2 `ArchiveView.tsx`, 8 `DienstCheck.tsx`, 3 `supabaseService.ts`).
- **De `packages`-tabel staat niet in `supabase/migrations/`.** Migraties 001-012 maken hem niet aan; het schema is buiten versiebeheer om aangelegd. Constraints en indexen op die tabel zijn daardoor niet uit de repo af te leiden.
- **`onUpdate` is een lege stub.** `App.tsx` geeft `onUpdate={() => {}}` door aan `CourierView`; alle statuswijzigingen lopen via `onUpdateMany`. Een aanroep van `onUpdate` doet stil niets.
- **`verifyAuth` logt alleen in `gemini.ts`.** `maps.ts`, `pdok.ts` en de overige functies gebruiken dezelfde helper en hebben nog steeds een onzichtbaar auth-faalpad.
