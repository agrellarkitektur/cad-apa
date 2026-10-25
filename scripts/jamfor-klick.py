"""Samma klick i två byggen (granskningen 0.8.27; linjetyper, mask och egen
penna från 0.8.32; fyllningstyper, pennor för dörrar och fönster, rummens
kontur, Filtrera och markera och detaljnivåerna från 0.8.38): läget efter varje steg
sparas, och två körningar jämförs steg för steg.

Bygg den gamla versionen i en egen arbetskopia och den nya som vanligt,
servera dem på var sin port (python3 -m http.server) och kör

    python3 scripts/jamfor-klick.py 8765 gammal.json
    python3 scripts/jamfor-klick.py 8766 ny.json
    python3 scripts/jamfor-klick.py --jamfor gammal.json ny.json

Med `--bilder` (0.8.38) sparas också en bild av ritytan efter varje steg,
bredvid json-filen. Skiljer sig ritningens markup (`content`), till exempel
när ett mönster ritas på ett annat sätt, jämförs bilderna: antalet pixlar
som skiljer mycket står efter stegets namn.

Nya id blir desamma i båda (fast följd i crypto.getRandomValues), och
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

INIT = r"""
(() => {
  let n = 1;
  crypto.getRandomValues = (a) => { for (let i = 0; i < a.length; i++) { n = (n * 1103515245 + 12345) & 0x7fffffff; a[i] = n & 0xff; } return a; };
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
        step('opacitet två', "__set('[data-key=\"d2:opacity\"]', '50', 'aside.panel .panel-body')")
        step('bak', "__click('[data-action=\"draw-order\"][data-order=\"backward\"]', 'aside.panel .panel-body')")
        step('linjeform', "bacchus.selection.set(['tf-2'])")
        step('klicka linjen', fn=lambda: click_model(13500, -2000))
        step('ände i smartmenyn', "__set('[data-key=\"d2:endCap\"]', 'triangle', '.smart-menu')")
        step('spegla linjen', "__click('[data-action=\"mirror\"]', 'aside.panel .quick-bar')")
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
        step('x i smartmenyn', "__set('[data-key=\"ul:x\"]', '-8000', '.smart-menu')")
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
        step('tillbaka till planen', "bacchus.goTo({kind: 'storey', id: bacchus.store.doc.storeys[0].id})", fn=lambda: pg.wait_for_timeout(500))
        step('markera fasadlinje', "bacchus.selection.set(['fasad-1'])")
        step('vänd blicken', "__click('[data-action=\"flip-side\"]', 'aside.panel .panel-body')")
        step('följ byggnaden', "__click('[data-action=\"follow-building\"]', 'aside.panel .panel-body')")
        step('slut', "bacchus.selection.clear()")
        b.close()
    json.dump(rows, open(OUT, 'w'), ensure_ascii=False)


main()
