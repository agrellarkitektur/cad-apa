import { updateParams } from '../core/commands';
import type { Element, ProjectDoc } from '../core/model';
import { fromRh, groundDefaults, toRh } from '../core/site';
import type { DocStore } from '../core/store';
import type { ViewStates } from '../core/states';
import { finishedTerrain, groundGeometry, groundLabel, isLineKind, m3, wallProfile, type GroundParams } from '../elements/ground';
import { massBalance } from '../elements/groundGeometry';
import { lineLength, PATH_WIDTH } from '../elements/groundLines';
import { rampLevels, rampRuns, rampSides, rampWarnings, sideEdge, tidyLevels } from '../elements/groundRamp';
import { fillFields } from './shapeFields';
import type { FillParams } from '../elements/drawing2d';
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
  // Massorna (0.10.13): netto, och schakten delad i berg och jord efter andelen berg.
  const mass = vol ? massBalance(vol, p.rock) : null;
  const signed = (v: number) => `${v > 0.05 ? '+' : v < -0.05 ? '−' : ''}${m3(Math.abs(v))}`;
  const volumes =
    vol && mass
      ? `<p class="note">Schakt ${m3(vol.cut)}, fyll ${m3(vol.fill)}, netto ${signed(mass.net)} ${mass.net > 0.05 ? '(tillförs)' : mass.net < -0.05 ? '(överskott)' : ''}${mass.rock !== null ? `. Av schakten berg ${m3(mass.rock)}, jord ${m3(mass.soil!)}` : ''}. Det objektet ändrar efter dem bakom i ritordningen.</p>`
      : '';
  if (vol) rows.push(field('rock', 'Berg i schakten', '%', p.rock, undefined, 'Uppskattad andel berg i det som schaktas; tomt = okänt'));
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

/**
 * Fyllningen för en markyta eller väg (0.10.7), med 2D-formens panel, och
 * slänternas egen (0.10.14) när kanterna möter marken med slänt.
 */
function groundFill(doc: ProjectDoc, p: GroundParams): string {
  const own = fillFields('ground-pattern-panel', { ...p, fillAngle: p.fillAngle ?? 45, fillSpacing: p.fillSpacing ?? 2 } as FillParams, (k) => `data-key="d2:${k}"`, doc.graphics);
  const sf = p.slopeFill;
  const slopes =
    p.edge === 'wall'
      ? ''
      : fillFields('ground-slope-panel', { ...sf, fillAngle: sf?.fillAngle ?? 45, fillSpacing: sf?.fillSpacing ?? 2 } as FillParams, (k) => `data-key="sf:${k}"`, doc.graphics, 'Slänternas fyllning');
  return `<div class="ground-fill">${own}</div>${slopes ? `<div class="ground-fill">${slopes}<p class="note">Ytan som släntmarkeringarna täcker, bakom objektets egen fyllning.</p></div>` : ''}`;
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
  /** Referenslinjen i mitten eller på en kant, med förskjutning (vägen 0.10.7, stödmuren 0.10.9). */
  const refRows = (q: GroundParams) => {
    const side = q.refSide ?? 'center';
    const opt = (v: string, l: string) => `<option value="${v}"${side === v ? ' selected' : ''}>${l}</option>`;
    const what = q.kind === 'wall' ? 'muren' : 'vägen';
    return `<label class="field" title="Sett i linjens riktning"><span>Referenslinjen</span><select data-key="ground:refSide">${opt('center', 'I mitten')}${opt('left', 'Vänster kant')}${opt('right', 'Höger kant')}</select></label>${field('refOffset', 'Förskjutning', 'mm', q.refOffset, 0, side === 'center' ? 'Positivt åt vänster i linjens riktning' : `Positivt utåt från ${what}, negativt mot mitten`)}`;
  };
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  if (p.kind === 'path') {
    // Rampen (0.10.18): referenslinjen styr lutningen, sidorna utbredningen, var sida för sig mot marken.
    const levels = rampLevels(p);
    const runs = rampRuns(levels);
    const drawn = !!(p.left || p.right);
    const derived = !(p.left && p.right);
    rows.push(`<label class="field"><span>Namn</span><input type="text" autocomplete="off" data-key="ground:name" value="${escapeHtml(p.name ?? '')}" placeholder="Ramp/väg"></label>`);
    rows.push(
      `<label class="field" title="Ritade sidor ändras med sina punkter i Modifiera och följer inte referenslinjen"><span>Sidorna</span><select data-key="ground:sides"><option value="">Följer referenslinjen</option><option value="drawn"${drawn ? ' selected' : ''}>${p.left && p.right ? 'Ritade' : 'Ritade (en)'}</option></select></label>`,
    );
    if (derived) {
      rows.push(field('width', 'Bredd', 'mm', p.width, PATH_WIDTH));
      rows.push(refRows(p));
    }
    rows.push(rh('height', 'Höjd i början', h0));
    rows.push(rh('endHeight', 'Höjd i slutet', h1));
    // Punkterna däremellan som har en höjd; tomt tar bort höjden.
    for (const l of levels) {
      if (l.i === 0 || l.i === pts.length - 1) continue;
      const v = site ? Math.round(toRh(site, l.h) * 1000) / 1000 : l.h;
      rows.push(
        `<label class="field" title="Tomt: punkten följer lutningen mellan grannarna"><span>Höjd i punkt ${l.i + 1}${site ? ' (RH 2000)' : ''}</span><span class="input-unit"><input type="text" inputmode="decimal" autocomplete="off" data-key="ground:level${l.i}" value="${v.toLocaleString('sv-SE', { maximumFractionDigits: 3 })}"><i>${site ? 'm' : 'mm'}</i></span></label>`,
      );
    }
    if (runs.length === 1) {
      const n = runs[0].ratio;
      rows.push(field('ratio' as keyof GroundParams, 'Lutning', '1:N', Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined, undefined, 'Ändrar höjden i slutet; tomt = plan'));
    }
    rows.push(field('maxSlope', 'Varna brantare än', '1:N', p.maxSlope, def.rampMax, 'Tomt = projektets förval under Platsen'));
    rows.push(field('crossFall', 'Tvärfall', '1:N', p.crossFall, undefined, 'Kring referenslinjen. Positivt faller åt höger i linjens riktning, negativt åt vänster; tomt = inget'));
    const sel = (key: string, label: string, v: 'slope' | 'wall', title: string) =>
      `<label class="field" title="${title}"><span>${label}</span><select data-key="ground:${key}"><option value="slope">Slänt</option><option value="wall"${v === 'wall' ? ' selected' : ''}>Stödmur</option></select></label>`;
    rows.push(sel('edge', 'Kanterna', p.edge ?? 'slope', 'Alla kanter: sidorna och ändarna. Sidorna kan sedan ändras för sig.'));
    rows.push(sel('leftEdge', 'Vänster sida', sideEdge(p, 'left'), 'Sett i linjens riktning'));
    rows.push(sel('rightEdge', 'Höger sida', sideEdge(p, 'right'), 'Sett i linjens riktning'));
    if ([sideEdge(p, 'left'), sideEdge(p, 'right'), p.edge ?? 'slope'].includes('slope')) rows.push(field('slope', 'Slänt', '1:N', p.slope, def.slope));
    const check = (key: 'startLine' | 'endLine', label: string) => `<label class="check"><input type="checkbox" data-key="ground:${key}"${p[key] !== false ? ' checked' : ''}> ${label}</label>`;
    notes.push(`<span class="row">${check('startLine', 'Tvärlinje i början')} ${check('endLine', 'Tvärlinje i slutet')}</span>`);
    const ratioText = (n: number) => (Number.isFinite(n) ? `1:${(Math.round(n * 10) / 10).toLocaleString('sv-SE')}` : 'plan');
    notes.push(
      `Längd ${(Math.round(lineLength(pts)) / 1000).toLocaleString('sv-SE')} m, höjdskillnad ${(Math.round(Math.abs(h1 - h0)) / 1000).toLocaleString('sv-SE')} m${runs.length > 1 ? `; lutningen ${runs.map((r) => ratioText(r.ratio)).join(', ')}` : ''}.`,
    );
    for (const w of rampWarnings(levels, p.maxSlope ?? def.rampMax, def)) notes.push(`<strong>${escapeHtml(w)}.</strong>`);
    notes.push(
      'Referenslinjen styr lutningen: punkterna med höjd (orange) ändras med <em>Höjd i punkten</em> i Modifiera, och mellan dem går rampen rakt. Sidorna ändras med sina punkter och lever sedan sitt eget liv. Klicka på en ände med verktyget Mark (Ramp/väg), eller <em>Förläng</em> i Modifiera, för att förlänga rampen. Vilplanets gränser står under Platsen.',
    );
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
    // Stödmuren (0.10.5; referenslinjen, ändarna, höjdpunkterna och rakt krön 0.10.9).
    rows.push(field('thickness', 'Tjocklek', 'mm', p.thickness, def.wallThickness));
    rows.push(refRows(p));
    const prof = wallProfile(ctx, el);
    const lvl = (h: number) => (site ? `+${toRh(site, h).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}` : `${Math.round(h)} mm`);
    rows.push(`<label class="field"><span>Krönet</span><select data-key="ground:straight"><option value="">Följer marken</option><option value="1"${p.straight ? ' selected' : ''}>Rakt</option></select></label>`);
    rows.push(`<label class="field" title="Sidan vars mark Över marken och krönet längs muren mäts mot"><span>Över marken mot</span><select data-key="ground:aboveSide"><option value="">Den högre sidan</option><option value="low"${p.aboveSide === 'low' ? ' selected' : ''}>Den lägre sidan</option></select></label>`);
    rows.push(field('above', 'Över marken i början', 'mm', p.above, 0, `Krönet över den ${p.aboveSide === 'low' ? 'lägre' : 'högre'} sidans mark; gäller när ÖK i början är tom`));
    rows.push(field('endAbove', 'Över marken i slutet', 'mm', p.endAbove, p.above ?? 0, 'Tomt = som i början; gäller när ÖK i slutet är tom'));
    rows.push(rh('height', 'ÖK i början', p.height, 'Tomt = över marken'));
    rows.push(rh('endHeight', 'ÖK i slutet', p.endHeight, 'Tomt = över marken'));
    (p.crest ?? []).forEach((c, i) => {
      const at = prof?.pins.find((q) => Math.hypot(q.at[0] - c.at[0], q.at[1] - c.at[1]) < 2000);
      const label = `Höjdpunkt ${i + 1}${at ? ` (${(Math.round(at.s / 100) / 10).toLocaleString('sv-SE')} m)` : ''}`;
      const v = site ? Math.round(toRh(site, c.h) * 1000) / 1000 : c.h;
      rows.push(`<label class="field" title="Tomt tar bort höjdpunkten"><span>${label}</span><span class="input-unit"><input type="text" inputmode="decimal" autocomplete="off" data-key="ground:crest${i}" value="${v.toLocaleString('sv-SE', { maximumFractionDigits: 3 })}"><i>${site ? 'm' : 'mm'}</i></span></label>`);
    });
    if (prof) notes.push(`Krönet ${lvl(prof.start)} i början och ${lvl(prof.end)} i slutet, högst ${lvl(prof.top)}; foten lägst ${lvl(prof.bottom)} (300 under den lägre sidan).`);
    notes.push('Höjdpunkter läggs till med <em>Höjdpunkt på krönet</em> i Modifiera: klicka på referenslinjen och skriv höjden. Dra romben för att flytta punkten längs muren; ett tomt fält tar bort den. Krönet går genom dem. Referenslinjen syns när muren är markerad.');
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
  if (name === 'aboveSide') {
    updateParams(store, ids, { aboveSide: input.value === 'low' ? 'low' : undefined }, input.value === 'low' ? 'Över den lägre sidans mark' : 'Över den högre sidans mark');
    return true;
  }
  if (name === 'straight') {
    updateParams(store, ids, { straight: input.value ? true : undefined }, input.value ? 'Rakt krön' : 'Krönet följer marken');
    return true;
  }
  // Stödmurens höjdpunkter (0.10.9): tomt tar bort.
  const pin = /^crest(\d+)$/.exec(name);
  if (pin) {
    const k = Number(pin[1]);
    const raw = input.value.replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const v = Number(raw);
    if (raw !== '' && !Number.isFinite(v)) return false;
    for (const id of ids) {
      const list = [...(resolveParams<GroundParams>(doc, doc.elements[id]).crest ?? [])];
      if (!list[k]) continue;
      if (raw === '') list.splice(k, 1);
      else list[k] = { ...list[k], h: doc.site ? Math.round(fromRh(doc.site, v)) : Math.round(v) };
      updateParams(store, [id], { crest: list.length ? list : undefined }, raw === '' ? 'Ta bort höjdpunkt' : 'Ändra höjdpunkten');
    }
    return true;
  }
  if (name === 'startLine' || name === 'endLine') {
    const on = (input as HTMLInputElement).checked;
    updateParams(store, ids, { [name]: on ? undefined : false }, on ? 'Tvärlinje' : 'Ingen tvärlinje');
    return true;
  }
  if (name === 'edge') {
    // Alla kanter, också rampens sidor som ändrats för sig (0.10.18).
    updateParams(store, ids, { edge: input.value === 'wall' ? 'wall' : undefined, leftEdge: undefined, rightEdge: undefined }, input.value === 'wall' ? 'Stödmur' : 'Slänt');
    return true;
  }
  if (name === 'leftEdge' || name === 'rightEdge') {
    // Samma som kanterna behöver inte stå för sig.
    for (const id of ids) {
      const edge = resolveParams<GroundParams>(doc, doc.elements[id]).edge ?? 'slope';
      const v = input.value === 'wall' ? 'wall' : 'slope';
      updateParams(store, [id], { [name]: v === edge ? undefined : v }, v === 'wall' ? 'Stödmur på sidan' : 'Slänt på sidan');
    }
    return true;
  }
  if (name === 'sides') {
    // Ritade sidor (0.10.18) börjar där de låg; att följa referenslinjen tar bort dem.
    for (const id of ids) {
      const p = resolveParams<GroundParams>(doc, doc.elements[id]);
      const r = (q: readonly (readonly [number, number])[]) => q.map((v): [number, number] => [Math.round(v[0]), Math.round(v[1])]);
      const sides = rampSides(p);
      updateParams(store, [id], input.value === 'drawn' ? { left: r(sides.left), right: r(sides.right) } : { left: undefined, right: undefined }, input.value === 'drawn' ? 'Ritade sidor' : 'Sidorna följer referenslinjen');
    }
    return true;
  }
  // Rampens höjd i en punkt (0.10.18): tomt tar bort den.
  const lv = /^level(\d+)$/.exec(name);
  if (lv) {
    const k = Number(lv[1]);
    const raw = input.value.replace(/\s/g, '').replace(',', '.').replace('−', '-');
    const v = Number(raw);
    if (raw !== '' && !Number.isFinite(v)) return false;
    for (const id of ids) {
      const list = [...(resolveParams<GroundParams>(doc, doc.elements[id]).levels ?? [])];
      while (list.length <= k) list.push(null);
      list[k] = raw === '' ? null : doc.site ? Math.round(fromRh(doc.site, v)) : Math.round(v);
      updateParams(store, [id], { levels: tidyLevels(list) }, raw === '' ? 'Ta bort höjden' : 'Höjd i punkten');
    }
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
      // Längs referenslinjen, som styr lutningen (0.10.18; mittlinjen före det).
      const rise = Number.isFinite(n) ? lineLength(p.line ?? []) / n : 0;
      updateParams(store, [id], { endHeight: Math.round(h0 + (up ? rise : -rise)) }, 'Ändra lutningen');
    }
    return true;
  }
  if (name === 'rock' && raw !== '') {
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0 || v > 100) return false;
    updateParams(store, ids, { rock: v }, 'Ändra andelen berg');
    return true;
  }
  if (name === 'crossFall' && raw !== '') {
    const v = Number(raw);
    if (!Number.isFinite(v) || v === 0) return false;
    updateParams(store, ids, { crossFall: v }, 'Ändra tvärfallet');
    return true;
  }
  // Stödmurens ÖK i ändarna: tomt följer marken.
  if (raw === '' && (name === 'height' || name === 'endHeight') && ids.every((id) => doc.elements[id]?.params.kind === 'wall')) {
    updateParams(store, ids, { [name]: undefined }, 'Krönet följer marken');
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
  if (v < 0 || (v === 0 && name !== 'fall' && name !== 'distance' && name !== 'margin' && name !== 'sockel' && name !== 'above' && name !== 'endAbove')) return false;
  const labels: Record<string, string> = { maxSlope: 'Ändra gränsen', width: 'Ändra bredden', radius: 'Ändra radien', thickness: 'Ändra tjockleken', above: 'Ändra krönet', endAbove: 'Ändra krönet', fall: 'Ändra fallet', slope: 'Ändra slänten', distance: 'Ändra avståndet', sockel: 'Ändra sockeln', fallLength: 'Ändra fallets längd', margin: 'Ändra arbetsutrymmet' };
  updateParams(store, ids, { [name]: v }, labels[name] ?? 'Ändra');
  return true;
}
