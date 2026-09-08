#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genereer alle GoBob-assets uit één bron-PNG.

Gebruik:
    python scripts/build-assets.py [bronbestand.png]

Zonder argument zoekt het script naar een PNG in de projectroot waarvan de naam
"gobob" bevat. Alle uitvoer gaat naar public/ en wordt overschreven.

Stappen:
  1. witte achtergrond wegrekenen (met kleurherstel op de randen), croppen
  2. de lockup splitsen in figuur (mark) en woordmerk via de lege strook ertussen
  3. iconen + favicon uit de mark
  4. horizontaal logo (mark links, woordmerk rechts)
  5. gestapeld logo (de volledige lockup)
  6. 11 iOS-splashscreens
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
ICONS = PUBLIC / 'icons'
SPLASH = PUBLIC / 'splash'

# --- stap 1: wegrekenen van de witte achtergrond -----------------------------
# De bron is over wit gerenderd, dus elke randpixel is een mengsel:
#     waargenomen = kleur * alpha + wit * (1 - alpha)
# Uit het laagste kleurkanaal volgt de alpha. EDGE_REF is het laagste kanaal
# van de donkerste merkkleur: alles wat minstens zo "vol" is wordt dekkend.
# Te hoog, en lichte delen van het logo worden half doorzichtig; te laag, en de
# randen blijven hard.
EDGE_REF = 0.20
WHITE_BG = 0.88    # laagste kanaal hierboven telt als achtergrondwit
EDGE_BAND = 5      # breedte (px) van de zone rond de achtergrond met zachte alpha
NOISE_FLOOR = 0.10 # alpha hieronder in de achtergrond telt als ruis en wordt 0

# --- stap 3: marges (fractie van de zijde, aan één kant) ---------------------
MARGIN_ANY = 0.08       # transparante iconen
MARGIN_MASKABLE = 0.20  # veilige zone voor maskable iconen
MARGIN_APPLE = 0.14     # apple-touch-icon

# --- stap 4: maten van het horizontale logo ---------------------------------
H_MARK_HEIGHT = 88
H_WORD_HEIGHT = 52
H_GAP = 18

STACKED_HEIGHT = 400

# --- witte variant voor donkere achtergronden -------------------------------
# In de figuur wordt alleen het donkere deel wit; het groene vierkant met het
# witte kruis blijft zoals het is. Het onderscheid gaat op HELDERHEID, niet op
# verzadiging: het donkerblauw meet RGB(24,24,46) met verzadiging 0,49 en ligt
# daarmee te dicht bij het groen (0,65) om daarop te scheiden. De helderheid
# scheidt wel ruim: 0,18 tegen 0,70. Tussen de twee grenzen loopt de overgang
# vloeiend, zodat randpixels tussen figuur en vierkant niet omslaan.
WHITE_VARIANT_V_LO = 0.30
WHITE_VARIANT_V_HI = 0.55

SPLASH_SIZES = [
    (750, 1334), (828, 1792), (1125, 2436), (1170, 2532), (1179, 2556),
    (1206, 2622), (1242, 2208), (1242, 2688), (1284, 2778), (1290, 2796),
    (1320, 2868),
]
SPLASH_LOGO_FRACTION = 0.55  # breedte van de lockup t.o.v. de schermbreedte

WHITE = (255, 255, 255, 255)


def find_source() -> Path:
    if len(sys.argv) > 1:
        src = Path(sys.argv[1])
        if not src.is_absolute():
            src = ROOT / src
        if not src.exists():
            sys.exit('Bronbestand niet gevonden: %s' % src)
        return src

    kandidaten = sorted(p for p in ROOT.glob('*.png') if 'gobob' in p.name.lower())
    if not kandidaten:
        kandidaten = sorted(ROOT.glob('*.png'))
    if not kandidaten:
        sys.exit('Geen PNG in de projectroot. Geef het pad mee: '
                 'python scripts/build-assets.py <bestand.png>')
    if len(kandidaten) > 1:
        print('Meerdere kandidaten gevonden, eerste wordt gebruikt:')
        for k in kandidaten:
            print('   ', k.name)
    return kandidaten[0]


def vind_achtergrond(whiteish: np.ndarray) -> np.ndarray:
    """Alleen wit dat vanaf de rand bereikbaar is telt als achtergrond.

    Zonder deze stap zou het witte kruis in het groene vlak net zo goed
    weggesneden worden, en dan schijnt op een donkere ondergrond de
    achtergrond door het kruis heen.
    """
    # .copy() is nodig: een beeld uit Image.fromarray is read-only en dan doet
    # floodfill stilzwijgend niets.
    masker = Image.fromarray(np.where(whiteish, 255, 0).astype(np.uint8), 'L').copy()
    for hoek in ((0, 0), (masker.width - 1, 0),
                 (0, masker.height - 1), (masker.width - 1, masker.height - 1)):
        if masker.getpixel(hoek) == 255:
            ImageDraw.floodfill(masker, hoek, 128)
    return np.asarray(masker) == 128


def maak_transparant(img: Image.Image, vul_gaten: bool = True) -> Image.Image:
    """Reken de witte achtergrond weg en herstel de kleur van de randpixels.

    `vul_gaten` bepaalt wat er gebeurt met wit dat volledig ingesloten is:
    met True blijft het dekkend (het witte kruis in het groene vlak), met False
    wordt het transparant (de binnenruimtes van letters als o, B en b).
    Beide zijn topologisch identiek, dus het onderscheid komt van buitenaf:
    de figuur wordt met True verwerkt, het woordmerk met False.
    """
    rgba = np.asarray(img.convert('RGBA'), dtype=np.float32) / 255.0
    rgb = rgba[..., :3]
    laagste = rgb.min(axis=-1)

    alpha = np.clip((1.0 - laagste) / (1.0 - EDGE_REF), 0.0, 1.0)

    achtergrond = vind_achtergrond(laagste > WHITE_BG)

    if vul_gaten:
        # Buiten de achtergrond en de smalle randzone blijft alles dekkend.
        randzone = np.asarray(
            Image.fromarray(np.where(achtergrond, 255, 0).astype(np.uint8), 'L')
                 .filter(ImageFilter.MaxFilter(EDGE_BAND))) > 0
        alpha = np.where(randzone, alpha, 1.0)

    # De achtergrond van een gegenereerde PNG is zelden exact 255,255,255. Zonder
    # deze ondergrens houdt elke achtergrondpixel een restje alpha, en dan levert
    # getbbox() het hele doek op in plaats van het logo.
    alpha = np.where(alpha < NOISE_FLOOR, 0.0, alpha)

    # bestaande alpha uit de bron respecteren
    alpha = alpha * rgba[..., 3]

    # de menging met wit terugdraaien, anders houden halfwitte randpixels hun
    # lichtgrijze kleur en zie je een halo op een donkere ondergrond
    veilig = np.maximum(alpha, 1e-4)[..., None]
    kleur = np.clip((rgb - (1.0 - veilig)) / veilig, 0.0, 1.0)
    rgb = np.where(alpha[..., None] > 1e-3, kleur, rgb)

    uit = np.dstack([rgb, alpha])
    return Image.fromarray((uit * 255.0 + 0.5).astype(np.uint8), 'RGBA')


def smoothstep(edge0: float, edge1: float, x):
    """Vloeiende overgang van 0 naar 1 tussen edge0 en edge1."""
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def verwit(img: Image.Image, alles: bool) -> Image.Image:
    """Maak het beeld wit met behoud van alpha, dus inclusief de antialiasing.

    Met `alles` wordt élke pixel wit (voor het woordmerk, waar ook de groene
    "Go" wit moet worden). Zonder `alles` blijven heldere pixels ongemoeid,
    zodat het groene vierkant en het witte kruis in de figuur blijven staan.
    """
    arr = np.asarray(img.convert('RGBA'), dtype=np.float32) / 255.0
    rgb = arr[..., :3]

    if alles:
        factor = np.ones(rgb.shape[:2], dtype=np.float32)
    else:
        helderheid = rgb.max(axis=-1)
        factor = 1.0 - smoothstep(WHITE_VARIANT_V_LO, WHITE_VARIANT_V_HI, helderheid)

    f = factor[..., None]
    nieuw = rgb * (1.0 - f) + f  # naar 1.0 = wit
    uit = np.dstack([np.clip(nieuw, 0.0, 1.0), arr[..., 3]])
    return Image.fromarray((uit * 255.0 + 0.5).astype(np.uint8), 'RGBA')


def crop_alpha(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    if bbox is None:
        sys.exit('Na het wegmaskeren is het beeld volledig leeg. '
                 'Controleer WHITE_BG/EDGE_REF in dit script.')
    return img.crop(bbox)


def vind_snijlijn(img: Image.Image) -> int:
    """Geef het midden van de langste lege horizontale strook."""
    alpha = np.asarray(img)[..., 3]
    per_rij = (alpha > 8).sum(axis=1)

    # rijen zonder noemenswaardige inhoud; 0,3% van de breedte als ruisdrempel
    ruis = max(1, int(img.width * 0.003))
    leeg = per_rij <= ruis

    beste_start, beste_len = None, 0
    start = None
    for y, is_leeg in enumerate(leeg):
        if is_leeg:
            if start is None:
                start = y
        else:
            if start is not None:
                if y - start > beste_len:
                    beste_start, beste_len = start, y - start
                start = None
    if start is not None and len(leeg) - start > beste_len:
        beste_start, beste_len = start, len(leeg) - start

    if beste_start is None or beste_len < 2:
        sys.exit('Geen lege strook tussen figuur en woordmerk gevonden. '
                 'Staat het woordmerk wel onder de figuur?')

    vind_snijlijn.laatste_gap = (beste_start, beste_len)
    return beste_start + beste_len // 2


def split_lockup(img: Image.Image, snij: int):
    """Snijd de lockup op `snij` in figuur en woordmerk, beide strak gecropt."""
    mark = crop_alpha(img.crop((0, 0, img.width, snij)))
    woord = crop_alpha(img.crop((0, snij, img.width, img.height)))
    start, lengte = getattr(vind_snijlijn, 'laatste_gap', (snij, 0))
    return mark, woord, {'gap_start': start, 'gap_hoogte': lengte, 'snijlijn': snij}


def resize_rgba(img: Image.Image, size) -> Image.Image:
    """Verklein met LANCZOS in premultiplied space.

    Pillow schaalt R, G, B en A los van elkaar. Volledig transparante pixels
    dragen nog steeds hun (witte) RGB-waarde, en die bloedt bij het verkleinen
    de randen in — opnieuw zichtbaar als halo. Door eerst met alpha te
    vermenigvuldigen telt die kleur niet mee; achteraf delen we hem eruit.
    """
    arr = np.asarray(img.convert('RGBA'), dtype=np.float32) / 255.0
    a = arr[..., 3:4]
    pre = np.dstack([arr[..., :3] * a, arr[..., 3]])
    klein = np.asarray(
        Image.fromarray((pre * 255.0 + 0.5).astype(np.uint8), 'RGBA')
             .resize(size, Image.LANCZOS),
        dtype=np.float32) / 255.0

    a2 = np.maximum(klein[..., 3:4], 1e-4)
    rgb = np.clip(klein[..., :3] / a2, 0.0, 1.0)
    uit = np.dstack([rgb, np.clip(klein[..., 3], 0.0, 1.0)])
    return Image.fromarray((uit * 255.0 + 0.5).astype(np.uint8), 'RGBA')


def op_hoogte(img: Image.Image, hoogte: int) -> Image.Image:
    breedte = max(1, round(img.width * hoogte / img.height))
    return resize_rgba(img, (breedte, hoogte))


def vierkant_icoon(mark: Image.Image, zijde: int, marge: float,
                   achtergrond=None) -> Image.Image:
    """Plaats de mark gecentreerd op een vierkant canvas."""
    beschikbaar = zijde * (1.0 - 2.0 * marge)
    schaal = min(beschikbaar / mark.width, beschikbaar / mark.height)
    nieuw = (max(1, round(mark.width * schaal)), max(1, round(mark.height * schaal)))
    geschaald = resize_rgba(mark, nieuw)

    canvas = Image.new('RGBA', (zijde, zijde), achtergrond or (0, 0, 0, 0))
    canvas.alpha_composite(geschaald,
                           ((zijde - nieuw[0]) // 2, (zijde - nieuw[1]) // 2))
    return canvas


def bouw_horizontaal(mark: Image.Image, woord: Image.Image) -> Image.Image:
    """Figuur links, woordmerk rechts, verticaal gecentreerd, transparant."""
    h_mark = op_hoogte(mark, H_MARK_HEIGHT)
    h_woord = op_hoogte(woord, H_WORD_HEIGHT)
    breedte = h_mark.width + H_GAP + h_woord.width
    hoogte = max(h_mark.height, h_woord.height)

    doek = Image.new('RGBA', (breedte, hoogte), (0, 0, 0, 0))
    doek.alpha_composite(h_mark, (0, (hoogte - h_mark.height) // 2))
    doek.alpha_composite(h_woord,
                         (h_mark.width + H_GAP, (hoogte - h_woord.height) // 2))
    return doek


def plak_op_wit(img: Image.Image) -> Image.Image:
    """Vlak de alpha af op wit (iOS negeert alpha en maakt er anders zwart van)."""
    bg = Image.new('RGBA', img.size, WHITE)
    bg.alpha_composite(img)
    return bg.convert('RGB')


def main():
    src = find_source()
    print('Bron: %s' % src)

    origineel = Image.open(src)
    print('  formaat %dx%d, modus %s' % (origineel.width, origineel.height, origineel.mode))

    # Twee varianten op dezelfde uitsnede: één met ingesloten wit dekkend (voor
    # de figuur, zodat het kruis blijft staan) en één met ingesloten wit
    # transparant (voor het woordmerk, zodat de letters hun gaten houden).
    open_versie = maak_transparant(origineel, vul_gaten=False)
    bbox = open_versie.getbbox()
    if bbox is None:
        sys.exit('Na het wegmaskeren is het beeld volledig leeg. '
                 'Controleer WHITE_BG/EDGE_REF in dit script.')
    open_versie = open_versie.crop(bbox)
    gevuld = maak_transparant(origineel, vul_gaten=True).crop(bbox)
    print('  na wegmaskeren + crop: %dx%d' % open_versie.size)

    snij = vind_snijlijn(open_versie)
    lockup = gevuld.copy()
    lockup.paste(open_versie.crop((0, snij, open_versie.width, open_versie.height)),
                 (0, snij))

    mark, woord, diag = split_lockup(lockup, snij)
    print('  lege strook: y=%d t/m y=%d (%d px hoog), snijlijn y=%d'
          % (diag['gap_start'], diag['gap_start'] + diag['gap_hoogte'] - 1,
             diag['gap_hoogte'], diag['snijlijn']))
    print('  figuur:     %dx%d' % mark.size)
    print('  woordmerk:  %dx%d' % woord.size)

    ICONS.mkdir(parents=True, exist_ok=True)
    SPLASH.mkdir(parents=True, exist_ok=True)

    # --- stap 3: iconen ------------------------------------------------------
    for zijde in (192, 512):
        vierkant_icoon(mark, zijde, MARGIN_ANY).save(ICONS / ('icon-%d.png' % zijde))
        print('  icons/icon-%d.png' % zijde)

    for zijde in (192, 512):
        icoon = vierkant_icoon(mark, zijde, MARGIN_MASKABLE, achtergrond=WHITE)
        icoon.save(ICONS / ('icon-%d-maskable.png' % zijde))
        print('  icons/icon-%d-maskable.png' % zijde)

    apple = vierkant_icoon(mark, 180, MARGIN_APPLE, achtergrond=WHITE)
    plak_op_wit(apple).save(ICONS / 'apple-touch-icon-180.png')
    print('  icons/apple-touch-icon-180.png (ondoorzichtig)')

    favicon_bron = vierkant_icoon(mark, 256, MARGIN_ANY)
    favicon_bron.save(PUBLIC / 'favicon.ico', format='ICO',
                      sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('  favicon.ico (16/32/48/64)')

    # --- stap 4: horizontaal logo -------------------------------------------
    horizontaal = bouw_horizontaal(mark, woord)
    horizontaal.save(PUBLIC / 'gobob-logo-horizontal.png')
    breedte, hoogte = horizontaal.size
    print('  gobob-logo-horizontal.png: %dx%d (verhouding %.2f:1)'
          % (breedte, hoogte, breedte / hoogte))

    wit_h = bouw_horizontaal(verwit(mark, alles=False), verwit(woord, alles=True))
    wit_h.save(PUBLIC / 'gobob-logo-horizontal-white.png')
    print('  gobob-logo-horizontal-white.png: %dx%d' % wit_h.size)

    # --- stap 5: gestapeld logo ---------------------------------------------
    gestapeld = op_hoogte(lockup, STACKED_HEIGHT)
    gestapeld.save(PUBLIC / 'gobob-logo-stacked.png')
    print('  gobob-logo-stacked.png: %dx%d' % gestapeld.size)

    # witte variant: boven de snijlijn alleen het donkere deel, eronder alles
    wit_lockup = Image.new('RGBA', lockup.size, (0, 0, 0, 0))
    wit_lockup.paste(verwit(lockup.crop((0, 0, lockup.width, snij)), alles=False), (0, 0))
    wit_lockup.paste(
        verwit(lockup.crop((0, snij, lockup.width, lockup.height)), alles=True),
        (0, snij))
    wit_gestapeld = op_hoogte(wit_lockup, STACKED_HEIGHT)
    wit_gestapeld.save(PUBLIC / 'gobob-logo-stacked-white.png')
    print('  gobob-logo-stacked-white.png: %dx%d' % wit_gestapeld.size)

    # --- stap 6: splashscreens ----------------------------------------------
    for breedte_s, hoogte_s in SPLASH_SIZES:
        doel_breedte = round(breedte_s * SPLASH_LOGO_FRACTION)
        schaal = doel_breedte / lockup.width
        logo = resize_rgba(
            lockup, (doel_breedte, max(1, round(lockup.height * schaal))))

        canvas = Image.new('RGBA', (breedte_s, hoogte_s), WHITE)
        canvas.alpha_composite(logo, ((breedte_s - logo.width) // 2,
                                      (hoogte_s - logo.height) // 2))
        naam = 'apple-splash-%d-%d.png' % (breedte_s, hoogte_s)
        canvas.convert('RGB').save(SPLASH / naam)
    print('  splash/: %d schermen' % len(SPLASH_SIZES))

    print('\nKlaar. Horizontaal logo: %dx%d' % (breedte, hoogte))


if __name__ == '__main__':
    main()
