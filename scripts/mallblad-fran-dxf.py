"""Gör om en ritningsram i DXF till linjer och texter för ett mallblad (0.8.8).

Ett verktyg för utvecklingen, inte en del av appen (att göra om DXF i appen
ligger efter pilotprojektet). Läser DXF med ezdxf och skriver JSON med
elementens typ och parametrar (Shape2D och Text) i mm på papperet, med
nollpunkten i papperets nedre vänstra hörn. Bara det som ligger på papperet
tas med. Linjebredden tas från färgen (gammal-cad-tabellen), texternas
justering från TEXT och MTEXT, och kända platshållare (#DATUM …) blir
smarttext.

    pip install --break-system-packages ezdxf
    python3 -I scripts/mallblad-fran-dxf.py ram.dxf A1 landscape > mall.json

`--utan x0,y0,x1,y1` hoppar över det som ligger helt inom en ruta (t.ex. en
skalstock som inte hör till mallen); `--behall TEXT` behåller ändå texter
som börjar med TEXT. Bygg projektet med
`scripts/mallblad-projekt.mts`.
"""

import argparse
import json
import math
import re
import sys

import ezdxf
from ezdxf.math import Vec3

PAPER = {'A4': (297, 210), 'A3': (420, 297), 'A2': (594, 420), 'A1': (841, 594), 'A0': (1189, 841)}

# Färg (ACI) → linjebredd i mm, som pennorna i gammal-cad: grå, cyan, röd, grön, vit/svart, magenta, blå, gul.
WEIGHT = {8: 0.13, 9: 0.13, 4: 0.18, 1: 0.25, 3: 0.35, 7: 0.5, 6: 0.7, 5: 1.0, 2: 1.4}

# Platshållare i ramen → smarttext.
SMART = {
    '#PROJEKTNAMN': '{projekt}',
    '#DATUM': '{datum}',
    '#RITNINGSNR': '{ritningsnummer}',
    '#RAD 3: RITNINGSNAMN': '{innehåll}',
    '#FÖRHANDSKOPIA': '{skede}',
    '#FASTIGHETSBETECKNING': '{fastighet}',
    '#PROJEKTNR': '{uppdragsnummer}',
    '#REV': '{ändring}',
    '#ARKITEKTKONTOR': '{arkitekt}',
    '#INITIALER MV': '{ritat}',
    '#SIGN ANSVARIG': '{ansvarig}',
    '#SKALA A1 (A1)': '{skala} (A1)',
    '#SKALA A3 (A3)': '{skala a3} (A3)',
    '#MAPPNAMN': '{mapp}',
    '#INITIALER HL': '{Handläggare}',
}


def smart(text):
    """Kända platshållare blir smarttext; andra blir fält: #KOMMUN → {Kommun}, #RAD 2: BYGGNAD → {Byggnad} (0.8.10)."""
    if text in SMART:
        return SMART[text]
    m = re.fullmatch(r'#([^:#{}]+?)(?::([^#{}]+))?', text.strip())
    return '{' + (m.group(2) or m.group(1)).strip().capitalize() + '}' if m else text


def color_of(doc, e):
    c = e.dxf.get('color', 256)
    if c == 256:  # efter lagret
        layer = doc.layers.get(e.dxf.layer)
        c = abs(layer.color) if layer else 7
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dxf')
    ap.add_argument('size', choices=PAPER.keys())
    ap.add_argument('orientation', choices=['landscape', 'portrait'])
    ap.add_argument('--utan', action='append', default=[], help='x0,y0,x1,y1: hoppa över det som ligger helt inom rutan')
    ap.add_argument('--behall', action='append', default=[], help='behåll texter som börjar så, också inom --utan')
    a = ap.parse_args()
    w, h = PAPER[a.size]
    if a.orientation == 'portrait':
        w, h = h, w
    skip = [tuple(float(v) for v in s.split(',')) for s in a.utan]
    doc = ezdxf.readfile(a.dxf)

    def on_paper(*pts):
        return all(-0.01 <= p[0] <= w + 0.01 and -0.01 <= p[1] <= h + 0.01 for p in pts)

    def skipped(*pts):
        return any(all(r[0] <= p[0] <= r[2] and r[1] <= p[1] <= r[3] for p in pts) for r in skip)

    r = lambda v: round(v, 2)
    out = []
    left_out = 0
    for e in doc.modelspace():
        t = e.dxftype()
        if t == 'LINE':
            p, q = e.dxf.start, e.dxf.end
            if not on_paper(p, q) or skipped(p, q):
                left_out += 1
                continue
            out.append({'type': 'Shape2D', 'params': {'shape': 'line', 'points': [[r(p.x), r(p.y)], [r(q.x), r(q.y)]], 'weight': WEIGHT.get(color_of(doc, e), 0.25), 'linetype': 'solid'}})
        elif t in ('TEXT', 'MTEXT'):
            if t == 'TEXT':
                text = e.plain_text().strip()
                height = e.dxf.height
                halign = e.dxf.get('halign', 0)
                at = e.dxf.align_point if halign in (1, 2, 4) and e.dxf.hasattr('align_point') else e.dxf.insert
                align = {1: 'middle', 2: 'end', 4: 'middle'}.get(halign, 'start')
                y = at.y
                angle = e.dxf.get('rotation', 0)
            else:
                text = e.plain_text().strip()
                height = e.dxf.char_height
                ap_ = e.dxf.get('attachment_point', 1)
                at = e.dxf.insert
                align = {0: 'start', 1: 'middle', 2: 'end'}[(ap_ - 1) % 3]
                row = (ap_ - 1) // 3  # 0 överkant, 1 mitt, 2 underkant
                lines = max(1, text.count('\n') + 1)
                block = height * (1.5 * (lines - 1) + 1)
                # Första radens baslinje.
                y = at.y - height if row == 0 else at.y + block / 2 - height if row == 1 else at.y + block - height
                angle = math.degrees(math.atan2(e.dxf.text_direction.y, e.dxf.text_direction.x)) if e.dxf.hasattr('text_direction') else e.dxf.get('rotation', 0)
            if not text or not on_paper(at) or (skipped(at) and not any(text.startswith(k) for k in a.behall)):
                left_out += 1
                continue
            text = smart(text)
            params = {'pos': [r(at.x), r(y)], 'text': text, 'height': r(height), 'angle': r(angle)}
            if align != 'start':
                params['align'] = align
            out.append({'type': 'Text', 'params': params})
        else:
            left_out += 1
    print(f'{len(out)} objekt, {left_out} utanför papperet eller överhoppade', file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=0)


main()
