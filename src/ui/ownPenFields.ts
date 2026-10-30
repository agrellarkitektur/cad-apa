import type { Definition, Element, Id, OwnPen, OwnPenPart, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { PEN_WEIGHTS } from '../elements/drawing2d';
import { escapeHtml } from './labels';
import { lineTypeOptions } from './lineTypePick';

/**
 * Egen penna för ett objekt (0.8.31) eller en typ (0.8.33): tjocklek, färg
 * och linjetyp var för sig. Dörrar och fönster har två delar (0.8.33):
 * *Snitt* (karmar, dörrblad, bågar och glas) och *Symbol* (slagbågen,
 * öppningssättet). Objektets egen går före typens, som går före stilbokens.
 */

/** Sorterna som kan få en egen penna. 2D-formen har redan sin egen. Markobjekten sedan 0.10.7. */
export const OWN_PEN_TYPES = new Set(['Wall', 'Door', 'Window', 'Roof', 'Furniture', 'Space', 'Ground', 'Slab']);

/** Sorterna med en symboldel (slagbåge, öppningssätt). */
const SYMBOL_TYPES = new Set(['Door', 'Window']);

/** Sorterna med en del för det som ligger över planens snitt (0.10.16). */
const ABOVE_TYPES = new Set(['Wall', 'Door', 'Window', 'Roof', 'Furniture', 'Ground', 'Slab']);

type Part = 'main' | 'symbol' | 'above';
type Field = keyof OwnPenPart;

const comma = (n: number) => n.toLocaleString('sv-SE');
const partOf = (pen: OwnPen | undefined, part: Part): OwnPenPart | undefined => (part === 'main' ? pen : pen?.[part]);
/** Delen ur fältets namn (`symbol.weight`, `above.color`, `weight`). */
const partOfName = (name: string): Part => (name.startsWith('symbol.') ? 'symbol' : name.startsWith('above.') ? 'above' : 'main');

/** Värdet om det är lika för alla, null om det skiljer sig. */
function same<K extends Field>(pens: readonly (OwnPen | undefined)[], part: Part, k: K): OwnPenPart[K] | null {
  const v = partOf(pens[0], part)?.[k];
  return pens.every((p) => partOf(p, part)?.[k] === v) ? v : null;
}

/**
 * Fälten för en del av pennan. `scope` är `pen` (objekten) eller `defpen`
 * (typen); `inherited` säger vad som gäller utan egen, per fält.
 */
function partFields(doc: ProjectDoc, scope: string, pens: readonly (OwnPen | undefined)[], part: Part, inherited: (k: Field) => string): string {
  const pre = part === 'main' ? '' : `${part}.`;
  const mixed = '<option selected disabled>Olika</option>';
  const weight = same(pens, part, 'weight');
  const weights = `<select data-key="${scope}:${pre}weight" aria-label="Tjocklek">${weight === null ? mixed : ''}<option value="style"${weight === undefined ? ' selected' : ''}>${inherited('weight')}</option>${PEN_WEIGHTS.filter((w) => w > 0)
    .map((w) => `<option value="${w}"${w === weight ? ' selected' : ''}>${comma(w)} mm</option>`)
    .join('')}</select>`;
  const color = same(pens, part, 'color');
  const colors = `<select data-key="${scope}:${pre}colorOn" aria-label="Färg">${color === null ? mixed : ''}<option value="style"${color === undefined ? ' selected' : ''}>${inherited('color')}</option><option value="own"${color ? ' selected' : ''}>Egen</option></select>`;
  const own = color ? `<label class="field"><span>Egen färg</span><input type="color" data-key="${scope}:${pre}color" value="${color}"></label>` : '';
  const linetype = same(pens, part, 'linetype');
  const types = `<select data-key="${scope}:${pre}linetype" aria-label="Linjetyp">${lineTypeOptions(doc.graphics, linetype, { value: 'style', label: inherited('linetype') })}</select>`;
  return `<div class="fields">
      <label class="field"><span>Tjocklek</span>${weights}</label>
      <label class="field"><span>Färg</span>${colors}</label>
      ${own}
      <label class="field"><span>Linjetyp</span>${types}</label>
    </div>`;
}

/** Båda delarna för dörrar och fönster, annars en. */
function penParts(doc: ProjectDoc, scope: string, type: string, pens: readonly (OwnPen | undefined)[], inherited: (part: Part, k: Field) => string): string {
  const above = ABOVE_TYPES.has(type);
  if (!SYMBOL_TYPES.has(type) && !above) return partFields(doc, scope, pens, 'main', (k) => inherited('main', k));
  // Över snittet (0.10.16): det som saknas tas från den övre delen, sedan stilbokens penna för snittet.
  return `<h4>${SYMBOL_TYPES.has(type) ? 'Snitt' : 'Snitt och vy'}</h4>
    ${partFields(doc, scope, pens, 'main', (k) => inherited('main', k))}
    ${SYMBOL_TYPES.has(type) ? `<h4>Symbol</h4>${partFields(doc, scope, pens, 'symbol', (k) => inherited('symbol', k))}` : ''}
    ${above ? `<h4>Över snittet i planen</h4>${partFields(doc, scope, pens, 'above', (k) => inherited('above', k))}` : ''}`;
}

/** Avsnittet i egenskaperna, eller tomt om något markerat inte kan få en penna. */
export function ownPenSection(doc: ProjectDoc, els: readonly Element[]): string {
  if (!els.length || !els.every((e) => OWN_PEN_TYPES.has(e.type) && !e.space)) return '';
  const type = els.every((e) => e.type === els[0].type) ? els[0].type : '';
  const defs = els.map((e) => (e.definition ? doc.definitions[e.definition]?.pen : undefined));
  // Det som gäller utan egen: typens om någon av typerna har fältet, annars stilbokens.
  const inherited = (part: Part, k: Field) => (defs.some((d) => partOf(d, part)?.[k] !== undefined) ? 'Typens' : 'Stilbokens');
  const any = els.some((e) => e.pen);
  const note = type === 'Space'
    ? 'Stilbokens penna för rummens kontur gäller från början (ingen linje). En egen ger rummet en kontur i planen, under väggarna; inte fyllningen och rumsstämpeln.'
    : SYMBOL_TYPES.has(type)
    ? 'Typens eller stilbokens penna gäller från början. <i>Snitt</i> gäller karmar, dörrblad, bågar och glas, <i>Symbol</i> slagbågen och öppningssättet; inte fyllningar och text.'
    : 'Typens eller stilbokens penna gäller från början. En egen gäller objektets linjer och konturer i planen, fasaderna och sektionerna, men inte fyllningar och text.';
  return `<section class="own-pen">
    <h3>Penna</h3>
    ${penParts(doc, 'pen', type, els.map((e) => e.pen), inherited)}
    <p class="note">${note}</p>
    ${any ? `<div class="row"><button class="btn" data-action="own-pen-reset">${defs.some(Boolean) ? 'Typens' : 'Stilbokens'} penna</button></div>` : ''}
  </section>`;
}

/** Typens penna (0.8.33) i *Påverkar fler objekt*, eller tomt om typens sort inte har någon. */
export function typePenFields(doc: ProjectDoc, def: Definition): string {
  if (!OWN_PEN_TYPES.has(def.elementType)) return '';
  return `<div class="own-pen type-pen">
      <div class="shared-head">Typens penna <span>för dem utan egen</span></div>
      ${penParts(doc, 'defpen', def.elementType, [def.pen], () => 'Stilbokens')}
      ${def.pen ? `<div class="row"><button class="btn" data-action="type-pen-reset" data-def="${escapeHtml(def.id)}">Stilbokens penna</button></div>` : ''}
    </div>`;
}

/** Pennan med fälten ändrade (undefined tar bort); undefined om inget är kvar. */
function changed(pen: OwnPen | undefined, part: Part, change: Partial<Record<Field, unknown>>): OwnPen | undefined {
  const next: OwnPen = { ...pen };
  const target: OwnPenPart = part === 'main' ? next : { ...next[part] };
  for (const [k, v] of Object.entries(change) as [Field, unknown][]) {
    if (v === undefined) delete target[k];
    else (target as Record<string, unknown>)[k] = v;
  }
  if (part !== 'main') {
    if (Object.keys(target).length) next[part] = target;
    else delete next[part];
  }
  return Object.keys(next).length ? next : undefined;
}

/** Ändringen för ett fält, och ångrarubriken. */
function fieldChange(name: string, input: HTMLInputElement | HTMLSelectElement, current: () => string | undefined): { part: Part; change: Partial<Record<Field, unknown>>; label: string } | null {
  const part = partOfName(name);
  const field = part === 'main' ? name : name.slice(part.length + 1);
  const v = input.value;
  const what = part === 'symbol' ? ' för symbolen' : part === 'above' ? ' över snittet' : '';
  if (field === 'weight') return { part, change: { weight: v === 'style' ? undefined : Number(v) }, label: (v === 'style' ? 'Ärvd tjocklek' : 'Egen tjocklek') + what };
  if (field === 'colorOn') return { part, change: { color: v === 'style' ? undefined : (current() ?? '#c2372c') }, label: (v === 'style' ? 'Ärvd färg' : 'Egen färg') + what };
  if (field === 'color') return { part, change: { color: v }, label: 'Ändra färg' + what };
  if (field === 'linetype') return { part, change: { linetype: v === 'style' ? undefined : v }, label: (v === 'style' ? 'Ärvd linjetyp' : 'Egen linjetyp') + what };
  return null;
}

/** Sätt eller ta bort ett fält i pennan för de markerade, i en transaktion. */
function setPen(store: DocStore, ids: readonly Id[], part: Part, change: Partial<Record<Field, unknown>>, label: string): void {
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = store.doc.elements[id];
      if (!el || !OWN_PEN_TYPES.has(el.type)) continue;
      tx.putElement(withPen(el, changed(el.pen, part, change)));
    }
  });
}

/** Ändringar i fälten (`pen:…`). Svarar true om ändringen hanterades. */
export function ownPenChange(store: DocStore, ids: readonly Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const c = fieldChange(name, input, () => ids.map((id) => partOf(store.doc.elements[id]?.pen, partOfName(name))?.color).find(Boolean));
  if (!c) return false;
  setPen(store, ids, c.part, c.change, c.label);
  return true;
}

/** Ändringar i typens penna (`defpen:…`) för typen de markerade har. */
export function typePenChange(store: DocStore, ids: readonly Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const defId = store.doc.elements[ids[0]]?.definition;
  const def = defId ? store.doc.definitions[defId] : undefined;
  if (!def) return false;
  const c = fieldChange(name, input, () => partOf(def.pen, partOfName(name))?.color);
  if (!c) return false;
  store.transact(`${c.label} för ${def.name}`, (tx) => tx.putDefinition(withPen(def, changed(def.pen, c.part, c.change))));
  return true;
}

/** En kopia av objektet eller typen med pennan (undefined tar bort den). */
function withPen<T extends { pen?: OwnPen }>(o: T, pen: OwnPen | undefined): T {
  const next = { ...o };
  if (pen) next.pen = pen;
  else delete next.pen;
  return next;
}

/** Knappen Typens (eller Stilbokens) penna: objektens egna tas bort. */
export function resetOwnPen(store: DocStore, ids: readonly Id[]): void {
  store.transact('Ta bort egen penna', (tx) => {
    for (const id of ids) {
      const el = store.doc.elements[id];
      if (el?.pen) tx.putElement(withPen(el, undefined));
    }
  });
}

/** Knappen Stilbokens penna under typen: typens egen tas bort. */
export function resetTypePen(store: DocStore, defId: Id): void {
  const def = store.doc.definitions[defId];
  if (def?.pen) store.transact(`Stilbokens penna för ${def.name}`, (tx) => tx.putDefinition(withPen(def, undefined)));
}
