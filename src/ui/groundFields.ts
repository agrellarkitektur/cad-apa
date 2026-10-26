import { updateParams } from '../core/commands';
import type { Element, ProjectDoc } from '../core/model';
import { fromRh, groundDefaults, toRh } from '../core/site';
import type { DocStore } from '../core/store';
import type { ViewStates } from '../core/states';
import { finishedTerrain, groundGeometry, groundLabel, isLineKind, m3, wallCrest, type GroundParams } from '../elements/ground';
import { centerShift, lineLength, offsetLine, PATH_WIDTH, pathRatio, pathWarnings } from '../elements/groundLines';
import { fillFields } from './shapeFields';
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
  if (isLineKind(p.kind)) return lineFields(doc, el, p, ctx, field);
  if (!p.around && !p.slab) {
    const h = p.height ?? 0;
    rows.push(site ? field('height', 'Höjd (RH 2000)', 'm', Math.round(toRh(site, h) * 1000) / 1000) : field('height', 'Höjd', 'mm', h));
    rows.push(field('fall', 'Fall', '1:N', p.fall || undefined, undefined, 'Tomt = plan'));
    if (p.fall) rows.push(field('fallDir', 'Faller åt', '°', p.fallDir ?? 0, undefined, 'Grader moturs från planens x-axel'));
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
      : 'Konturen är markytans plana yta. Där marken ligger högre tas den ned (schakt), där den ligger lägre fylls den upp; kanterna möter den med slänt eller stödmur. Med fall gäller höjden i konturens mitt. Ändra konturen med hörnen och kanterna.';
  return `<div class="field-label">${escapeHtml(groundLabel(p))}</div>
    <div class="fields">${rows.join('')}${edge}</div>
    ${level}${volumes}
    <p class="note">${what} Tomma fält följer projektets förval under Platsen.</p>
    ${groundFill(doc, p)}`;
}

/** Fyllningen för en markyta eller väg (0.10.7), med 2D-formens fält. */
function groundFill(doc: ProjectDoc, p: GroundParams): string {
  return `<div class="ground-fill">${fillFields('ground-pattern-panel', { ...p, fillAngle: p.fillAngle ?? 45, fillSpacing: p.fillSpacing ?? 2 }, (k) => `data-key="d2:${k}"`, doc.graphics)}</div>`;
}

type Field = (key: keyof GroundParams, label: string, unit: string, own: number | undefined, fallback?: number, title?: string) => string;

/** Ramp/väg, höjdpunkt, brytlinje och stödmur (0.10.5). */
function lineFields(doc: ProjectDoc, el: Element, p: GroundParams, ctx: ReturnType<typeof createContext>['ctx'], field: Field): string {
  const def = groundDefaults(doc.site);
  const site = doc.site;
  const rh = (key: 'height' | 'endHeight', label: string, v: number | undefined, title?: string) =>
    site ? field(key, `${label} (RH 2000)`, 'm', v === undefined ? undefined : Math.round(toRh(site, v) * 1000) / 1000, undefined, title) : field(key, label, 'mm', v, undefined, title);
  const rows: string[] = [];
  const notes: string[] = [];
  const pts = p.line ?? [];
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  if (p.kind === 'path') {
    const g = groundGeometry(ctx, el);
    const center = g?.center ?? pts;
    rows.push(`<label class="field"><span>Namn</span><input type="text" autocomplete="off" data-key="ground:name" value="${escapeHtml(p.name ?? '')}" placeholder="Ramp/väg"></label>`);
    rows.push(field('width', 'Bredd', 'mm', p.width, PATH_WIDTH));
    const side = p.refSide ?? 'center';
    const opt = (v: string, l: string) => `<option value="${v}"${side === v ? ' selected' : ''}>${l}</option>`;
    rows.push(`<label class="field" title="Sett i linjens riktning"><span>Referenslinjen</span><select data-key="ground:refSide">${opt('center', 'I mitten')}${opt('left', 'Vänster kant')}${opt('right', 'Höger kant')}</select></label>`);
    rows.push(field('refOffset', 'Förskjutning', 'mm', p.refOffset, 0, side === 'center' ? 'Positivt åt vänster i linjens riktning' : 'Positivt utåt från vägen, negativt mot mitten'));
    rows.push(rh('height', 'Höjd i början', h0));
    rows.push(rh('endHeight', 'Höjd i slutet', h1));
    const n = pathRatio(center, h0, h1);
    rows.push(field('ratio' as keyof GroundParams, 'Lutning', '1:N', Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined, undefined, 'Ändrar höjden i slutet; tomt = plan'));
    rows.push(field('maxSlope', 'Varna brantare än', '1:N', p.maxSlope, def.rampMax, 'Tomt = projektets förval under Platsen'));
    rows.push(field('crossFall', 'Tvärfall', '1:N', p.crossFall, undefined, 'Positivt faller åt höger i linjens riktning, negativt åt vänster; tomt = inget'));
    if (p.edge !== 'wall') rows.push(field('slope', 'Slänt', '1:N', p.slope, def.slope));
    rows.push(`<label class="field"><span>Sidorna</span><select data-key="ground:edge"><option value="slope">Slänt</option><option value="wall"${p.edge === 'wall' ? ' selected' : ''}>Stödmur</option></select></label>`);
    const check = (key: 'startLine' | 'endLine', label: string) => `<label class="check"><input type="checkbox" data-key="ground:${key}"${p[key] !== false ? ' checked' : ''}> ${label}</label>`;
    notes.push(`<span class="row">${check('startLine', 'Tvärlinje i början')} ${check('endLine', 'Tvärlinje i slutet')}</span>`);
    notes.push(`Längd ${(Math.round(lineLength(center)) / 1000).toLocaleString('sv-SE')} m, höjdskillnad ${(Math.round(Math.abs(h1 - h0)) / 1000).toLocaleString('sv-SE')} m.`);
    for (const w of pathWarnings(center, h0, h1, p.maxSlope ?? def.rampMax, def)) notes.push(`<strong>${escapeHtml(w)}.</strong>`);
    notes.push('Referenslinjen ändras med punkterna och syns när vägen är markerad. Vilplanets gränser står under Platsen.');
  } else if (p.kind === 'point') {
    rows.push(rh('height', 'Höjd', h0));
    rows.push(field('radius', 'Tonas inom', 'mm', p.radius, def.blend));
    notes.push('Låser marken i punkten; marken runt omkring tonas mot den.');
  } else if (p.kind === 'breakline') {
    rows.push(rh('height', 'Höjd i början', h0));
    rows.push(rh('endHeight', 'Höjd i slutet', h1));
    rows.push(field('radius', 'Tonas inom', 'mm', p.radius, def.blend));
    notes.push('Låser marken längs linjen (höjden rakt mellan ändarna); marken runt omkring tonas mot den.');
  } else {
    rows.push(field('thickness', 'Tjocklek', 'mm', p.thickness, def.wallThickness));
    rows.push(rh('height', 'Krön', p.height, 'Tomt = följer den högre sidans mark'));
    if (p.height === undefined) rows.push(field('above', 'Över marken', 'mm', p.above, 0, 'Krönet över den högre sidans högsta mark'));
    const c = wallCrest(ctx, el);
    if (c && site) notes.push(`Krön +${toRh(site, c.top).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}, fot +${toRh(site, c.bottom).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} (300 under den lägre sidan).`);
    notes.push('Slänterna från markobjekten går inte över muren: marken bakom den är orörd.');
  }
  return `<div class="field-label">${escapeHtml(groundLabel(p))}</div>
    <div class="fields">${rows.join('')}</div>
    ${notes.map((n) => `<p class="note">${n}</p>`).join('')}
    ${p.kind === 'path' ? groundFill(doc, p) : ''}`;
}

/** Ett ändrat fält i markobjektets egenskaper. */
export function applyGroundField(store: DocStore, ids: string[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const doc = store.doc;
  if (name === 'name') {
    const v = input.value.trim();
    updateParams(store, ids, { name: v || undefined }, 'Ändra namnet');
    return true;
  }
  if (name === 'refSide') {
    updateParams(store, ids, { refSide: input.value === 'left' || input.value === 'right' ? input.value : undefined }, 'Flytta referenslinjen');
    return true;
  }
  if (name === 'startLine' || name === 'endLine') {
    const on = (input as HTMLInputElement).checked;
    updateParams(store, ids, { [name]: on ? undefined : false }, on ? 'Tvärlinje' : 'Ingen tvärlinje');
    return true;
  }
  if (name === 'edge') {
    updateParams(store, ids, { edge: input.value === 'wall' ? 'wall' : undefined }, input.value === 'wall' ? 'Stödmur' : 'Slänt');
    return true;
  }
  const raw = input.value.replace(/\s/g, '').replace(',', '.').replace('−', '-');
  if (name === 'ratio') {
    // Lutningen ändrar höjden i slutet, åt samma håll som förut (uppåt om den var plan).
    for (const id of ids) {
      const p = resolveParams<GroundParams>(doc, doc.elements[id]);
      const h0 = p.height ?? 0;
      const up = (p.endHeight ?? h0) >= h0;
      const n = raw === '' ? Infinity : Number(raw);
      if (!(n > 0)) return false;
      // Längs vägens mittlinje, som kan ligga vid sidan av referenslinjen (0.10.7).
      const w = Math.max(100, p.width ?? PATH_WIDTH);
      const pts = p.line ?? [];
      const c = centerShift(p.refSide, p.refOffset, w);
      const rise = Number.isFinite(n) ? lineLength(Math.abs(c) > 0.5 && pts.length >= 2 ? offsetLine(pts, c) : pts) / n : 0;
      updateParams(store, [id], { endHeight: Math.round(h0 + (up ? rise : -rise)) }, 'Ändra lutningen');
    }
    return true;
  }
  if (name === 'crossFall' && raw !== '') {
    const v = Number(raw);
    if (!Number.isFinite(v) || v === 0) return false;
    updateParams(store, ids, { crossFall: v }, 'Ändra tvärfallet');
    return true;
  }
  // Stödmurens krön: tomt följer marken.
  if (raw === '' && name === 'height' && ids.every((id) => doc.elements[id]?.params.kind === 'wall')) {
    updateParams(store, ids, { height: undefined }, 'Krönet följer marken');
    return true;
  }
  if (raw === '' && name !== 'height' && name !== 'endHeight') {
    updateParams(store, ids, { [name]: undefined }, 'Projektets förval');
    return true;
  }
  const v = Number(raw);
  if (!Number.isFinite(v)) return false;
  if (name === 'height' || name === 'endHeight') {
    const mm = doc.site ? Math.round(fromRh(doc.site, v)) : Math.round(v);
    updateParams(store, ids, { [name]: mm }, 'Ändra höjden');
    return true;
  }
  if (name === 'refOffset') {
    updateParams(store, ids, { refOffset: Math.round(v) || undefined }, 'Förskjut referenslinjen');
    return true;
  }
  if (name === 'fallDir') {
    updateParams(store, ids, { fallDir: ((v % 360) + 360) % 360 }, 'Ändra fallets riktning');
    return true;
  }
  if (v < 0 || (v === 0 && name !== 'fall' && name !== 'distance' && name !== 'margin' && name !== 'sockel' && name !== 'above')) return false;
  const labels: Record<string, string> = { maxSlope: 'Ändra gränsen', width: 'Ändra bredden', radius: 'Ändra radien', thickness: 'Ändra tjockleken', above: 'Ändra krönet', fall: 'Ändra fallet', slope: 'Ändra slänten', distance: 'Ändra avståndet', sockel: 'Ändra sockeln', fallLength: 'Ändra fallets längd', margin: 'Ändra arbetsutrymmet' };
  updateParams(store, ids, { [name]: v }, labels[name] ?? 'Ändra');
  return true;
}
