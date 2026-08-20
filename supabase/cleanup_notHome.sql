-- Corrigeren van bestaande "andere reden"-pakketten: RETURN -> NOT_HOME
--
-- GEEN AUTOMATISCHE MIGRATIE. Dit bestand staat bewust buiten supabase/migrations/
-- zodat het niet meeloopt met een deploy. Handmatig draaien in de SQL-editor,
-- query voor query, in de volgorde hieronder.
--
-- Aanleiding: NotHomeSheet mapte de optie "Andere reden" (key `custom`) op
-- PackageStatus.RETURN. Een koerier die "in de schuur gelegd" typte, liet de
-- apotheek een retour zien en gaf de patiënt via Track & Trace te horen dat zijn
-- medicijnen waren teruggebracht. Sinds commit b33d116 zet de app daar NOT_HOME,
-- maar de bestaande rijen staan nog op RETURN.
--
-- DOELGROEP: status = 'RETURN' EN "deliveryEvidence"->>'notHomeOption' = 'custom'
--
-- NIET RAKEN: elke andere RETURN-rij. De optie "Terug naar apotheek" (key
-- `return`) zet dezelfde status en is wél een echt retour. Rijen zonder
-- notHomeOption zijn niet te classificeren en blijven daarom staan.


-- ---------------------------------------------------------------------------
-- 0. Sanity: bestaan de kolommen, en hoe zit deliveryEvidence in elkaar?
-- ---------------------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_name = 'packages'
  and column_name in ('status', 'deliveryEvidence', 'statusHistory');


-- ---------------------------------------------------------------------------
-- 1. TELLEN — hoeveel rijen raakt de update? Draai dit eerst.
--    Niets wordt gewijzigd.
-- ---------------------------------------------------------------------------
select count(*)                     as te_corrigeren,
       min("createdAt")             as oudste,
       max("createdAt")             as nieuwste
from packages
where status = 'RETURN'
  and "deliveryEvidence"->>'notHomeOption' = 'custom';

-- Zelfde groep, met de toelichting erbij — steekproef om te zien of het
-- inderdaad bezorgingen zijn en geen echte retouren.
select id,
       "createdAt",
       "deliveryEvidence"->>'deliveryNote' as toelichting
from packages
where status = 'RETURN'
  and "deliveryEvidence"->>'notHomeOption' = 'custom'
order by "createdAt" desc
limit 25;


-- ---------------------------------------------------------------------------
-- 2. CONTROLE — alle RETURN-rijen uitgesplitst naar notHomeOption.
--    Alleen de regel met 'custom' hoort geraakt te worden. Rijen met 'return'
--    zijn echte retouren; rijen met NULL zijn niet te classificeren en blijven
--    staan. Beide vallen buiten de WHERE van stap 3.
-- ---------------------------------------------------------------------------
select coalesce("deliveryEvidence"->>'notHomeOption', '(geen notHomeOption)') as optie,
       count(*)                                                              as rijen,
       count(*) filter (where "deliveryEvidence" is null)                    as waarvan_zonder_evidence
from packages
where status = 'RETURN'
group by 1
order by rijen desc;


-- ---------------------------------------------------------------------------
-- 3. VANGNET — leg vast welke rijen je gaat wijzigen.
--
--    Dit is hier belangrijker dan bij cleanup_deliveredAt.sql: de app schrijft
--    sinds b33d116 zélf NOT_HOME met notHomeOption 'custom'. Een terugdraaiing
--    op alleen die twee kenmerken zou dus ook nieuwe, correcte rijen raken.
--    Met deze tabel is het terugdraaien exact.
-- ---------------------------------------------------------------------------
-- create table if not exists packages_nothome_backup as
-- select id, status as oude_status, now() as gecorrigeerd_op
-- from packages
-- where status = 'RETURN'
--   and "deliveryEvidence"->>'notHomeOption' = 'custom';
--
-- select count(*) from packages_nothome_backup;


-- ---------------------------------------------------------------------------
-- 4. CORRIGEREN — pas draaien als stap 1 t/m 3 kloppen.
-- ---------------------------------------------------------------------------
-- update packages
-- set status = 'NOT_HOME'
-- where status = 'RETURN'
--   and "deliveryEvidence"->>'notHomeOption' = 'custom';


-- ---------------------------------------------------------------------------
-- 5. OPTIONEEL — de correctie in statusHistory vastleggen.
--
--    De app appendt bij elke statuswijziging een event; een kale UPDATE doet dat
--    niet. Zonder deze stap eindigt de historie op een RETURN-event terwijl de
--    status NOT_HOME is. Alleen draaien als de kolom statusHistory bestaat
--    (zie stap 0).
-- ---------------------------------------------------------------------------
-- update packages p
-- set "statusHistory" = coalesce(p."statusHistory", '[]'::jsonb) || jsonb_build_array(
--       jsonb_build_object(
--         'status',    'NOT_HOME',
--         'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
--         'note',      'Statuscorrectie: "andere reden" was ten onrechte RETURN'
--       ))
-- from packages_nothome_backup b
-- where p.id = b.id;


-- ---------------------------------------------------------------------------
-- 6. CONTROLE ACHTERAF
-- ---------------------------------------------------------------------------
-- Hoort 0 te geven: geen enkele RETURN meer met notHomeOption 'custom'.
select count(*) as resterend
from packages
where status = 'RETURN'
  and "deliveryEvidence"->>'notHomeOption' = 'custom';

-- Echte retouren moeten onaangeroerd zijn — vergelijk met de telling uit stap 2.
select count(*) as echte_retouren
from packages
where status = 'RETURN';


-- ---------------------------------------------------------------------------
-- TERUGDRAAIEN — exact, op basis van de vangnet-tabel uit stap 3.
-- Draai dit NIET zonder die tabel: op status + notHomeOption alleen zou je ook
-- de rijen raken die de app sindsdien correct als NOT_HOME heeft weggeschreven.
-- ---------------------------------------------------------------------------
-- update packages p
-- set status = b.oude_status
-- from packages_nothome_backup b
-- where p.id = b.id;
--
-- drop table packages_nothome_backup;
