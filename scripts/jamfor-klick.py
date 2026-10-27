"""Samma klick i två byggen (granskningen 0.8.27; linjetyper, mask och egen
penna från 0.8.32; fyllningstyper, pennor för dörrar och fönster, rummens
kontur, Filtrera och markera och detaljnivåerna från 0.8.38; våningar,
bjälklag och nivåer från 0.9.3; platsen och markobjekten från 0.10.6):
läget efter varje steg sparas, och två körningar jämförs steg för steg.

Bygg den gamla versionen i en egen arbetskopia och den nya som vanligt,
servera dem på var sin port (python3 -m http.server) och kör

    python3 scripts/jamfor-klick.py 8765 gammal.json
    python3 scripts/jamfor-klick.py 8766 ny.json
    python3 scripts/jamfor-klick.py --jamfor gammal.json ny.json

Med `--bilder` (0.8.38) sparas också en bild av ritytan efter varje steg,
bredvid json-filen. Skiljer sig ritningens markup (`content`), till exempel
när ett mönster ritas på ett annat sätt, jämförs bilderna: antalet pixlar
som skiljer mycket står efter stegets namn.

Nya id blir desamma i båda (fast följd i crypto.getRandomValues, sedan
0.10.6 med de höga bitarna, så att två nya id inte blir lika), och
blob-adresser för underlagens bilder räknas inte. Kräver Playwright och PIL.
"""
import base64, hashlib, io, json, os, sys
from playwright.sync_api import sync_playwright


def compare(a_path, b_path):
    a = json.load(open(a_path)); b = json.load(open(b_path))
    keys = [k for k in a[0] if k not in ('step', 'err', '_raw', 'tool')]
    # Verktygets klassnamn minifieras olika i två byggen (0.8.32): samma
    # verktyg är samma namn i varje bygge, så namnen ska motsvara varandra
    # ett till ett genom hela körningen.
    tools = {}
    bad = 0
    pics = [p[:-5] + '-bilder' for p in (a_path, b_path)]
    for i, (x, y) in enumerate(zip(a, b)):
        d = [k for k in keys if x[k] != y[k]]
        # Samma bild trots olika markup räknas som lika (0.8.38).
        if 'content' in d and all(os.path.exists(f'{q}/{i}.png') for q in pics):
            n = pixel_diff(*(f'{q}/{i}.png' for q in pics))
            d.remove('content')
            if n:
                d.append(f'bild ({n} px)')
        ta, tb = x['_raw']['tool'], y['_raw']['tool']
        if tools.setdefault(ta, tb) != tb or list(tools.values()).count(tb) > 1:
            d.append('tool')
        bad += bool(d)
        if d or x['err'] != y['err']:
            print(f"{x['step']:28} {'OLIKA ' + ','.join(d) if d else ''} {x['err'][:60]} | {y['err'][:60]}")
    print(f'{len(a)} steg, {bad} olika')


def pixel_diff(a, b):
    """Pixlar som skiljer mer än en fjärdedel i gråskala (kantutjämningen räknas inte)."""
    from PIL import Image, ImageChops
    d = ImageChops.difference(Image.open(a).convert('L'), Image.open(b).convert('L'))
    return sum(d.histogram()[64:])


if sys.argv[1] == '--jamfor':
    compare(sys.argv[2], sys.argv[3])
    sys.exit()

PORT, OUT = sys.argv[1], sys.argv[2]
PICS = OUT[:-5] + '-bilder' if '--bilder' in sys.argv else None


def _bild():
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (400, 300), 'white')
    d = ImageDraw.Draw(im)
    d.rectangle([50, 50, 350, 250], outline='black', width=4)
    d.line([0, 0, 400, 300], fill='red', width=3)
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return base64.b64encode(buf.getvalue()).decode()


BILD = _bild()


def _plats():
    """En kuperad plats, 60 × 50 m med 1 m mellan noderna, vriden 10° (samma mark som `groundProject` i testerna)."""
    import math, struct
    W, H = 61, 51
    z = [60 + 0.06 * i + 0.8 * math.sin(i / 7) * math.cos(j / 5) + 0.02 * j for j in range(H) for i in range(W)]
    return json.dumps({
        'format': 'hojdkurvor-plats', 'version': 1, 'projekt': {'id': 'p1', 'namn': 'Provet'},
        'koordinatsystem': {'plan': {'epsg': 3010, 'namn': 'SWEREF 99 16 30'}, 'hojd': 'RH 2000', 'enhet': 'm'},
        'utsnitt': {'xmin': 1000, 'ymin': 5000, 'xmax': 1060, 'ymax': 5050},
        'nollpunkt': {'x': 1025, 'y': 5020, 'z': 0}, 'vridning': 10, 'sannNord': 0,
        'terrang': {'rutnat': {'x0': 1000, 'y1': 5050, 's': 1, 'W': W, 'H': H, 'z': base64.b64encode(struct.pack(f'<{W * H}f', *z)).decode()}},
        'trad': [{'x': 1045, 'y': 5040, 'mark': None, 'hojd': 9, 'krona': 5}],
        'byggnader': [{'fotavtryck': [[1005, 5038], [1013, 5038], [1013, 5046], [1005, 5046]], 'mark': None, 'hojd': 6, 'typ': 'Bostad', 'husnummer': '3'}],
    })


PLATS = _plats()

INIT = r"""
(() => {
  let n = 1;
  crypto.getRandomValues = (a) => { for (let i = 0; i < a.length; i++) { n = (n * 1103515245 + 12345) & 0x7fffffff; a[i] = (n >>> 16) & 0xff; } return a; };
  window.showSaveFilePicker = undefined;
  window.showOpenFilePicker = undefined;
  window.__set = (sel, val, root) => {
    const r = root ? document.querySelector(root) : document;
    const all = [...r.querySelectorAll(sel)];
    let el = all.find((e) => e.type === 'radio' ? e.value === String(val) : true);
    if (!el) throw new Error('saknas: ' + sel + ' i ' + root);
    if (el.type === 'checkbox') el.checked = val;
    else if (el.type === 'radio') el.checked = true;
    else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__click = (sel, root) => {
    const r = root ? document.querySelector(root) : document;
    const el = r.querySelector(sel);
    if (!el) throw new Error('saknas: ' + sel + ' i ' + root);
    el.click();
  };
  window.__screen = (x, y) => {
    const s = bacchus.view.camera.toScreen([x, y]);
    const r = document.querySelector('svg.plan').getBoundingClientRect();
    return [r.left + s[0], r.top + s[1]];
  };
})();
"""

STATE = r"""() => {
  const h = (s) => s ?? '';
  const q = (sel) => { const e = document.querySelector(sel); return e ? e.innerHTML.replace(/blob:[^"]*/g, 'blob') : ''; };
  const dlg = [...document.querySelectorAll('.dialog-backdrop')].filter((d) => !d.hidden).map((d) => d.innerHTML).join('|');
  const doc = JSON.parse(JSON.stringify(bacchus.store.doc));
  return {
    doc: JSON.stringify(doc),
    sel: JSON.stringify(bacchus.selection.list()),
    content: q('.plan-drawing .content'),
    highlight: q('svg.plan .highlight'),
    overlay: q('svg.plan .overlay'),
    panel: q('aside.panel[aria-label="Egenskaper"] .panel-body'),
    quick: q('aside.panel[aria-label="Egenskaper"] .quick-bar'),
    smart: (() => { const e = document.querySelector('.smart-menu'); return e && !e.hidden ? e.innerHTML : ''; })(),
    dialog: dlg,
    tool: String(bacchus.view.currentTool?.constructor?.name ?? ''),
  };
}"""


def main():
    rows = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1600, 'height': 1000})
        pg.add_init_script(INIT)
        pg.goto(f'http://localhost:{PORT}/')
        pg.wait_for_function('window.bacchus && window.bacchus.store')
        pg.wait_for_timeout(1200)

        def settle():
            pg.evaluate('() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))')
            pg.wait_for_timeout(120)

        def step(name, js=None, fn=None):
            err = ''
            try:
                if js:
                    pg.evaluate(js)
                if fn:
                    fn()
            except Exception as e:  # noqa
                err = str(e).split('\n')[0][:200]
            settle()
            st = pg.evaluate(STATE)
            if PICS:
                os.makedirs(PICS, exist_ok=True)
                pg.locator('.pane-2d').screenshot(path=f'{PICS}/{len(rows)}.png')
            rows.append({'step': name, 'err': err, **{k: hashlib.sha1(v.encode()).hexdigest()[:10] for k, v in st.items()}, '_raw': st})

        def click_model(x, y, shift=False):
            sx, sy = pg.evaluate(f'__screen({x}, {y})')
            pg.mouse.move(sx, sy)
            if shift:
                pg.keyboard.down('Shift')
            pg.mouse.click(sx, sy)
            if shift:
                pg.keyboard.up('Shift')

        step('start')
        # ---------- Stilmallen ----------
        step('öppna stilmallen', "__click('[data-action=\"style\"]')")
        step('fyllning skraffering', "__set('[data-key=\"existing\"][data-field=\"fill\"]', 'hatch', '.dialog')")
        step('linjefärg', "__set('[data-key=\"existing\"][data-field=\"color\"]', '#3366aa', '.dialog')")
        step('opacitet', "__set('[data-key=\"existing\"][data-field=\"opacity\"]', '60', '.dialog')")
        step('bakgrund på', "__set('[data-key=\"existing\"][data-field=\"bgOn\"]', true, '.dialog')")
        step('bakgrundsfärg', "__set('[data-key=\"existing\"][data-field=\"bg\"]', '#eeddcc', '.dialog')")
        step('bakgrundens opacitet', "__set('[data-key=\"existing\"][data-field=\"bgOpacity\"]', '40', '.dialog')")
        step('kontur streckad', "__set('[data-key=\"demolished\"][data-field=\"outline\"]', 'dashed', '.dialog')")
        step('konturfärg', "__set('[data-key=\"demolished\"][data-field=\"lineColor\"]', '#aa0000', '.dialog')")
        step('kontur ingen', "__set('[data-key=\"new\"][data-field=\"outline\"]', 'none', '.dialog')")
        step('dörrar öppna', "__set('[data-key=\"new\"][data-field=\"door\"]', '30', '.dialog')")
        step('fyllning solid', "__set('[data-key=\"plain\"][data-field=\"fill\"]', 'solid', '.dialog')")
        step('justering', "__set('[data-lab=\"align\"]', 'center', '.dialog')")
        step('texthöjd', "__set('[data-lab=\"h:roomName\"]', '3.5', '.dialog')")
        step('littera mall', "__set('[data-lab=\"t:Door:normal\"]', '{typ}\\n{nummer}', '.dialog')")
        step('rumsstämpel', "__set('[data-lab=\"room\"]', '{nummer}\\n{namn}\\n{area}', '.dialog')")
        step('penna tjocklek', "__set('[data-pen=\"sectionLine:weight\"]', '0.7', '.dialog')")
        step('penna färg', "__set('[data-pen=\"north:color\"]', '#cc2200', '.dialog')")
        step('penna svart', "__set('[data-pen=\"north:color\"]', '#000000', '.dialog')")
        step('penna förval', "__click('[data-action=\"pen-reset\"][data-pen-key=\"sectionLine\"]', '.dialog')")
        step('ångra', "__click('[data-action=\"undo\"]')")
        step('penna förval igen', "__click('[data-action=\"pen-reset\"][data-pen-key=\"sectionLine\"]', '.dialog')")
        # Linjetyperna (0.8.30, steg från 0.8.32).
        step('ny linjetyp', "__click('[data-action=\"linetype-add\"]', '.dialog')")
        step('linjetypens mönster', "__set('[data-linetype=\"egen-1:dash\"]', '4 1 0,5 1', '.dialog')")
        step('linjetypens namn', "__set('[data-linetype=\"egen-1:name\"]', 'Egen', '.dialog')")
        step('pennans linjetyp', "__set('[data-pen=\"elevationLine:linetype\"]', 'dashdot', '.dialog')")
        step('penna med egen linjetyp', "__set('[data-pen=\"sectionLine:linetype\"]', 'egen-1', '.dialog')")
        # Pennor för dörrar, fönster och rum, och fyllningstyperna (0.8.33–0.8.37, steg från 0.8.38).
        step('symbolpenna', "__set('[data-pen=\"openingSymbol:weight\"]', '0.25', '.dialog')")
        step('vypenna färg', "__set('[data-pen=\"openingView:color\"]', '#3366aa', '.dialog')")
        step('rummens kontur', "__set('[data-pen=\"roomOutline:weight\"]', '0.18', '.dialog')")
        step('guiden', "document.querySelector('.dialog .filltype-guide').open = true")
        step('ny fyllningstyp', "__click('[data-action=\"filltype-add\"]', '.dialog')")
        step('typens namn', "__set('[data-filltype=\"fyllning-1:name\"]', 'Rutor', '.dialog')")
        step('typens vinkel', "__set('[data-filltype=\"fyllning-1:0:angle\"]', '30', '.dialog')")
        step('typens avstånd', "__set('[data-filltype=\"fyllning-1:0:spacing\"]', '1,5', '.dialog')")
        step('typens förskjutning', "__set('[data-filltype=\"fyllning-1:0:shift\"]', '0,75', '.dialog')")
        step('typens streckning', "__set('[data-filltype=\"fyllning-1:0:dash\"]', '2 1', '.dialog')")
        step('ny linjefamilj', "__click('[data-action=\"filltype-family-add\"][data-filltype-id=\"fyllning-1\"]', '.dialog')")
        step('familjens baspunkt', "__set('[data-filltype=\"fyllning-1:1:x\"]', '0,5', '.dialog')")
        step('ta bort familjen', "__click('[data-action=\"filltype-family-remove\"][data-filltype-id=\"fyllning-1\"][data-family=\"0\"]', '.dialog')")
        step('typens linjer', "__set('[data-filltype=\"fyllning-1:weight\"]', '0.25', '.dialog')")
        step('verkliga mått', "__set('[data-filltype=\"fyllning-1:units\"]', 'model', '.dialog')")
        step('kopiera tegel', "__click('[data-action=\"filltype-copy\"][data-filltype-id=\"tegel\"]', '.dialog')")
        step('snittfyllning tegel', "__set('[data-key=\"new\"][data-field=\"fill\"]', 'type:tegel', '.dialog')")
        step('snittfyllning egen', "__set('[data-key=\"existing\"][data-field=\"fill\"]', 'type:fyllning-1', '.dialog')")
        step('ta bort typen', "__click('[data-action=\"filltype-remove\"][data-filltype-id=\"fyllning-1\"]', '.dialog')")
        step('förinställning', "__set('#style-preset', '1', '.dialog')")
        step('förinställning 0', "__set('#style-preset', '0', '.dialog')")
        step('stäng stilmallen', "__click('[data-action=\"close\"]', '.dialog')")

        # ---------- Väggar, dörrar och snabbraden ----------
        step('markera vägg', "bacchus.selection.set(['yv-s'])")
        step('referenslinje', "__click('[data-action=\"cycle-ref\"]', 'aside.panel .quick-bar')")
        step('vänd väggen', "__click('[data-action=\"flip-wall\"]', 'aside.panel .quick-bar')")
        step('riv', "__click('[data-action=\"demolish\"]', 'aside.panel .quick-bar')")
        step('behåll', "__click('[data-action=\"restore\"]', 'aside.panel .quick-bar')")
        step('kopiera', "__click('[data-action=\"copy\"]', 'aside.panel .quick-bar')")
        step('esc', fn=lambda: pg.keyboard.press('Escape'))
        step('markera dörr', "bacchus.selection.set(['d01'])")
        step('vänd slag', "__click('[data-action=\"flip-swing\"]', 'aside.panel .quick-bar')")
        step('hängning', "__click('[data-action=\"flip-hinge\"]', 'aside.panel .quick-bar')")
        step('glasad', "__click('[data-action=\"toggle-glazed\"]', 'aside.panel .quick-bar')")
        step('markera möbel', "bacchus.selection.set(['m01'])")
        step('vrid möbel', "__click('[data-action=\"rotate-90\"]', 'aside.panel .quick-bar')")
        step('spegla möbel', "__click('[data-action=\"mirror\"]', 'aside.panel .quick-bar')")
        step('två möbler', "bacchus.selection.set(['m02', 'm03'])")
        step('vrid två', "__click('[data-action=\"rotate-90\"]', 'aside.panel .quick-bar')")
        step('spegla två', "__click('[data-action=\"mirror\"]', 'aside.panel .quick-bar')")
        step('vägg och dörr', "bacchus.selection.set(['yv-o', 'd02'])")
        step('vrid vägg', "__click('[data-action=\"rotate-90\"]', 'aside.panel .quick-bar')")
        step('markera rum', "bacchus.selection.set(['r01'])")
        # Rummets fyllning och penna (0.8.34–0.8.36, steg från 0.8.38).
        step('rum mönster', "__set('[data-key=\"d2:pattern\"]', 'type:plattor150', 'aside.panel .panel-body')")
        step('rum vridning', "__set('[data-key=\"d2:fillTypeAngle\"]', '45', 'aside.panel .panel-body')")
        step('rum penna', "__set('[data-key=\"pen:weight\"]', '0.25', 'aside.panel .panel-body')")
        step('markera fönster', "bacchus.selection.set(['f01'])")
        step('ta bort fönster', "__click('[data-action=\"delete\"]', 'aside.panel .quick-bar')")
        step('ångra borttagning', "__click('[data-action=\"undo\"]')")
        # Egen penna (0.8.31, steg från 0.8.32).
        step('markera innervägg', "bacchus.selection.set(['iv-1'])")
        step('egen tjocklek', "__set('[data-key=\"pen:weight\"]', '0.7', 'aside.panel .panel-body')")
        step('egen färg på', "__set('[data-key=\"pen:colorOn\"]', 'own', 'aside.panel .panel-body')")
        step('egen färg', "__set('[data-key=\"pen:color\"]', '#00aa00', 'aside.panel .panel-body')")
        step('egen linjetyp', "__set('[data-key=\"pen:linetype\"]', 'dashed', 'aside.panel .panel-body')")
        step('två väggar olika', "bacchus.selection.set(['iv-1', 'iv-2'])")
        step('stilmallens penna', "__click('[data-action=\"own-pen-reset\"]', 'aside.panel .panel-body')")
        step('ångra penna', "__click('[data-action=\"undo\"]')")
        step('yttervägg egen penna', "bacchus.selection.set(['yv-s'])", fn=lambda: pg.evaluate("__set('[data-key=\"pen:weight\"]', '1', 'aside.panel .panel-body')"))
        step('dörr egen färg', "bacchus.selection.set(['d02'])", fn=lambda: pg.evaluate("__set('[data-key=\"pen:colorOn\"]', 'own', 'aside.panel .panel-body')"))
        step('fönster egen linjetyp', "bacchus.selection.set(['f01'])", fn=lambda: pg.evaluate("__set('[data-key=\"pen:linetype\"]', 'dotted', 'aside.panel .panel-body')"))
        step('avmarkera', "bacchus.selection.clear()")

        # ---------- 2D-former ----------
        def add_shapes():
            pg.evaluate("""() => {
              const d = bacchus.store.doc;
              const st = d.storeys[0].id, states = d.states.map((s) => s.id);
              const base = { shape: 'polyline', weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 };
              bacchus.store.transact('former', (tx) => {
                tx.putElement({ id: 'tf-1', type: 'Shape2D', storey: st, states, tags: [], props: {}, params: { ...base, closed: true, fill: 'hatch', points: [[12000, 0], [15000, 0], [15000, 2000], [12000, 2000]] } });
                tx.putElement({ id: 'tf-2', type: 'Shape2D', storey: st, states, tags: [], props: {}, params: { ...base, closed: false, points: [[12000, -2000], [15000, -2000], [16000, -3000]], bulges: [0, 300] } });
                tx.putElement({ id: 'tf-3', type: 'Shape2D', storey: st, states, tags: [], props: {}, params: { ...base, closed: true, fill: 'solid', points: [[13000, 1000], [16000, 1000], [16000, 3000], [13000, 3000]] } });
              });
            }""")
        step('lägg till former', fn=add_shapes)
        step('markera alla former', "bacchus.selection.set(['tf-1', 'tf-2', 'tf-3'])")
        step('zooma ut', "__click('[data-action=\"fit\"]')", fn=lambda: pg.wait_for_timeout(400))
        step('avmarkera före klick', "bacchus.selection.clear()")
        step('klicka form', fn=lambda: click_model(13800, 600))
        step('mönster solid', "__set('[data-key=\"d2:pattern\"]', 'solid', 'aside.panel .panel-body')")
        step('mönster kors', "__set('[data-key=\"d2:pattern\"]', 'cross', 'aside.panel .panel-body')")
        step('fyllningsfärg', "__set('[data-key=\"d2:fillColor\"]', '#88aa22', 'aside.panel .panel-body')")
        step('vinkel', "__set('[data-key=\"d2:fillAngle\"]', '30', 'aside.panel .panel-body')")
        step('avstånd', "__set('[data-key=\"d2:fillSpacing\"]', '3', 'aside.panel .panel-body')")
        step('penna', "__set('[data-key=\"d2:weight\"]', '0.5', 'aside.panel .panel-body')")
        step('linjetyp', "__set('[data-key=\"d2:linetype\"]', 'dashed', 'aside.panel .panel-body')")
        step('linjefärg 2d', "__set('[data-key=\"d2:color\"]', '#224488', 'aside.panel .panel-body')")
        step('opacitet 2d', "__set('[data-key=\"d2:opacity\"]', '70', 'aside.panel .panel-body')")
        step('opacitet var för sig', "__set('[data-key=\"d2:opacityLinked\"]', false, 'aside.panel .panel-body')")
        step('fyllningens opacitet', "__set('[data-key=\"d2:fillOpacity\"]', '40', 'aside.panel .panel-body')")
        step('framför väggarna', "__set('[data-key=\"d2:fillLayer\"]', 'front', 'aside.panel .panel-body')")
        step('linjen bakom', "__set('[data-key=\"d2:lineLayer\"]', 'behind', 'aside.panel .panel-body')")
        step('främst', "__click('[data-action=\"draw-order\"][data-order=\"front\"]', 'aside.panel .panel-body')")
        step('vinkel i smartmenyn', "__set('[data-key=\"d2:fillAngle\"]', '60', '.smart-menu')")
        step('öppen', "__set('[data-key=\"d2:closed\"]', false, 'aside.panel .panel-body')")
        step('ändform', "__set('[data-key=\"d2:endCap\"]', 'arrow', 'aside.panel .panel-body')")
        step('början', "__set('[data-key=\"d2:startCap\"]', 'dot', 'aside.panel .panel-body')")
        step('ändstorlek', "__set('[data-key=\"d2:capSize\"]', '4', 'aside.panel .panel-body')")
        step('ingen ände', "__set('[data-key=\"d2:endCap\"]', 'none', 'aside.panel .panel-body')")
        step('ingen linje', "__set('[data-key=\"d2:weight\"]', '0', 'aside.panel .panel-body')")
        # Linjetyp, mask och bakgrund (0.8.29–0.8.30, steg från 0.8.32).
        step('linje igen', "__set('[data-key=\"d2:weight\"]', '0.35', 'aside.panel .panel-body')")
        step('egen linjetyp 2d', "__set('[data-key=\"d2:linetype\"]', 'egen-1', 'aside.panel .panel-body')")
        step('sluten igen', "__set('[data-key=\"d2:closed\"]', true, 'aside.panel .panel-body')")
        step('mönster mask', "__set('[data-key=\"d2:pattern\"]', 'mask', 'aside.panel .panel-body')")
        step('mönster skraffering', "__set('[data-key=\"d2:pattern\"]', 'hatch', 'aside.panel .panel-body')")
        step('bakgrund', "__set('[data-key=\"d2:fillBackgroundOn\"]', true, 'aside.panel .panel-body')")
        step('bakgrund egen färg', "__set('[data-key=\"d2:fillBackgroundKind\"]', 'color', 'aside.panel .panel-body')")
        step('bakgrundsfärg 2d', "__set('[data-key=\"d2:fillBackground\"]', '#ffeedd', 'aside.panel .panel-body')")
        step('bakgrundens opacitet 2d', "__set('[data-key=\"d2:fillBackgroundOpacity\"]', '60', 'aside.panel .panel-body')")
        step('bakgrund mask', "__set('[data-key=\"d2:fillBackgroundKind\"]', 'mask', 'aside.panel .panel-body')")
        step('bakgrund i smartmenyn', "__set('[data-key=\"d2:fillBackgroundOpacity\"]', '80', '.smart-menu')")
        # Fyllningstyperna och rumsgränsen på en 2D-form (0.8.34–0.8.36, steg från 0.8.38).
        step('mönster tegel', "__set('[data-key=\"d2:pattern\"]', 'type:tegel', 'aside.panel .panel-body')")
        step('typens vridning', "__set('[data-key=\"d2:fillTypeAngle\"]', '30', 'aside.panel .panel-body')")
        step('typens skala', "__set('[data-key=\"d2:fillTypeScale\"]', '2', 'aside.panel .panel-body')")
        step('skala i smartmenyn', "__set('[data-key=\"d2:fillTypeScale\"]', '1,5', '.smart-menu')")
        step('mönster kopian', "__set('[data-key=\"d2:pattern\"]', 'type:fyllning-2', 'aside.panel .panel-body')")
        step('mönster sicksack', "__set('[data-key=\"d2:pattern\"]', 'type:sicksack', 'aside.panel .panel-body')")
        step('avgränsar rum', "__set('[data-key=\"d2:boundsRooms\"]', true, 'aside.panel .panel-body')")
        step('visas i bara här', "__set('[data-key=\"show:kind\"]', 'this', 'aside.panel .panel-body')")
        step('visas i utvalda', "__set('[data-key=\"show:kind\"]', 'views', 'aside.panel .panel-body')")
        step('visas i taggar', "__set('[data-key=\"show:kind\"]', 'tags', 'aside.panel .panel-body')")
        step('visas i alla', "__set('[data-key=\"show:kind\"]', 'all', 'aside.panel .panel-body')")
        step('lås', "__set('[data-key=\"lock:\"]', true, 'aside.panel .panel-body')")
        step('lås upp', "__set('[data-key=\"lock:\"]', false, 'aside.panel .panel-body')")
        step('esc 2d', fn=lambda: pg.keyboard.press('Escape'))
        step('klicka form igen', fn=lambda: click_model(13800, 600))
        step('smartmeny två', fn=lambda: click_model(15500, 2600, shift=True))
        step('fyllning bakom två', "__set('[data-key=\"d2:fillLayer\"]', 'behind', 'aside.panel .panel-body')")
        step('bak', "__click('[data-action=\"draw-order\"][data-order=\"backward\"]', 'aside.panel .panel-body')")
        step('linjeform', "bacchus.selection.set(['tf-2'])")
        step('klicka linjen', fn=lambda: click_model(13500, -2000))
        step('ände i smartmenyn', "__set('[data-key=\"d2:endCap\"]', 'triangle', '.smart-menu')")
        step('fortsätt linjen', "__click('[data-action=\"continue-line\"]', 'aside.panel .quick-bar')")
        step('esc fortsätt', fn=lambda: pg.keyboard.press('Escape'))
        step('avmarkera 2d', "bacchus.selection.clear()")

        # ---------- Underlag ----------
        def drop_image():
            pg.evaluate("""(b64) => {
              const bin = atob(b64); const arr = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
              const f = new File([arr], 'bild.png', { type: 'image/png' });
              const dt = new DataTransfer(); dt.items.add(f);
              const t = document.querySelector('.pane-2d');
              const r = t.getBoundingClientRect();
              const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 300, clientY: r.top + 300 };
              t.dispatchEvent(new DragEvent('dragover', o));
              t.dispatchEvent(new DragEvent('drop', o));
            }""", BILD)
            pg.wait_for_timeout(1500)
        step('lägg in bild', fn=drop_image)
        step('x', "__set('[data-key=\"ul:x\"]', '-9000', 'aside.panel .panel-body')")
        step('y', "__set('[data-key=\"ul:y\"]', '-9000', 'aside.panel .panel-body')")
        step('bredd', "__set('[data-key=\"ul:width\"]', '4000', 'aside.panel .panel-body')")
        step('höjd', "__set('[data-key=\"ul:height\"]', '2000', 'aside.panel .panel-body')")
        step('proportioner', "__click('[data-action=\"ul-proportions\"]', 'aside.panel .panel-body')")
        step('vridning', "__set('[data-key=\"ul:angle\"]', '15', 'aside.panel .panel-body')")
        step('synlighet', "__set('[data-key=\"ul:opacity\"]', '50', 'aside.panel .panel-body')")
        step('gråskala', "__set('[data-key=\"ul:gray\"]', true, 'aside.panel .panel-body')")
        step('x igen', "__set('[data-key=\"ul:x\"]', '-8000', 'aside.panel .panel-body')")
        step('underlag visas i', "__set('[data-key=\"show:kind\"]', 'this', 'aside.panel .panel-body')")
        step('avmarkera underlag', "bacchus.selection.clear()")

        # ---------- Detaljnivåer och Filtrera och markera (steg från 0.8.38) ----------
        step('vyraden detalj', "__click('.detail-switch:not(.detail-part-switch) [data-detail=\"detail\"]')")
        step('öppna Visa', "__click('[data-action=\"show-menu\"]')")
        step('littera skiss', "__click('[data-detail=\"sketch\"][data-detail-part=\"label\"]')")
        step('3D normal', "__click('[data-detail=\"normal\"][data-detail-part=\"model\"]')")
        step('2D skiss', "__click('[data-detail=\"sketch\"][data-detail-part=\"plan\"]')")
        step('stäng Visa', "__click('[data-action=\"show-menu\"]')")
        step('vyraden normal', "__click('.detail-switch:not(.detail-part-switch) [data-detail=\"normal\"]')")
        step('filtrera', "__click('[data-action=\"filter-select\"]')")
        step('sort väggar', "__set('input[data-f=\"type\"][value=\"Wall\"]', true, '.filter-select')")
        step('egen penna', "__set('select[data-f=\"pen\"]', 'with', '.filter-select')")
        step('ersätt markeringen', "__click('[data-action=\"filter-apply\"][data-how=\"replace\"]', '.filter-select')")
        step('filtrera igen', "__click('[data-action=\"filter-select\"]')")
        step('utan egen penna', "__set('select[data-f=\"pen\"]', 'without', '.filter-select')")
        step('lägg till', "__click('[data-action=\"filter-apply\"][data-how=\"add\"]', '.filter-select')")
        step('filtrera en tredje gång', "__click('[data-action=\"filter-select\"]')")
        step('rensa villkoren', "__click('[data-action=\"filter-reset\"]', '.filter-select')")
        step('stäng filtret', "__click('[data-action=\"filter-close\"]', '.filter-select')")
        step('avmarkera filtret', "bacchus.selection.clear()")

        # ---------- Våningar, bjälklag och nivåer (0.9–0.9.2, steg från 0.9.3) ----------
        def shell(cmd):
            def run():
                pg.click('#ss-input')
                pg.fill('#ss-input', cmd)
                pg.keyboard.press('Enter')
                pg.wait_for_timeout(300)
            return run

        def key(k):
            def run():
                sx, sy = pg.evaluate('__screen(6000, 4000)')
                pg.mouse.move(sx, sy)
                pg.keyboard.press(k)
                pg.wait_for_timeout(300)
            return run

        def ctx_item(label):
            pg.click(f'.ctx-menu:not([hidden]) button:has-text("{label}")')
            pg.wait_for_timeout(300)

        step('ny våning ovanför', fn=shell('nyv'))
        step('våningen under', fn=key('PageDown'))
        step('markera för kopian', "bacchus.selection.set(['yv-s', 'yv-o', 'yv-n', 'yv-v', 'iv-1', 'iv-2', 'bj1', 'r01'])")
        step('kopiera till våning', fn=lambda: (shell('ktv')(), ctx_item('Plan 2')))
        step('väggen på plan 2', "bacchus.selection.set([bacchus.selection.list()[0]])")
        step('egen väggens höjd', "__set('[data-key=\"wall:storeyHeight\"]', false, 'aside.panel .panel-body')")
        step('våningshöjden igen', "__set('[data-key=\"wall:storeyHeight\"]', true, 'aside.panel .panel-body')")
        step('avmarkera på plan 2', "bacchus.selection.clear()")
        step('öppna Visa på plan 2', "__click('[data-action=\"show-menu\"]')")
        step('kalkera våningen under', "__set('[data-show-trace]', 'våning:under', '.show-menu')")
        step('kalkera över', "__click('[data-trace-above=\"1\"]', '.show-menu')")
        step('kalkera under igen', "__click('[data-trace-above=\"0\"]', '.show-menu')")
        step('stäng Visa på plan 2', "__click('[data-action=\"show-menu\"]')")
        step('bjälklagsverktyget', "bacchus.setTool('slab')")
        step('ur väggarna finns', "__click('[data-action=\"slab-walls\"]')")
        step('rektangelns första hörn', fn=lambda: click_model(13000, 0))
        step('rektangelns andra hörn', fn=lambda: click_model(16000, 3000))
        step('håltagning', "__click('[data-slab-mode=\"hole\"]')")
        step('hålets första hörn', fn=lambda: click_model(13600, 600))
        step('hålets andra hörn', fn=lambda: click_model(14600, 1800))
        step('bjälklag igen', "__click('[data-slab-mode=\"slab\"]')")
        step('esc bjälklag', fn=lambda: pg.keyboard.press('Escape'))
        step('markera kopian av plattan', "bacchus.selection.set(Object.values(bacchus.store.doc.elements).filter((e) => e.type === 'Slab' && e.storey !== 'pl-1' && e.params.fromWalls).map((e) => e.id))")
        step('egen kontur', "__set('[data-key=\"slab:fromWalls\"]', false, 'aside.panel .panel-body')")
        step('ångra kontur', "__click('[data-action=\"undo\"]')")
        step('markera bjälklaget med hål', "bacchus.selection.set(Object.values(bacchus.store.doc.elements).filter((e) => e.type === 'Slab' && e.params.holes?.length).map((e) => e.id))")
        step('ta bort hålet', "__click('[data-action=\"slab-hole-remove\"][data-index=\"0\"]', 'aside.panel .panel-body')")
        step('ångra hålet', "__click('[data-action=\"undo\"]')")
        step('avmarkera plattan', "bacchus.selection.clear()")

        # ---------- Platsen och markobjekten (0.10.3–0.10.5, steg från 0.10.6) ----------
        def drop_site():
            pg.evaluate("""(text) => {
              const f = new File([text], 'provet.hkplats.json', { type: 'application/json' });
              const dt = new DataTransfer(); dt.items.add(f);
              const t = document.querySelector('.pane-2d');
              const r = t.getBoundingClientRect();
              const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 300, clientY: r.top + 300 };
              t.dispatchEvent(new DragEvent('dragover', o));
              t.dispatchEvent(new DragEvent('drop', o));
            }""", PLATS)
            pg.wait_for_selector('.dialog [data-choice="here"]', timeout=5000)

        def ground_ids(test):
            return f"Object.values(bacchus.store.doc.elements).filter((e) => e.type === 'Ground' && ({test})).map((e) => e.id)"

        panel = 'aside.panel .panel-body'
        step('planen igen', "bacchus.goTo({kind: 'storey', id: bacchus.store.doc.storeys[0].id})", fn=lambda: pg.wait_for_timeout(300))
        step('släpp platsen', fn=drop_site)
        step('i det öppna projektet', fn=lambda: (pg.click('[data-choice="here"]'), pg.wait_for_timeout(500)))
        step('zooma till platsen', "__click('[data-action=\"fit\"]')", fn=lambda: pg.wait_for_timeout(400))
        step('markverktyget', "bacchus.setTool('ground')")
        step('runt huset', "__click('[data-action=\"ground-around\"]')")
        # Väggarna är vridna ovan, så plattan ur väggarna har ingen kontur: ett bjälklag till på plan 1.
        step('bjälklag på plan 1', "bacchus.selection.clear(); bacchus.setTool('slab')")
        step('bjälklagets första hörn', fn=lambda: click_model(-7000, -4000))
        step('bjälklagets andra hörn', fn=lambda: click_model(-3000, -1000))
        step('markverktyget igen', "bacchus.setTool('ground')")
        step('under bjälklag', "bacchus.selection.clear(); __click('[data-ground-mode=\"slab\"]')")
        step('klicka i bjälklaget', fn=lambda: click_model(-5000, -2500))
        step('markyta', "bacchus.selection.clear(); __click('[data-ground-mode=\"area\"]')")
        step('platåns första hörn', fn=lambda: click_model(19000, 6000))
        step('platåns andra hörn', fn=lambda: click_model(25000, 11000))
        step('markyta igen', "bacchus.selection.clear(); __click('[data-ground-mode=\"area\"]')")
        step('gropens första hörn', fn=lambda: click_model(-20000, 8000))
        step('gropens andra hörn', fn=lambda: click_model(-15000, 12000))
        step('ramp', "bacchus.selection.clear(); __click('[data-ground-mode=\"path\"]')")
        step('rampens början', fn=lambda: click_model(2000, -8000))
        step('rampens slut', fn=lambda: click_model(8000, -8000))
        step('rampen klar', "__click('[data-action=\"ground-done\"]')")
        step('stödmur', "bacchus.selection.clear(); __click('[data-ground-mode=\"wall\"]')")
        step('murens början', fn=lambda: click_model(19000, 5000))
        step('murens slut', fn=lambda: click_model(25000, 5000))
        step('muren klar', "__click('[data-action=\"ground-done\"]')")
        step('brytlinje', "bacchus.selection.clear(); __click('[data-ground-mode=\"breakline\"]')")
        step('brytlinjens början', fn=lambda: click_model(-22000, -6000))
        step('brytlinjens slut', fn=lambda: click_model(-22000, 4000))
        step('brytlinjen klar', "__click('[data-action=\"ground-done\"]')")
        step('höjdpunkt', "bacchus.selection.clear(); __click('[data-ground-mode=\"point\"]')")
        step('höjdpunkten', fn=lambda: click_model(-10000, 16000))
        step('esc mark', fn=lambda: pg.keyboard.press('Escape'))
        step('markera platån', f"bacchus.selection.set({ground_ids("e.params.kind === 'area' && e.params.outline.length").replace('.map(', '.slice(0, 1).map(')})")
        step('platåns höjd', f"__set('[data-key=\"ground:height\"]', '62,4', '{panel}')")
        step('platåns fall', f"__set('[data-key=\"ground:fall\"]', '40', '{panel}')")
        step('fallets riktning', f"__set('[data-key=\"ground:fallDir\"]', '120', '{panel}')")
        step('platåns slänt', f"__set('[data-key=\"ground:slope\"]', '3', '{panel}')")
        step('kanterna stödmur', f"__set('[data-key=\"ground:edge\"]', 'wall', '{panel}')")
        step('markera platån runt huset', f"bacchus.selection.set({ground_ids('e.params.around')})")
        step('sockeln', f"__set('[data-key=\"ground:sockel\"]', '300', '{panel}')")
        step('ut från fasaden', f"__set('[data-key=\"ground:distance\"]', '4000', '{panel}')")
        step('markera urgrävningen', f"bacchus.selection.set({ground_ids('e.params.slab')})")
        step('arbetsutrymmet', f"__set('[data-key=\"ground:margin\"]', '800', '{panel}')")
        step('markera rampen', f"bacchus.selection.set({ground_ids("e.params.kind === 'path'")})")
        step('rampens bredd', f"__set('[data-key=\"ground:width\"]', '1800', '{panel}')")
        step('rampens lutning', f"__set('[data-key=\"ground:ratio\"]', '15', '{panel}')")
        step('vägens namn', f"__set('[data-key=\"ground:name\"]', 'Infart', '{panel}')")
        step('referenslinjen till vänster', f"__set('[data-key=\"ground:refSide\"]', 'left', '{panel}')")
        step('förskjutningen', f"__set('[data-key=\"ground:refOffset\"]', '-100', '{panel}')")
        step('ingen tvärlinje i början', f"__set('[data-key=\"ground:startLine\"]', false, '{panel}')")
        step('gränsen för lutningen', f"__set('[data-key=\"ground:maxSlope\"]', '20', '{panel}')")
        step('tvärfall', f"__set('[data-key=\"ground:crossFall\"]', '-40', '{panel}')")
        step('sidorna stödmur', f"__set('[data-key=\"ground:edge\"]', 'wall', '{panel}')")
        step('markera stödmuren', f"bacchus.selection.set({ground_ids("e.params.kind === 'wall'")})")
        step('murens tjocklek', f"__set('[data-key=\"ground:thickness\"]', '300', '{panel}')")
        step('över marken', f"__set('[data-key=\"ground:above\"]', '200', '{panel}')")
        step('markera brytlinjen', f"bacchus.selection.set({ground_ids("e.params.kind === 'breakline'")})")
        step('tonas inom', f"__set('[data-key=\"ground:radius\"]', '3000', '{panel}')")
        step('brytlinjens slut höjd', f"__set('[data-key=\"ground:endHeight\"]', '61', '{panel}')")
        step('ångra brytlinjen', "__click('[data-action=\"undo\"]')")
        step('lås brytlinjen', f"__set('[data-key=\"lock:\"]', true, '{panel}')")
        step('avmarkera mark', "bacchus.selection.clear()")
        step('öppna Platsen', "__click('[data-action=\"site\"]')", fn=lambda: pg.wait_for_selector('.dialog [data-ground=\"slope\"]', timeout=5000))
        step('slänten i förvalen', "__set('[data-ground=\"slope\"]', '2,5', '.site-dialog')")
        step('jord i sektionerna', "__set('[data-site=\"earth\"]', true, '.site-dialog')")
        step('höjdkurvor var', "__set('[data-site=\"contours\"]', '250', '.site-dialog')")
        step('spara Platsen', "__click('[type=\"submit\"]', '.site-dialog')")
        step('innerväggens höjd', "bacchus.selection.set(['iv-1'])", fn=lambda: pg.evaluate("__set('[data-key=\"param:height\"]', '2500', 'aside.panel .panel-body')"))
        step('avmarkera väggen', "bacchus.selection.clear()")

        # ---------- Fasader och sektion ----------
        def open_marker(m):
            pg.evaluate(f"bacchus.goTo({{kind: 'marker', id: '{m}'}})")
            pg.wait_for_timeout(300)
            pg.wait_for_function('!bacchus.sections.pending', timeout=20000)
            pg.wait_for_timeout(300)
            pg.evaluate('''__click('[data-action="fit"]')''')
            pg.wait_for_timeout(400)
        for m in ['fasad-1', 'fasad-2', 'fasad-3', 'fasad-4', 'sektion-a']:
            step(f'öppna {m}', fn=lambda m=m: open_marker(m))
        # Nivåer och höjdmått (0.9.2, steg från 0.9.3).
        step('öppna Visa i sektionen', "__click('[data-action=\"show-menu\"]')")
        step('släck nivåerna', "__set('[data-show=\"level\"]', false, '.show-menu')", fn=lambda: pg.wait_for_function('!bacchus.sections.pending', timeout=20000))
        step('släck höjdmåtten', "__set('[data-show=\"heightDims\"]', false, '.show-menu')", fn=lambda: pg.wait_for_function('!bacchus.sections.pending', timeout=20000))
        step('nivåerna igen', "__set('[data-show=\"level\"]', true, '.show-menu')", fn=lambda: pg.wait_for_function('!bacchus.sections.pending', timeout=20000))
        step('stäng Visa i sektionen', "__click('[data-action=\"show-menu\"]')")
        step('tillbaka till planen', "bacchus.goTo({kind: 'storey', id: bacchus.store.doc.storeys[0].id})", fn=lambda: pg.wait_for_timeout(500))
        step('markera fasadmarkör', "bacchus.selection.set(['fasad-1'])")
        step('vänd blicken', "__click('[data-action=\"flip-side\"]', 'aside.panel .panel-body')")
        step('följ byggnaden', "__click('[data-action=\"follow-building\"]', 'aside.panel .panel-body')")
        step('slut', "bacchus.selection.clear()")
        b.close()
    json.dump(rows, open(OUT, 'w'), ensure_ascii=False)


main()
