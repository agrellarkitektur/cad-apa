import { isSite, onPaper, type Id, type ProjectDoc } from '../core/model';
import { resolveSource, sourceName, type UnderlayHost } from '../core/underlaySources';
import { TRACE_ABOVE, TRACE_BELOW, TRACE_SITE, TRACE_STOREY } from '../core/storeys';
import { UNDERLAY_COLOR, UNDERLAY_LOOKS, UNDERLAY_OPACITY, UNDERLAY_ORTHO, UNDERLAY_WORKSHEET, type UnderlayLook, type ViewUnderlay } from '../core/viewUnderlays';
import type { MenuItem } from './contextMenu';
import { icons } from './icons';
import { escapeHtml } from './labels';

/**
 * Underlagen som rader (0.10.35), under Visa och i stilboken: namnet,
 * under/över som två lagerikoner, sättet som en lista, färgen när sättet är
 * *I en färg*, procent och ta bort. Fälten har `data-ul` (radens nummer) och
 * `data-ul-field`; `editUnderlays` läser dem.
 */
export function underlayRowsMarkup(doc: ProjectDoc, list: readonly ViewUnderlay[], host: UnderlayHost | null, add = '<button type="button" class="btn ul-add" data-ul-add>' + icons.plus + '<span>Lägg till underlag…</span></button>'): string {
  const rows = list.map((u, i) => {
    const missing = host ? !resolveSource(doc, host, u.source) : false;
    const look = u.look ?? 'tinted';
    const name = sourceName(doc, u.source, host?.storey);
    return `<div class="ul-row${missing ? ' ul-missing' : ''}" data-ul-row="${i}">
      <div class="ul-top">
        <span class="ul-name" title="${escapeHtml(missing ? `${name} – syns inte här` : name)}">${escapeHtml(name)}</span>
        <button type="button" class="icon-btn" data-ul="${i}" data-ul-field="remove" title="Ta bort underlaget" aria-label="Ta bort underlaget">${icons.trash}</button>
      </div>
      <div class="ul-ctl">
        <span class="segmented ul-layer" role="group" aria-label="Under eller över ritningen">
          <button type="button" data-ul="${i}" data-ul-field="above" data-v="0" aria-pressed="${!u.above}" title="Under ritningen">${icons.layerBelow}</button>
          <button type="button" data-ul="${i}" data-ul-field="above" data-v="1" aria-pressed="${!!u.above}" title="Över ritningen">${icons.layerAbove}</button>
        </span>
        <select data-ul="${i}" data-ul-field="look" aria-label="Sättet">${UNDERLAY_LOOKS.map((l) => `<option value="${l.id}"${l.id === look ? ' selected' : ''}>${l.name}</option>`).join('')}</select>
        ${look === 'color' ? `<input type="color" data-ul="${i}" data-ul-field="color" value="${u.color ?? UNDERLAY_COLOR}" aria-label="Färgen">` : ''}
        <label class="ul-pct"><input type="number" data-ul="${i}" data-ul-field="opacity" min="5" max="100" step="5" value="${u.opacity ?? UNDERLAY_OPACITY}" aria-label="Täckning"> %</label>
      </div>
    </div>`;
  });
  return `<div class="ul-list">${rows.join('') || '<p class="note ul-empty">Inga underlag.</p>'}${add}</div>`;
}

/** Listan efter en ändring i ett av radernas fält, eller null om elementet inte är ett. */
export function editUnderlays(list: readonly ViewUnderlay[], el: Element): ViewUnderlay[] | null {
  const f = el.closest<HTMLElement>('[data-ul-field]');
  if (!f) return null;
  const i = Number(f.dataset.ul);
  const u = list[i];
  if (!u) return null;
  const value = (f as HTMLInputElement).value;
  const next = list.map((x) => ({ ...x }));
  const row = next[i];
  switch (f.dataset.ulField) {
    case 'remove':
      next.splice(i, 1);
      return next;
    case 'above':
      if (f.dataset.v === '1') row.above = true;
      else delete row.above;
      break;
    case 'look': {
      const look = value as UnderlayLook;
      if (look === 'tinted') delete row.look;
      else row.look = look;
      if (look === 'color' && !row.color) row.color = UNDERLAY_COLOR;
      break;
    }
    case 'color':
      row.color = value.toLowerCase();
      break;
    case 'opacity': {
      const n = Math.min(100, Math.max(5, Math.round(Number(value) || UNDERLAY_OPACITY)));
      if (n === UNDERLAY_OPACITY) delete row.opacity;
      else row.opacity = n;
      break;
    }
    default:
      return null;
  }
  return next;
}

/**
 * Det som går att lägga som underlag där man är, som menyns rader: våningarna
 * (under, över, Platsen, var och en), ortofotot, arbetsbladen och vyerna. En
 * fasad, sektion eller ett arbetsblad har bara arbetsblad och vyer. Det som
 * redan ligger i listan är ikryssat och tas bort med samma rad.
 */
export function underlaySourceItems(doc: ProjectDoc, host: UnderlayHost, list: readonly ViewUnderlay[], pick: (source: string) => void): (MenuItem & { source?: string })[] {
  const items: (MenuItem & { source?: string })[] = [];
  const has = (s: string) => list.some((u) => u.source === s);
  const row = (source: string, label: string, sub?: string): MenuItem & { source?: string } => ({ label, checked: has(source), source, ...(sub ? { sub } : {}), run: () => pick(source) });
  // En kategori (stilboken) har ingen våning: under och över gäller där vyn står.
  const generic = !host.storey;
  if (host.plan) {
    const onSite = isSite(host.storey);
    items.push({ kind: 'header', label: 'Våningar och Platsen' });
    if (generic) items.push(row(TRACE_BELOW, 'Våningen under'), row(TRACE_ABOVE, 'Våningen över'), ...(doc.site ? [row(TRACE_SITE, 'Platsen (marken)')] : []));
    else if (!onSite) {
      for (const s of [TRACE_BELOW, TRACE_ABOVE]) if (resolveSource(doc, host, s)) items.push(row(s, sourceName(doc, s, host.storey)));
      if (resolveSource(doc, host, TRACE_SITE)) items.push(row(TRACE_SITE, 'Platsen (marken)'));
    }
    for (const s of doc.storeys) if (!s.site && s.id !== host.storey) items.push(row(TRACE_STOREY + s.id, s.name));
    if (resolveSource(doc, { ...host, storey: host.storey || doc.storeys[0].id }, UNDERLAY_ORTHO)) items.push(row(UNDERLAY_ORTHO, 'Ortofotot', doc.site?.ortho?.year ? `Flygfoto ${doc.site.ortho.year}` : 'Flygfoto'));
  }
  const sheets = doc.worksheets.filter((w) => !onPaper(w));
  if (sheets.length) {
    items.push({ kind: 'header', label: 'Arbetsblad' });
    for (const w of sheets) items.push(row(UNDERLAY_WORKSHEET + w.id, w.name));
  }
  const views = doc.views.filter((v) => v.id !== host.viewId);
  if (views.length) {
    items.push({ kind: 'header', label: 'Vyer' });
    for (const v of views) items.push(row(v.id, v.name));
  }
  return items;
}

/** Var underlagen står för en vy som visas just nu, eller för en sparad vy. */
export function hostFor(storey: Id, opts: { marker?: Id | null; worksheet?: Id | null; viewId?: Id | null }): UnderlayHost {
  return { storey, plan: !opts.marker && !opts.worksheet, ...(opts.viewId ? { viewId: opts.viewId } : {}) };
}

/**
 * *Lägg till underlag…* som en lista (stilboken, 0.10.35), med samma källor
 * som menyn under Visa. Det som redan ligger i listan är inte med.
 */
export function underlayAddSelect(doc: ProjectDoc, host: UnderlayHost, list: readonly ViewUnderlay[]): string {
  let html = '<option value="">Lägg till underlag…</option>';
  let open = false;
  for (const it of underlaySourceItems(doc, host, list, () => {})) {
    if ('kind' in it && it.kind === 'header') {
      html += `${open ? '</optgroup>' : ''}<optgroup label="${escapeHtml(it.label)}">`;
      open = true;
    } else if (!('kind' in it) && !it.checked) html += `<option value="${escapeHtml(it.source ?? '')}">${escapeHtml(it.label)}</option>`;
  }
  return `<select class="ul-addsel" data-ul-addsel aria-label="Lägg till underlag">${html}${open ? '</optgroup>' : ''}</select>`;
}
