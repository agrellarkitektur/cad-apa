import { addViewTag, setLocked, setShowIn, updateParams } from '../core/commands';
import { modelViewId, type Element, type Id, type ProjectDoc, type ShowIn } from '../core/model';
import type { DocStore } from '../core/store';
import { allViews, countViews, homeOf } from '../core/visibility';
import { LINE_TYPES, PATTERN_LABELS, PEN_WEIGHTS, SHAPE_LABELS, type Fill2DParams, type Line2DParams } from '../elements/drawing2d';
import { markerName } from '../elements/markers';
import { resolveParams } from '../elements/registry';
import { SLOPE_STYLES, type RoofSlopeParams } from '../elements/roofSlope';
import { icons } from './icons';
import { escapeHtml } from './labels';

/**
 * Egenskaperna för det som ritas på ritningen (0.8): 2D-element,
 * taklutningar, Visas i och Lås. Delar av egenskapspanelen, i en egen fil.
 */

/** Typer som har Visas i: det som är ritningsinformation och kan visas i vissa vyer. */
export const SHOWABLE = new Set(['Line2D', 'Fill2D', 'Text', 'Dimension']);
/** Typer som kan låsas. */
export const LOCKABLE = new Set(['Line2D', 'Fill2D', 'Text', 'Dimension', 'RoofSlope', 'Section', 'Elevation', 'North']);

const comma = (n: number) => n.toLocaleString('sv-SE');

/** Fälten för en 2D-linje, en fyllning eller en taklutning. */
export function drawingFields(doc: ProjectDoc, el: Element): string {
  if (el.type === 'Line2D') {
    const p = resolveParams<Line2DParams>(doc, el);
    const closable = p.shape === 'polyline' || p.shape === 'spline';
    return `<div class="fields">
        <label class="field"><span>Form</span><input value="${SHAPE_LABELS[p.shape]}" readonly></label>
        <label class="field"><span>Penna</span><select data-key="d2:weight">${PEN_WEIGHTS.map((w) => `<option value="${w}"${w === p.weight ? ' selected' : ''}>${comma(w)} mm</option>`).join('')}</select></label>
        <label class="field"><span>Linjetyp</span><select data-key="d2:linetype">${Object.entries(LINE_TYPES).map(([k, v]) => `<option value="${k}"${k === p.linetype ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>
        <label class="field"><span>Färg</span><input type="color" data-key="d2:color" value="${p.color ?? '#1d2328'}"></label>
      </div>
      ${closable ? `<label class="check"><input type="checkbox" data-key="d2:closed"${p.closed ? ' checked' : ''}> Sluten</label>` : ''}`;
  }
  if (el.type === 'Fill2D') {
    const p = resolveParams<Fill2DParams>(doc, el);
    return `<div class="fields">
        <label class="field"><span>Mönster</span><select data-key="d2:pattern">${Object.entries(PATTERN_LABELS).map(([k, l]) => `<option value="${k}"${k === p.pattern ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Färg</span><input type="color" data-key="d2:color" value="${p.color ?? '#9aa0a6'}"></label>
        ${p.pattern !== 'solid' ? `<label class="field"><span>Vinkel</span><span class="input-unit"><input type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" data-key="d2:angle" value="${p.angle}"><i>°</i></span></label>
        <label class="field"><span>Avstånd på papper</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" data-key="d2:spacing" value="${comma(p.spacing)}"><i>mm</i></span></label>` : ''}
      </div>
      <label class="check"><input type="checkbox" data-key="d2:outline"${p.outline ? ' checked' : ''}> Kontur</label>`;
  }
  if (el.type === 'RoofSlope') {
    const p = resolveParams<RoofSlopeParams>(doc, el);
    const roof = doc.elements[p.roof];
    const slope = roof ? Number(roof.params.slope ?? 0) : 0;
    return `<div class="fields">
        <label class="field"><span>Stil</span><select data-key="slope:style">${Object.entries(SLOPE_STYLES).map(([k, l]) => `<option value="${k}"${k === p.style ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Linjens längd</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" data-key="slope:len" value="${p.len}"><i>mm</i></span></label>
      </div>
      <p class="note">Visar takets lutning, ${comma(slope)}°, och följer med när lutningen ändras. Flytta den dit den ska stå; lutningen ändras på taket.</p>
      <div class="row"><button class="btn" data-action="select-roof" data-roof="${escapeHtml(p.roof)}">Markera taket</button></div>`;
  }
  return '';
}

/** Lås, med hänglås. Delvis ifyllt när markeringen är blandad. */
export function lockField(els: Element[]): string {
  if (!els.every((e) => LOCKABLE.has(e.type))) return '';
  const n = els.filter((e) => e.locked).length;
  const mixed = n > 0 && n < els.length;
  return `<label class="check lock-check" title="Ett låst objekt kan inte flyttas eller tas bort av misstag">
    <input type="checkbox" data-key="lock:"${n === els.length ? ' checked' : ''}${mixed ? ' data-mixed="1"' : ''}>
    <span class="lock-icon">${n ? icons.lock : icons.unlock}</span> Lås</label>`;
}

type ShowChoice = 'all' | 'this' | 'views' | 'tags';

function choiceOf(show: ShowIn | undefined, here: Id): ShowChoice {
  if (!show) return 'all';
  if (show.kind === 'tags') return 'tags';
  return show.views.length === 1 && show.views[0] === here ? 'this' : 'views';
}

/** Ytans namn: "våningen", "fasaden", "sektionen". */
function placeWord(doc: ProjectDoc, el: Element): string {
  const home = doc.elements[homeOf(el)];
  if (home?.type === 'Section') return 'sektionen';
  if (home?.type === 'Elevation') return 'fasaden';
  if (doc.worksheets.some((w) => w.id === homeOf(el))) return 'arbetsbladet';
  return 'våningen';
}

/**
 * Visas i: alla vyer av ytan, bara den här vyn, utvalda vyer eller vyer med
 * taggar. Under står hur många vyer det syns i, med en varning om det blir noll.
 */
export function showSection(doc: ProjectDoc, els: Element[], here: Id): string {
  if (!els.length || !els.every((e) => SHOWABLE.has(e.type))) return '';
  const el = els[0];
  const same = els.every((e) => JSON.stringify(e.show ?? null) === JSON.stringify(el.show ?? null));
  const show = same ? el.show : undefined;
  const choice = same ? (listOpen && show?.kind === 'views' ? 'views' : choiceOf(show, here)) : null;
  const opt = (v: ShowChoice, label: string) => `<option value="${v}"${choice === v ? ' selected' : ''}>${label}</option>`;
  const parts: string[] = [];
  parts.push(`<label class="field"><span>Visas i</span><select data-key="show:kind">${choice ? '' : '<option selected disabled>Blandat</option>'}${opt('all', `Alla vyer av ${placeWord(doc, el)}`)}${opt('this', 'Bara den här vyn')}${opt('views', 'Utvalda vyer')}${opt('tags', 'Vyer med taggar')}</select></label>`);
  if (show?.kind === 'views' && choice === 'views') {
    const views = allViews(doc);
    const name = (v: (typeof views)[number]) => {
      if (!v.model) return v.name;
      const m = doc.elements[v.place];
      return m ? `${markerName(doc, m)} · modell` : v.name;
    };
    parts.push(`<div class="view-checks" role="group" aria-label="Vyer">${views
      .map((v) => `<label class="check"><input type="checkbox" data-key="show:view" value="${escapeHtml(v.id)}"${show.views.includes(v.id) ? ' checked' : ''}> ${escapeHtml(name(v))}${v.id === here ? ' <small>(den här)</small>' : ''}</label>`)
      .join('')}</div>`);
  }
  if (show?.kind === 'tags') {
    parts.push(`<div class="segmented wide" role="group" aria-label="Hur taggarna gäller">
        <button data-action="show-match" data-match="any" aria-pressed="${show.match === 'any'}">Någon av</button>
        <button data-action="show-match" data-match="all" aria-pressed="${show.match === 'all'}">Alla</button>
      </div>
      <div class="tag-chips">${doc.viewTags
        .map((t) => `<button class="state-chip ${show.tags.includes(t) ? 'on' : 'off'}" data-action="show-tag" data-tag="${escapeHtml(t)}" aria-pressed="${show.tags.includes(t)}"><span class="box"></span>${escapeHtml(t)}</button>`)
        .join('')}</div>
      <div class="row"><input id="new-view-tag" placeholder="Ny vy-tagg" aria-label="Ny vy-tagg"><button class="btn" data-action="add-view-tag">Lägg till</button></div>`);
  }
  if (same) {
    const n = countViews(doc, el);
    parts.push(n === 0
      ? `<p class="note warn" role="note"><b>!</b> Syns nu i 0 vyer. ${show?.kind === 'tags' ? 'Ge någon vy taggarna i projektträdet, eller välj andra taggar.' : 'Välj minst en vy.'}</p>`
      : `<p class="note">Syns nu i ${n} ${n === 1 ? 'vy' : 'vyer'}.</p>`);
  }
  return `<section><h3>Visas i</h3>${parts.join('')}</section>`;
}

/** Ändringar i fälten ovan. Svarar true om ändringen hanterades. */
export function drawingChange(store: DocStore, ids: Id[], key: string, input: HTMLInputElement | HTMLSelectElement, here: Id): boolean {
  const [scope, name] = key.split(':');
  const doc = store.doc;
  const els = ids.map((id) => doc.elements[id]).filter(Boolean);
  if (scope === 'lock') {
    setLocked(store, ids, (input as HTMLInputElement).checked);
    return true;
  }
  if (scope === 'd2') {
    const v = input.value;
    const num = Number(v.replace(',', '.'));
    if (name === 'weight' && num > 0) updateParams(store, ids, { weight: num }, 'Ändra penna');
    else if (name === 'linetype') updateParams(store, ids, { linetype: v }, 'Ändra linjetyp');
    else if (name === 'color') updateParams(store, ids, { color: v }, 'Ändra färg');
    else if (name === 'closed') updateParams(store, ids, { closed: (input as HTMLInputElement).checked }, 'Sluten');
    else if (name === 'pattern') updateParams(store, ids, { pattern: v }, 'Ändra mönster');
    else if (name === 'outline') updateParams(store, ids, { outline: (input as HTMLInputElement).checked }, 'Kontur');
    else if (name === 'angle' && Number.isFinite(num)) updateParams(store, ids, { angle: num }, 'Ändra vinkel');
    else if (name === 'spacing' && num > 0) updateParams(store, ids, { spacing: num }, 'Ändra avstånd');
    return true;
  }
  if (scope === 'slope') {
    if (name === 'style') updateParams(store, ids, { style: input.value }, 'Ändra stil');
    else if (name === 'len' && Number(input.value) >= 100) updateParams(store, ids, { len: Math.round(Number(input.value)) }, 'Ändra längd');
    return true;
  }
  if (scope === 'show') {
    if (name === 'kind') {
      const c = input.value as ShowChoice;
      const show: ShowIn | null =
        c === 'all' ? null : c === 'this' ? { kind: 'views', views: [here] } : c === 'views' ? { kind: 'views', views: [here] } : { kind: 'tags', tags: [], match: 'any' };
      setShowIn(store, ids, show);
      // "Utvalda vyer" börjar med den här vyn ikryssad men visar listan.
      listOpen = c === 'views';
      return true;
    }
    if (name === 'view') {
      const cur = els[0]?.show;
      if (cur?.kind !== 'views') return true;
      const on = (input as HTMLInputElement).checked;
      const views = on ? [...new Set([...cur.views, input.value])] : cur.views.filter((v) => v !== input.value);
      // Med bara den här vyn kvar visas ändå listan; användaren valde Utvalda vyer.
      listOpen = true;
      setShowIn(store, ids, { kind: 'views', views });
      return true;
    }
  }
  return false;
}

/**
 * "Utvalda vyer" med bara den här vyn ikryssad sparas likadant som "Bara den
 * här vyn". När användaren valt Utvalda vyer visas listan ändå, tills
 * markeringen byts (`resetShowList`).
 */
let listOpen = false;
export function resetShowList(): void {
  listOpen = false;
}

/** Klick på knappar i Visas i och taklutningen. Svarar true om klicket hanterades. */
export function drawingClick(store: DocStore, ids: Id[], b: HTMLElement, root: HTMLElement): boolean {
  const doc = store.doc;
  const el = doc.elements[ids[0]];
  switch (b.dataset.action) {
    case 'show-match': {
      if (el?.show?.kind !== 'tags') return true;
      setShowIn(store, ids, { ...el.show, match: b.dataset.match === 'all' ? 'all' : 'any' });
      return true;
    }
    case 'show-tag': {
      if (el?.show?.kind !== 'tags') return true;
      const t = b.dataset.tag!;
      const tags = el.show.tags.includes(t) ? el.show.tags.filter((x) => x !== t) : [...el.show.tags, t];
      setShowIn(store, ids, { ...el.show, tags });
      return true;
    }
    case 'add-view-tag': {
      const input = root.querySelector<HTMLInputElement>('#new-view-tag');
      const t = input ? addViewTag(store, input.value) : null;
      if (t && el?.show?.kind === 'tags' && !el.show.tags.includes(t)) setShowIn(store, ids, { ...el.show, tags: [...el.show.tags, t] });
      return true;
    }
  }
  return false;
}

/** Id för vyn som visas, för "Bara den här vyn". */
export function hereOf(view: { viewId?: Id }, storey: Id): Id {
  return view.viewId ?? modelViewId(storey);
}
