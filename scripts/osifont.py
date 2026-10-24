"""
osifont (0.8.18): gör delmängden med WinAnsi-tecknen som appen använder,
för skärmen (src/fonts/osifont.woff2) och PDF:en (src/formats/osifontData.ts),
och teckenbredderna i src/formats/osifontWidths.ts.

    pip install --break-system-packages fonttools brotli
    git clone --depth 1 https://github.com/hikikomori82/osifont /tmp/osifont
    python3 scripts/osifont.py /tmp/osifont/osifont.ttf

osifont: https://github.com/hikikomori82/osifont, GPL 3 med typsnittsundantag.
"""
import base64, io, sys
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = sys.argv[1]
WIN_EXTRA = {0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x2C6, 0x89: 0x2030,
             0x8A: 0x160, 0x8B: 0x2039, 0x8C: 0x152, 0x8E: 0x17D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022,
             0x96: 0x2013, 0x97: 0x2014, 0x98: 0x2DC, 0x99: 0x2122, 0x9A: 0x161, 0x9B: 0x203A, 0x9C: 0x153, 0x9E: 0x17E, 0x9F: 0x178}

def unicode_of(byte):
    return WIN_EXTRA.get(byte, byte if byte < 0x80 or byte >= 0xA0 else None)

codes = [u for u in (unicode_of(b) for b in range(32, 256)) if u]

def make(flavor):
    o = subset.Options()
    o.layout_features = []
    o.flavor = flavor
    o.name_IDs = ['*']
    o.notdef_outline = True
    o.hinting = False
    o.glyph_names = True
    f = TTFont(SRC)
    s = subset.Subsetter(o)
    s.populate(unicodes=codes)
    s.subset(f)
    buf = io.BytesIO()
    subset.save_font(f, buf, o)
    return buf.getvalue(), f

ttf, font = make(None)
woff2, _ = make('woff2')
open('src/fonts/osifont.woff2', 'wb').write(woff2)

upm = font['head'].unitsPerEm
cmap = font.getBestCmap()
hmtx = font['hmtx']
k = 1000 / upm
widths = []
for b in range(32, 256):
    u = unicode_of(b)
    g = cmap.get(u) if u else None
    widths.append(round(hmtx[g][0] * k) if g else 0)
head = font['head']
os2 = font['OS/2']
meta = dict(
    ascent=round(font['hhea'].ascent * k), descent=round(font['hhea'].descent * k), capHeight=round(os2.sCapHeight * k),
    bbox=[round(head.xMin * k), round(head.yMin * k), round(head.xMax * k), round(head.yMax * k)],
)
with open('src/formats/osifontWidths.ts', 'w') as out:
    out.write('// Gjord av scripts/osifont.py. Ändra inte för hand.\n')
    out.write('/** osifonts bredder för WinAnsi 32–255 i tusendelar av texthöjden; 0 = tecknet saknas. */\n')
    out.write(f"export const OSIFONT_WIDTHS = '{','.join(map(str, widths))}'.split(',').map(Number);\n")
    out.write(f"export const OSIFONT_METRICS = {{ ascent: {meta['ascent']}, descent: {meta['descent']}, capHeight: {meta['capHeight']}, bbox: [{', '.join(map(str, meta['bbox']))}] }};\n")
with open('src/formats/osifontData.ts', 'w') as out:
    out.write('// Gjord av scripts/osifont.py. Ändra inte för hand.\n')
    out.write('// osifont, https://github.com/hikikomori82/osifont, GPL 3 med typsnittsundantag (src/fonts/LICENSE-osifont.txt).\n')
    out.write('/** Delmängden av osifont (TrueType) som bäddas in i PDF:en, base64. */\n')
    out.write(f"export const OSIFONT_TTF = '{base64.b64encode(ttf).decode()}';\n")
print(len(ttf), len(woff2), meta)
