import { updateParams } from '../core/commands';
import type { Element, ProjectDoc } from '../core/model';
import { fromRh, groundDefaults, toRh } from '../core/site';
import type { DocStore } from '../core/store';
import type { ViewStates } from '../core/states';
import { finishedTerrain, groundGeometry, groundLabel, m3, type GroundParams } from '../elements/ground';
import { resolveParams } from '../elements/registry';
import { createContext } from '../repr/context';
import { escapeHtml } from './labels';

/**
 * Markobjektets egenskaper (0.10.4). Höjden skrivs i RH 2000 (m) när
 * projektet har en plats, annars i mm från ±0. Ett tomt fält betyder
 * projektets förval (dialogen *Platsen*), som visas i fältet.
 */
export function groundFieldsMarkup(doc: ProjectDoc, el: Element, view: ViewStates): string {
  const p = resolveParams<GroundParams>(doc, el);
  const def = groundDefaults(doc.site);
  const site = doc.site;
  const { ctx } = createContext(doc, el.storey, view, doc.graphics, () => true);
  const g = groundGeometry(ctx, el);
  const f = finishedTerrain(ctx);
  const vol = f?.volumes.get(el.id);
  const num = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });
  const field = (key: keyof GroundParams, label: string, unit: string, own: number | undefined, fallback?: number, title?: string) =>
    `<label class="field"${title ? ` title="${escapeHtml(title)}"` : ''}><span>${label}</span><span class="input-unit"><input type="text" inputmode="decimal" autocomplete="off" data-key="ground:${key}" value="${own === undefined ? '' : num(own)}"${fallback !== undefined ? ` placeholder="${num(fallback)}"` : ''}><i>${unit}</i></span></label>`;
  const rows: string[] = [];
  if (!p.around && !p.slab) {
    const h = p.height ?? 0;
    rows.push(site ? field('height', p.kind === 'excavation' ? 'Botten (RH 2000)' : 'Höjd (RH 2000)', 'm', Math.round(toRh(site, h) * 1000) / 1000) : field('height', p.kind === 'excavation' ? 'Botten' : 'Höjd', 'mm', h));
    if (p.kind === 'plateau') {
      rows.push(field('fall', 'Fall', '1:N', p.fall || undefined, undefined, 'Tomt = plan'));
      if (p.fall) rows.push(field('fallDir', 'Faller åt', '°', p.fallDir ?? 0, undefined, 'Grader moturs från planens x-axel'));
    }
  }
  if (p.around) {
    rows.push(field('distance', 'Ut från fasaden', 'mm', p.distance, def.distance));
    rows.push(field('sockel', 'Sockel', 'mm', p.sockel, def.sockel, 'Från golvet ned till marken vid fasaden'));
    rows.push(field('fall', 'Fall', '1:N', p.fall, def.fall));
    rows.push(field('fallLength', 'Fallet gäller ut', 'mm', p.fallLength, def.fallLength));
  }
  if (p.slab) rows.push(field('margin', 'Arbetsutrymme', 'mm', p.margin, def.margin));
  if (p.edge !== 'wall') rows.push(field('slope', 'Slänt', '1:N', p.slope, def.slope));
  const edge = `<label class="field"><span>Kanterna</span><select data-key="ground:edge"><option value="slope">Slänt</option><option value="wall"${p.edge === 'wall' ? ' selected' : ''}>Stödmur</option></select></label>`;
  const level = g && site ? `<p class="note">${p.slab ? `Botten +${toRh(site, g.label.height).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}, bjälklagets underkant. ` : p.around ? `Marken vid fasaden +${toRh(site, g.label.height).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}. ` : ''}</p>` : '';
  const volumes = vol ? `<p class="note">Schakt ${m3(vol.cut)}, fyll ${m3(vol.fill)} (det objektet ändrar efter dem bakom i ritordningen).</p>` : '';
  const what = p.around
    ? 'Följer husets kontur. Marken faller från fasaden och möter den befintliga med slänt eller stödmur.'
    : p.slab
      ? 'Följer bjälklaget (och väggarna, när bjälklaget följer dem). Slänten går utåt från botten och tar bara ned marken.'
      : p.kind === 'excavation'
        ? 'Konturen är botten; slänten går utåt och tar bara ned marken. Ändra konturen med hörnen och kanterna.'
        : 'Konturen är platåns plana yta; kanterna möter marken med slänt eller stödmur. Med fall gäller höjden i konturens mitt. Ändra konturen med hörnen och kanterna.';
  return `<div class="field-label">${escapeHtml(groundLabel(p))}</div>
    <div class="fields">${rows.join('')}${edge}</div>
    ${level}${volumes}
    <p class="note">${what} Tomma fält följer projektets förval under Platsen.</p>`;
}

/** Ett ändrat fält i markobjektets egenskaper. */
export function applyGroundField(store: DocStore, ids: string[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const doc = store.doc;
  if (name === 'edge') {
    updateParams(store, ids, { edge: input.value === 'wall' ? 'wall' : undefined }, input.value === 'wall' ? 'Stödmur' : 'Slänt');
    return true;
  }
  const raw = input.value.replace(/\s/g, '').replace(',', '.').replace('−', '-');
  if (raw === '' && name !== 'height') {
    updateParams(store, ids, { [name]: undefined }, 'Projektets förval');
    return true;
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) return false;
  if (name === 'height') {
    const mm = doc.site ? Math.round(fromRh(doc.site, v)) : Math.round(v);
    updateParams(store, ids, { height: mm }, 'Ändra höjden');
    return true;
  }
  if (name === 'fallDir') {
    updateParams(store, ids, { fallDir: ((v % 360) + 360) % 360 }, 'Ändra fallets riktning');
    return true;
  }
  if (v < 0 || (v === 0 && name !== 'fall' && name !== 'distance' && name !== 'margin' && name !== 'sockel')) return false;
  const labels: Record<string, string> = { fall: 'Ändra fallet', slope: 'Ändra slänten', distance: 'Ändra avståndet', sockel: 'Ändra sockeln', fallLength: 'Ändra fallets längd', margin: 'Ändra arbetsutrymmet' };
  updateParams(store, ids, { [name]: v }, labels[name] ?? 'Ändra');
  return true;
}
