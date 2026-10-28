import type { Element, ProjectDoc } from '../core/model';
import { groundDefaults, toRh } from '../core/site';
import type { ViewStates } from '../core/states';
import { finishedTerrain, groundGeometry, groundLabel, isLineKind, m3, wallProfile, type GroundParams } from '../elements/ground';
import { massBalance } from '../elements/groundGeometry';
import { lineLength, PATH_WIDTH } from '../elements/groundLines';
import { easeRadiusAt, rampProfile, rampWarnings, refPoints, sideEdge } from '../elements/groundRamp';
import { groundText, levelStatus, wallLittera } from '../elements/groundMarks';
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
    rows.push(field('minCross', 'Minsta sidolutning', '%', p.minCross, undefined, 'Skrivs ut understruken under höjden (0.10.20); tomt = skrivs inte'));
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
    const { levels, runs } = rampProfile(p, def);
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
    rows.push(field('minCross', 'Minsta sidolutning', '%', p.minCross, undefined, 'Skrivs ut understruken över namnet (0.10.20); tomt = skrivs inte'));
    // Mjuka övergångar (0.10.19): en vertikal kurva i början, slutet och punkterna med höjd, i stället för en skarp brytning.
    rows.push(
      `<label class="field" title="Skarpa: höjden bryts i punkterna, som ett vilplan i en betongramp. Mjuka: en vertikal kurva med radien, som en gångväg; rampen börjar och slutar plant"><span>Övergångarna</span><select data-key="ground:ease"><option value="">Skarpa</option><option value="soft"${p.ease ? ' selected' : ''}>Mjuka</option></select></label>`,
    );
    if (p.ease || p.eases?.some((e) => e?.ease)) rows.push(field('easeRadius', 'Övergångarnas radie', 'mm', p.easeRadius, def.easeRadius, 'Den vertikala kurvans radie; tomt = projektets förval under Platsen'));
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
      `Längd ${(Math.round(lineLength(refPoints(p))) / 1000).toLocaleString('sv-SE')} m, höjdskillnad ${(Math.round(Math.abs(h1 - h0)) / 1000).toLocaleString('sv-SE')} m${runs.length > 1 ? `; lutningen ${runs.map((r) => ratioText(r.ratio)).join(', ')}` : ''}${runs.some((r) => r.la || r.lb) ? ' (den raka delen, mellan övergångarna)' : ''}.`,
    );
    const own = (p.eases ?? []).map((e, i) => (e ? `punkt ${i + 1} ${e.ease ? `mjuk${easeRadiusAt(p, i, def) !== Math.max(100, p.easeRadius ?? def.easeRadius) ? ` (radie ${(easeRadiusAt(p, i, def) / 1000).toLocaleString('sv-SE')} m)` : ''}` : 'skarp'}` : '')).filter(Boolean);
    if (own.length) notes.push(`Egen övergång i ${own.join(', ')} (<em>Övergång i punkten</em> i Modifiera).`);
    for (const w of rampWarnings(levels, p.maxSlope ?? def.rampMax, def, p)) notes.push(`<strong>${escapeHtml(w)}.</strong>`);
    notes.push(
      'Referenslinjen styr lutningen: punkterna med höjd (orange) ändras med <em>Höjd i punkten</em> i Modifiera, och mellan dem går rampen rakt, med skarp eller mjuk övergång i punkterna (<em>Övergångarna</em>, och per punkt med <em>Mjuk övergång</em> och <em>Skarp övergång</em> i Modifiera). Referenslinjen och sidorna kan få bågar med Böj och Avrunda. Sidorna ändras med sina punkter och lever sedan sitt eget liv. Klicka på en ände med verktyget Mark (Ramp/väg), eller <em>Förläng</em> i Modifiera, för att förlänga rampen; två ramper vars ändar möts dockas med <em>Foga ihop</em>. Vilplanets gränser står under Platsen.',
    );
  } else if (p.kind === 'point') {
    rows.push(rh('height', 'Höjd', h0));
    rows.push(field('radius', 'Tonas inom', 'mm', p.radius, def.blend));
    notes.push('Låser marken i punkten; marken runt omkring tonas mot den.');
  } else if (p.kind === 'level') {
    // Markhöjden (0.10.20): en egen ny höjd, annars den färdiga markens.
    rows.push(rh('height', 'Ny höjd', p.height, 'Tomt = den färdiga markens höjd i punkten'));
    const st = levelStatus(ctx, p, pts[0] ?? [0, 0]);
    notes.push(
      st.existing === null
        ? 'Ingen mark i punkten.'
        : st.proposed === null
          ? `Befintlig mark ${escapeHtml(groundText(ctx, st.existing))}, oförändrad: skrivs understruken.`
          : `Ny höjd ${escapeHtml(groundText(ctx, st.proposed))}; den befintliga ${escapeHtml(groundText(ctx, st.existing))} utgår och skrivs inom parentes.`,
    );
    notes.push('Markhöjden ändrar inte marken. Befintlig höjd skrivs understruken, ny höjd utan understrykning. Decimalerna ställs under Platsen.');
  } else if (p.kind === 'drain') {
    notes.push('Låglinje för dagvattnets avrinning: pilarna pekar i linjens riktning, från det högsta mot det lägsta. Ändrar inte marken. Ändra linjen med punkterna i Modifiera.');
  } else if (p.kind === 'breakline') {
    rows.push(rh('height', 'Höjd i början', h0));
    rows.push(rh('endHeight', 'Höjd i slutet', h1));
    rows.push(field('radius', 'Tonas inom', 'mm', p.radius, def.blend));
    notes.push('Låser marken längs linjen (höjden rakt mellan ändarna); marken runt omkring tonas mot den.');
  } else {
    // Stödmuren (0.10.5; referenslinjen, ändarna, höjdpunkterna och rakt krön 0.10.9; littera 0.10.20).
    rows.push(`<label class="field" title="Tomt = numrerad i ritordningen, med antalet siffror under Platsen"><span>Littera</span><input type="text" autocomplete="off" data-key="ground:name" value="${escapeHtml(p.name ?? '')}" placeholder="${escapeHtml(wallLittera(ctx, el))}"></label>`);
    rows.push(field('thickness', 'Tjocklek', 'mm', p.thickness, def.wallThickness));
    rows.push(refRows(p));
    const prof = wallProfile(ctx, el);
    const lvl = (h: number) => (site ? `+${toRh(site, h).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}` : `${Math.round(h)} mm`);
    rows.push(`<label class="field"><span>Krönet</span><select data-key="ground:straight"><option value="">Följer marken</option><option value="1"${p.straight ? ' selected' : ''}>Rakt</option></select></label>`);
    rows.push(`<label class="field" title="Sidan vars mark Över marken och krönet längs muren mäts mot"><span>Över marken mot</span><select data-key="ground:aboveSide"><option value="">Den högre sidan</option><option value="low"${p.aboveSide === 'low' ? ' selected' : ''}>Den lägre sidan</option></select></label>`);
    rows.push(field('above', 'Över marken i början', 'mm', p.above, 0, `Krönet över den ${p.aboveSide === 'low' ? 'lägre' : 'högre'} sidans mark; gäller när MK i början är tom`));
    rows.push(field('endAbove', 'Över marken i slutet', 'mm', p.endAbove, p.above ?? 0, 'Tomt = som i början; gäller när MK i slutet är tom'));
    rows.push(rh('height', 'MK i början', p.height, 'Murkrönet; tomt = över marken'));
    rows.push(rh('endHeight', 'MK i slutet', p.endHeight, 'Murkrönet; tomt = över marken'));
    (p.crest ?? []).forEach((c, i) => {
      const at = prof?.pins.find((q) => Math.hypot(q.at[0] - c.at[0], q.at[1] - c.at[1]) < 2000);
      const label = `Höjdpunkt ${i + 1}${at ? ` (${(Math.round(at.s / 100) / 10).toLocaleString('sv-SE')} m)` : ''}`;
      const v = site ? Math.round(toRh(site, c.h) * 1000) / 1000 : c.h;
      rows.push(`<label class="field" title="Tomt tar bort höjdpunkten"><span>${label}</span><span class="input-unit"><input type="text" inputmode="decimal" autocomplete="off" data-key="ground:crest${i}" value="${v.toLocaleString('sv-SE', { maximumFractionDigits: 3 })}"><i>${site ? 'm' : 'mm'}</i></span></label>`);
    });
    if (prof) notes.push(`Krönet ${lvl(prof.start)} i början och ${lvl(prof.end)} i slutet, högst ${lvl(prof.top)}; foten lägst ${lvl(prof.bottom)} (300 under den lägre sidan).`);
    notes.push('Höjdpunkter läggs till med <em>Höjdpunkt på krönet</em> i Modifiera: klicka på referenslinjen och skriv höjden. Dra romben för att flytta punkten längs muren; ett tomt fält tar bort den. Krönet går genom dem. Referenslinjen syns när muren är markerad.');
    notes.push('Slänterna från markobjekten går inte över muren: marken bakom den är orörd. Ledaren med littera och MK (murkrön) ritas på högra sidan om murens mitt; den släcks under Visa, Littera.');
  }
  return `<div class="field-label">${escapeHtml(groundLabel(p))}</div>
    <div class="fields">${rows.join('')}</div>
    ${notes.map((n) => `<p class="note">${n}</p>`).join('')}
    ${p.kind === 'path' ? groundFill(doc, p) : ''}`;
}
