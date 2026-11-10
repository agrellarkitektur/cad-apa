import { AREA_COLORS, AREA_FUNCTIONS, AREA_NO_FILL, areaSettingsOf, type AreaSettings } from '../../core/general';
import type { StyleBook } from '../../core/graphics';
import type { ProjectDoc } from '../../core/model';
import { AREA_KINDS, AREA_NAMES } from '../../elements/areaCalc';
import { escapeHtml as esc } from '../labels';

/**
 * Stilboken › Allmänt › Areor (0.12.3): färgen per areaslag och per
 * funktion (*Handel*, *Kontor* …), och fyllningens täckning. Areorna ritas
 * i Areaplanen med fyllningen halvtransparent och konturen i samma färg.
 */
export function areasMarkup(doc: ProjectDoc): string {
  const s = areaSettingsOf(doc.graphics);
  const own = doc.graphics.general?.areas ?? {};
  const kinds = AREA_KINDS.map(
    (k) => `<label class="field gen-area"><span>${k} <i class="gen-desc">${esc(AREA_NAMES[k])}${AREA_NO_FILL.has(k) ? ', bara konturen' : ''}</i></span><input type="color" data-gen="area:color:${k}" value="${esc(s.colors[k])}" aria-label="Färg för ${k}"></label>`,
  ).join('');
  const funcs = s.functions
    .map(
      (f, i) => `<div class="row gen-area-fn"><input data-gen="area:fname:${i}" value="${esc(f.name)}" aria-label="Funktionens namn" style="width:120px"><input type="color" data-gen="area:fcolor:${i}" value="${esc(f.color)}" aria-label="Färg för ${esc(f.name)}"><button type="button" class="icon-mini" data-gen-action="area-fn-del:${i}" aria-label="Ta bort ${esc(f.name)}">×</button></div>`,
    )
    .join('');
  return `<section class="style-labels gen-areas">
      <h3>Areor</h3>
      <p class="note">Areorna enligt SS 21054 i Areaplanen: halvtransparent fyllning och konturen i samma färg. En funktion (t.ex. <i>Kontor</i> inom LOA) går före areaslagets färg.</p>
      <div class="fields gen-grid">${kinds}
        <label class="field"><span>Fyllningens täckning</span><select data-gen="area:opacity">${[0, 0.2, 0.35, 0.5, 0.7, 1].map((o) => `<option value="${o}"${o === s.opacity ? ' selected' : ''}>${o ? `${Math.round(o * 100)} %` : 'Ingen fyllning'}</option>`).join('')}</select></label>
      </div>
      <h4>Funktioner</h4>
      ${funcs || '<p class="note">Inga funktioner.</p>'}
      <div class="sb-toolbar"><button type="button" class="btn" data-gen-action="area-fn-add">Ny funktion</button>${own.colors || own.functions || own.opacity !== undefined ? '<button type="button" class="btn btn-ghost" data-gen-action="area-reset">Återställ färgerna</button>' : ''}</div>
    </section>`;
}

function withAreas(book: StyleBook, fn: (a: AreaSettings) => void): StyleBook {
  const cur = book.general?.areas ?? {};
  const a: AreaSettings = { ...cur, ...(cur.colors ? { colors: { ...cur.colors } } : {}), ...(cur.functions ? { functions: cur.functions.map((f) => ({ ...f })) } : {}) };
  fn(a);
  if (a.colors && !Object.keys(a.colors).length) delete a.colors;
  const g = { ...(book.general ?? {}) };
  if (Object.keys(a).length) g.areas = a;
  else delete g.areas;
  const next = { ...book };
  if (Object.keys(g).length) next.general = g;
  else delete next.general;
  return next;
}

const funcsOf = (a: AreaSettings) => (a.functions ??= AREA_FUNCTIONS.map((f) => ({ ...f })));

/** Ett ändrat fält under Areor. Svarar sant om det var ett av dem. */
export function areaChange(book: StyleBook, kind: string, name: string, value: string, setBook: (b: StyleBook, label: string) => void): boolean {
  if (kind !== 'area') return false;
  const [what, key] = [name.slice(0, name.indexOf(':') < 0 ? name.length : name.indexOf(':')), name.slice(name.indexOf(':') + 1)];
  if (what === 'color' && key in AREA_COLORS) {
    setBook(
      withAreas(book, (a) => {
        a.colors = { ...(a.colors ?? {}) };
        if (value.toLowerCase() === AREA_COLORS[key]) delete a.colors[key];
        else a.colors[key] = value.toLowerCase();
      }),
      `Areornas färg: ${key}`,
    );
  } else if (what === 'opacity') {
    const o = Number(value);
    if (Number.isFinite(o)) setBook(withAreas(book, (a) => (o === 0.35 ? delete a.opacity : (a.opacity = o))), 'Areornas täckning');
  } else if (what === 'fname' || what === 'fcolor') {
    const i = Number(key);
    setBook(
      withAreas(book, (a) => {
        const list = funcsOf(a);
        if (!list[i]) return;
        if (what === 'fname' && value.trim()) list[i].name = value.trim();
        if (what === 'fcolor') list[i].color = value.toLowerCase();
      }),
      'Areornas funktion',
    );
  }
  return true;
}

/** En knapp under Areor. Svarar sant om det var en av dem. */
export function areaClick(book: StyleBook, action: string, setBook: (b: StyleBook, label: string) => void): boolean {
  if (action === 'area-fn-add') {
    setBook(withAreas(book, (a) => funcsOf(a).push({ name: `Funktion ${funcsOf(a).length + 1}`, color: '#a0a0a0' })), 'Ny funktion för areorna');
    return true;
  }
  if (action.startsWith('area-fn-del:')) {
    const i = Number(action.slice('area-fn-del:'.length));
    setBook(withAreas(book, (a) => funcsOf(a).splice(i, 1)), 'Ta bort funktionen');
    return true;
  }
  if (action === 'area-reset') {
    setBook(withAreas(book, (a) => (delete a.colors, delete a.functions, delete a.opacity)), 'Återställ areornas färger');
    return true;
  }
  return false;
}
