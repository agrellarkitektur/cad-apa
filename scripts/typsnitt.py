"""
Typsnitten som följer med appen utöver osifont (0.12): gör delmängden med
WinAnsi-tecknen för PDF:en och skärmen (src/formats/fontData/<id>.ts, base64)
och bredderna i src/formats/fontMetrics.ts. osifont görs av scripts/osifont.py.

    pip install --break-system-packages fonttools
    B=https://raw.githubusercontent.com/google/fonts/main
    curl -o /tmp/Arimo.ttf "$B/ofl/arimo/Arimo%5Bwght%5D.ttf"
    curl -o /tmp/Josefin.ttf "$B/ofl/josefinsans/JosefinSans%5Bwght%5D.ttf"
    python3 scripts/typsnitt.py /tmp/Arimo.ttf /tmp/Josefin.ttf

Arimo (Apache 2.0/OFL, måttlik med Arial) och Josefin Sans (OFL); båda är
variabla och fryses vid vikten 400.
"""
import base64, io, json, sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONTS = [
    # id, namn, källa, licensrad
    ('arimo', 'Arimo', sys.argv[1], 'Arimo, https://github.com/googlefonts/arimo, SIL Open Font License 1.1 (src/fonts/OFL-arimo.txt).'),
    ('josefin', 'Josefin Sans', sys.argv[2], 'Josefin Sans, https://github.com/googlefonts/josefinsans, SIL Open Font License 1.1 (src/fonts/OFL-josefin.txt).'),
]
WIN_EXTRA = {0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x2C6, 0x89: 0x2030,
             0x8A: 0x160, 0x8B: 0x2039, 0x8C: 0x152, 0x8E: 0x17D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022,
             0x96: 0x2013, 0x97: 0x2014, 0x98: 0x2DC, 0x99: 0x2122, 0x9A: 0x161, 0x9B: 0x203A, 0x9C: 0x153, 0x9E: 0x17E, 0x9F: 0x178}

def unicode_of(b):
    return WIN_EXTRA.get(b, b if b < 0x80 or b >= 0xA0 else None)

codes = [u for u in (unicode_of(b) for b in range(32, 256)) if u]
metrics = {}
for fid, name, src, lic in FONTS:
    f = TTFont(src)
    if 'fvar' in f:
        f = instancer.instantiateVariableFont(f, {a.axisTag: 400 if a.axisTag == 'wght' else a.defaultValue for a in f['fvar'].axes})
    o = subset.Options()
    o.layout_features = []
    o.name_IDs = ['*']
    o.notdef_outline = True
    o.hinting = False
    o.glyph_names = True
    s = subset.Subsetter(o)
    s.populate(unicodes=codes)
    s.subset(f)
    buf = io.BytesIO()
    subset.save_font(f, buf, o)
    ttf = buf.getvalue()
    upm = f['head'].unitsPerEm
    k = 1000 / upm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    widths = []
    for b in range(32, 256):
        u = unicode_of(b)
        g = cmap.get(u) if u else None
        widths.append(round(hmtx[g][0] * k) if g else 0)
    head = f['head']
    os2 = f['OS/2']
    metrics[fid] = dict(name=name, widths=','.join(map(str, widths)), ascent=round(f['hhea'].ascent * k), descent=round(f['hhea'].descent * k),
                        capHeight=round(getattr(os2, 'sCapHeight', 700) * k), bbox=[round(head.xMin * k), round(head.yMin * k), round(head.xMax * k), round(head.yMax * k)])
    with open(f'src/formats/fontData/{fid}.ts', 'w') as out:
        out.write('// Gjord av scripts/typsnitt.py. Ändra inte för hand.\n')
        out.write(f'// {lic}\n')
        out.write(f'/** Delmängden av {name} (TrueType, WinAnsi), base64. */\n')
        out.write(f"export const TTF = '{base64.b64encode(ttf).decode()}';\n")
    print(fid, len(ttf))

with open('src/formats/fontMetrics.ts', 'w') as out:
    out.write('// Gjord av scripts/typsnitt.py. Ändra inte för hand.\n')
    out.write('/** Bredderna (WinAnsi 32–255, tusendelar av texthöjden; 0 = saknas) och måtten för typsnitten som följer med appen utöver osifont. */\n')
    out.write('export const BUNDLED_METRICS = {\n')
    for fid, m in metrics.items():
        out.write(f"  {fid}: {{ name: {json.dumps(m['name'])}, widths: '{m['widths']}', ascent: {m['ascent']}, descent: {m['descent']}, capHeight: {m['capHeight']}, bbox: [{', '.join(map(str, m['bbox']))}] }},\n")
    out.write('} as const;\n')
