import type { DocStore } from '../../core/store';
import type { Id, ProjectDoc } from '../../core/model';
import { addDefaultProfileTypes, addProfileGroup, addProfileType, moveProfileGroup, profileGroups, updateProfileType, profileTypesIn, profileTypeUses, removeProfileGroup, removeProfileType, renameProfileGroup, setProfileTypeGroup } from '../../core/profiles';
import { anchorPoint, ANCHOR_POS_LABELS, boxOfPoints, circleContour, defaultProfileTypes, END_KIND_LABELS, flatContour, newProfileModel, PROFILE_USE_LABELS, profileSection, profileValues, type AnchorPos, type EndKind, type PPoint, type ProfileTypeModel, type ProfileUse, type SubProfile } from '../../core/profileTypes';
import { parseDxf } from '../../formats/dxf';
import { askConfirm, askText } from '../ask';
import { escapeHtml, nextLittera } from '../labels';
import { icons } from '../icons';
import { isoMarkup, partColor, stretchedMarkup } from './profilePreview';
import { addAnchorAt, addPart, addZone, applyProfileTypeField, movePoint, profileTypeAction } from './profileTypeEdits';

/**
 * Profileditorn (0.11.6, tavla 3 i utredningen): stilboken › Typer ›
 * *Profiler*. Till vänster typlistan i grupper (som räckestypeditorn), sedan
 * typens struktur (delprofiler, ankare, sträckzoner, ändarna, får användas
 * som, används i), i mitten ritytan med rutnät (x bort från väggen, y uppåt)
 * och verktygen, och till höger den valda delprofilens egenskaper, dess
 * punkter och typens parametrar. Fälten heter `ptype:<typ>:…`.
 */

export type PeTool = 'select' | 'line' | 'rect' | 'circle' | 'anchor' | 'zoneH' | 'zoneW';
export type PeView = 'section' | 'stretched' | '3d';

export interface ProfileEditorState {
  def: Id | null;
  part: string | null;
  tool: PeTool;
  view: PeView;
  /** Punkterna som klickats med det pågående verktyget. */
  pending: PPoint[];
  query?: string;
  /** Punkten som dras med Välj: delprofil och punkt. */
  drag?: { part: string; i: number } | null;
}

export const newProfileEditorState = (): ProfileEditorState => ({ def: null, part: null, tool: 'select', view: 'section', pending: [] });

const TOOLS: [PeTool, string, string][] = [
  ['select', 'Välj', 'Klicka på en delprofil, dra i dess punkter'],
  ['line', 'Linje', 'En sluten kontur punkt för punkt; klicka på första punkten för att sluta den'],
  ['rect', 'Rektangel', 'Två motsatta hörn'],
  ['circle', 'Cirkel', 'Mitten och en punkt på cirkeln'],
  ['anchor', 'Ankare', 'Ett ankare i en egen punkt'],
  ['zoneH', 'Sträckzon höjd', 'Två klick: bandet där höjden sträcks'],
  ['zoneW', 'Sträckzon bredd', 'Två klick: bandet där bredden sträcks'],
];

const GRID = 5;

/** Sök i typlistan utan att rita om. */
export function profileEditorSearch(root: HTMLElement, st: ProfileEditorState, value: string): void {
  st.query = value;
  const q = value.trim().toLowerCase();
  for (const b of root.querySelectorAll<HTMLElement>('[data-pe-find]')) b.hidden = !!q && !(b.dataset.peFind ?? '').includes(q);
}

const opt = (v: string, label: string, cur: string | undefined) => `<option value="${escapeHtml(v)}"${(cur ?? '') === v ? ' selected' : ''}>${escapeHtml(label)}</option>`;
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('sv-SE');

function chosen(doc: ProjectDoc, st: ProfileEditorState): { def: Id | null; model: ProfileTypeModel | null; part: SubProfile | null } {
  let def = st.def && doc.definitions[st.def]?.profile ? st.def : null;
  if (!def) def = profileGroups(doc).flatMap((g) => profileTypesIn(doc, g))[0]?.id ?? null;
  if (def !== st.def) {
    st.pending = [];
    st.drag = null;
  }
  st.def = def;
  const model = def ? (doc.definitions[def].profile ?? null) : null;
  const part = model ? (model.parts.find((p) => p.id === st.part) ?? model.parts[0] ?? null) : null;
  st.part = part?.id ?? null;
  return { def, model, part };
}

/** Ritytans utsnitt (mm): typens rektangel med marginal, minst 200 mm. */
function viewBox(m: ProfileTypeModel): [number, number, number, number] {
  const pts = m.parts.flatMap((p) => flatContour(p.contour));
  for (const a of m.anchors) if (a.at) pts.push(a.at);
  const b = pts.length ? boxOfPoints(pts) : { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const size = Math.max(200, (b.maxX - b.minX) * 1.5, (b.maxY - b.minY) * 1.5);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return [cx - size / 2, -(cy + size / 2), size, size];
}

function canvasMarkup(m: ProfileTypeModel, part: SubProfile | null, st: ProfileEditorState): string {
  const vb = viewBox(m);
  const [x0, y0, w] = vb;
  const step = w > 1200 ? 100 : w > 500 ? 50 : 10;
  const lines: string[] = [];
  for (let x = Math.ceil(x0 / step) * step; x <= x0 + w; x += step) lines.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + w}" class="${x === 0 ? 'pe-axis' : (x / step) % 5 ? 'pe-grid' : 'pe-grid pe-grid5'}"/>`);
  for (let y = Math.ceil(y0 / step) * step; y <= y0 + w; y += step) lines.push(`<line x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}" class="${y === 0 ? 'pe-axis' : (y / step) % 5 ? 'pe-grid' : 'pe-grid pe-grid5'}"/>`);
  const s = profileSection(m, profileValues(m));
  const box = boxOfPoints(m.parts.flatMap((p) => flatContour(p.contour)));
  const zones = m.zones
    .map((z) =>
      z.axis === 'height'
        ? `<rect class="pe-zone" x="${x0}" y="${-z.to}" width="${w}" height="${z.to - z.from}"><title>Sträckzon höjd ${n1(z.from)}–${n1(z.to)}</title></rect>`
        : `<rect class="pe-zone" x="${z.from}" y="${y0}" width="${z.to - z.from}" height="${w}"><title>Sträckzon bredd ${n1(z.from)}–${n1(z.to)}</title></rect>`,
    )
    .join('');
  const polys = m.parts
    .map((p, i) => {
      const flat = flatContour(p.contour);
      return `<polygon data-pe-pick="${escapeHtml(p.id)}" class="pe-part${p.id === part?.id ? ' on' : ''}" points="${flat.map((q) => `${q[0]},${-q[1]}`).join(' ')}" fill="${partColor(i)}"><title>${escapeHtml(`${p.letter} ${p.name}`)}</title></polygon>`;
    })
    .join('');
  const letters = m.parts
    .map((p) => {
      const b = boxOfPoints(flatContour(p.contour));
      return `<text class="pe-letter" x="${(b.minX + b.maxX) / 2}" y="${-(b.minY + b.maxY) / 2}" font-size="${w / 22}">${escapeHtml(p.letter)}</text>`;
    })
    .join('');
  const r = w / 120;
  const verts = part && st.tool === 'select' ? part.contour.pts.map((q, i) => `<circle class="pe-vertex" data-pe-vertex="${i}" cx="${q[0]}" cy="${-q[1]}" r="${r}"/>`).join('') : '';
  const anchors = m.anchors
    .map((a) => {
      const p = anchorPoint(a, s.box, s.deltas);
      const d = r * 2.2;
      return `<g class="pe-anchor${a.no === m.anchor ? ' on' : ''}"><path d="M${p[0] - d} ${-p[1]}h${2 * d}M${p[0]} ${-p[1] - d}v${2 * d}"/><circle cx="${p[0]}" cy="${-p[1]}" r="${r * 1.2}"/><text x="${p[0] + d}" y="${-p[1] - d}" font-size="${w / 30}">${a.no}</text></g>`;
    })
    .join('');
  const dims = m.parts.length ? `<text class="pe-dim" x="${(box.minX + box.maxX) / 2}" y="${-box.minY + w / 18}" font-size="${w / 30}">${n1(box.maxX - box.minX)} × ${n1(box.maxY - box.minY)}</text>` : '';
  const pending = st.pending.length ? `<path class="pe-pending" d="M${st.pending.map((q) => `${q[0]} ${-q[1]}`).join('L')}"/>${st.pending.map((q) => `<circle class="pe-vertex" cx="${q[0]}" cy="${-q[1]}" r="${r}"/>`).join('')}` : '';
  return `<svg class="pe-canvas" data-pe-canvas data-tool="${st.tool}" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">
    <g class="pe-gridlines">${lines.join('')}</g>${zones}${polys}${letters}${dims}${anchors}${verts}${pending}<path class="pe-rubber" d=""/>
  </svg>`;
}

export function profileEditorMarkup(doc: ProjectDoc, st: ProfileEditorState): string {
  const { def, model, part } = chosen(doc, st);
  const groups = profileGroups(doc);
  const q = (st.query ?? '').trim().toLowerCase();
  const list = groups
    .map((g, gi) => {
      const types = profileTypesIn(doc, g);
      const rows = types
        .map((d) => {
          const n = profileTypeUses(doc, d.id);
          const find = `${d.name} ${d.description ?? ''}`.toLowerCase();
          return `<button class="rt-type${d.id === def ? ' on' : ''}" draggable="true" data-pe-type="${escapeHtml(d.id)}" data-pe-find="${escapeHtml(find)}"${!q || find.includes(q) ? '' : ' hidden'} title="${n ? `${n} ${n === 1 ? 'objekt' : 'objekt'} i projektet. ` : ''}Dra till en annan grupp för att flytta typen"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.description ?? '')}</span><i>${d.profile?.ground ? 'M' : ''}${d.profile?.building ? ' B' : ''}</i></button>`;
        })
        .join('');
      const g_ = escapeHtml(g);
      const later = g === 'Ändprofiler';
      return `<div class="rt-group" data-pe-group="${g_}">
        <div class="rt-group-head"><span>${g_}${later ? ' <i class="pe-later">0.11.7</i>' : ''}</span>
          <button class="icon-btn" data-pe-act="group-rename" data-pe-g="${g_}" title="Byt namn på gruppen" aria-label="Byt namn">✎</button>
          <button class="icon-btn" data-pe-act="group-up" data-pe-g="${g_}"${gi ? '' : ' disabled'} title="Flytta upp" aria-label="Flytta upp">↑</button>
          <button class="icon-btn" data-pe-act="group-down" data-pe-g="${g_}"${gi < groups.length - 1 ? '' : ' disabled'} title="Flytta ned" aria-label="Flytta ned">↓</button>
          <button class="icon-btn" data-pe-act="group-remove" data-pe-g="${g_}"${types.length ? ' disabled title="Flytta eller ta bort typerna i gruppen först"' : ' title="Ta bort gruppen"'} aria-label="Ta bort">${icons.trash}</button>
        </div>
        ${rows || '<p class="rt-empty">Dra hit en typ</p>'}
      </div>`;
    })
    .join('');
  const used = def ? profileTypeUses(doc, def) : 0;
  const missing = defaultProfileTypes().filter((d) => !doc.definitions[d.id]).length;
  const listCol = `<div class="rt-list">
    <label class="field rt-search"><span>Sök</span><input type="search" data-pe-search placeholder="typ eller littera" value="${escapeHtml(st.query ?? '')}" autocomplete="off"></label>
    ${list}
    <div class="rt-list-actions">
      <button class="btn btn-small" data-pe-act="type-new">Ny typ…</button>
      <button class="btn btn-small" data-pe-act="type-dup"${def ? '' : ' disabled'}>Duplicera</button>
      <button class="btn btn-small" data-pe-act="type-remove"${def && !used ? '' : ` disabled title="${def ? `Används av ${used} objekt` : ''}"`}>Ta bort</button>
      <button class="btn btn-small" data-pe-act="group-new">Ny grupp…</button>
      ${missing ? '<button class="btn btn-small" data-pe-act="types-default" title="PR01–PR05: de som saknas i projektet">Lägg in förvalda typer</button>' : ''}
    </div>
    <p class="note">M = Mark (Platsen) · B = Byggnad.</p>
  </div>`;
  if (!def || !model) return wrap(`${listCol}<div class="rt-typecol"><p class="note">Inga profiltyper än. <b>Ny typ…</b> lägger till en, och de förvalda (PR01–PR05) kommer med den första profilen.</p><div class="row"><button class="btn" data-pe-act="types-default">Lägg in förvalda typer</button></div></div>`);
  const d = doc.definitions[def];
  const k = (rest: string) => `ptype:${def}:${rest}`;
  const groupsSel = groups.map((g) => opt(g, g, model.group)).join('');
  const uses = (Object.keys(PROFILE_USE_LABELS) as ProfileUse[])
    .map((u) => `<label class="check"><input type="checkbox" data-key="${k(`use:${u}`)}"${(model.uses ?? ['free']).includes(u) ? ' checked' : ''}> ${PROFILE_USE_LABELS[u]}${u === 'free' ? '' : ' <i class="pe-later">0.11.7–0.11.8</i>'}</label>`)
    .join('');
  const partRows = model.parts
    .map((p, i) => `<li class="rt-part${p.id === part?.id ? ' on' : ''}" data-pe-part-row="${escapeHtml(p.id)}">
      <span class="pe-swatch" style="background:${partColor(i)}"></span><b>${escapeHtml(p.letter)}</b><span>${escapeHtml(p.name)}</span>
      <span class="rt-part-acts">
        <button class="icon-btn" data-pe-act="part-up" data-pe-part="${escapeHtml(p.id)}"${i ? '' : ' disabled'} title="Flytta upp: en senare delprofil ligger ovanpå en tidigare" aria-label="Flytta upp">↑</button>
        <button class="icon-btn" data-pe-act="part-down" data-pe-part="${escapeHtml(p.id)}"${i < model.parts.length - 1 ? '' : ' disabled'} title="Flytta ned" aria-label="Flytta ned">↓</button>
        <button class="icon-btn" data-pe-act="part-remove" data-pe-part="${escapeHtml(p.id)}"${model.parts.length > 1 ? '' : ' disabled'} title="Ta bort delprofilen" aria-label="Ta bort">×</button>
      </span></li>`)
    .join('');
  const anchorRows = model.anchors
    .map((a) => `<li class="pe-anchor-row">
      <label class="check" title="Förvalt ankare"><input type="radio" name="pe-default-anchor" data-pe-act="anchor-default" data-pe-index="${a.no}"${a.no === model.anchor ? ' checked' : ''}> ${a.no}</label>
      <input type="text" aria-label="Ankarets namn" data-key="${k(`anchor:${a.no}:name`)}" value="${escapeHtml(a.name)}">
      <select aria-label="Läge" data-key="${k(`anchor:${a.no}:pos`)}">${(Object.keys(ANCHOR_POS_LABELS) as AnchorPos[]).map((p) => opt(p, ANCHOR_POS_LABELS[p], a.pos)).join('')}${a.at ? opt('', `Egen punkt ${n1(a.at[0])}, ${n1(a.at[1])}`, '') : ''}</select>
      <button class="icon-btn" data-pe-act="anchor-remove" data-pe-index="${a.no}"${model.anchors.length > 1 ? '' : ' disabled'} title="Ta bort ankaret" aria-label="Ta bort">×</button></li>`)
    .join('');
  const zoneRows = model.zones
    .map((z, i) => `<li class="pe-zone-row"><span>${z.axis === 'height' ? 'Höjd' : 'Bredd'}</span>
      <input type="text" aria-label="Från" data-key="${k(`zone:${i}:from`)}" value="${n1(z.from)}"> – <input type="text" aria-label="Till" data-key="${k(`zone:${i}:to`)}" value="${n1(z.to)}">
      <button class="icon-btn" data-pe-act="zone-remove" data-pe-index="${i}" title="Ta bort sträckzonen (måttet blir låst)" aria-label="Ta bort">×</button></li>`)
    .join('');
  const typeCol = `<div class="rt-typecol">
    <div class="rt-title"><input type="text" class="rt-littera" aria-label="Littera" data-key="${k('name')}" value="${escapeHtml(d.name)}"><input type="text" class="rt-desc" aria-label="Beskrivning" data-key="${k('description')}" value="${escapeHtml(d.description ?? '')}" placeholder="Beskrivning"></div>
    <div class="rt-row"><span>Grupp</span><select class="rt-val" data-key="${k('group')}">${groupsSel}</select></div>
    <div class="rt-row"><span>Visas</span><span><label class="check" title="På Platsen"><input type="checkbox" data-key="${k('ground')}"${model.ground ? ' checked' : ''}> M</label> <label class="check" title="På våningarna"><input type="checkbox" data-key="${k('building')}"${model.building ? ' checked' : ''}> B</label></span></div>
    <div class="rt-sec">Delprofiler</div><ul class="rt-tree">${partRows}</ul>
    <div class="rt-sec">Ankare</div><ul class="pe-list">${anchorRows}</ul>
    <button class="link-btn" data-pe-act="anchor-new">+ Nytt ankare</button>
    <div class="rt-sec">Sträckzoner</div>${zoneRows ? `<ul class="pe-list">${zoneRows}</ul>` : '<p class="note">Inga: måtten är låsta. Rita en med verktygen Sträckzon.</p>'}
    <div class="rt-sec">Ändar</div>
    <div class="rt-row"><span>Avslut som förval</span><select class="rt-val" data-key="${k('ends')}">${opt('', model.group === 'Pelare och balkar' ? 'Efter gruppen (lodrät)' : 'Efter gruppen (vinkelrät)', model.ends)}${(Object.keys(END_KIND_LABELS) as EndKind[]).filter((e) => e !== 'angle').map((e) => opt(e, END_KIND_LABELS[e], model.ends)).join('')}</select></div>
    <div class="rt-row"><span>Uppåt</span><select class="rt-val" data-key="${k('up')}">${opt('plumb', 'Lodrätt', model.up ?? 'plumb')}${opt('normal', 'Vinkelrätt mot banan', model.up ?? 'plumb')}</select></div>
    <div class="rt-sec">Får användas som</div><div class="pe-uses">${uses}</div>
    <div class="rt-sec">Används i</div><p class="note">${used ? `${used} ${used === 1 ? 'profilobjekt' : 'profilobjekt'}. <button class="link-btn" data-pe-act="goto">Gå dit</button>` : 'Inga objekt.'}</p>
  </div>`;
  const tools = TOOLS.map(([t, label, title]) => `<button data-pe-tool="${t}" aria-pressed="${st.tool === t}" title="${escapeHtml(title)}">${label}</button>`).join('');
  const views: [PeView, string][] = [['section', 'Tvärsnittet'], ['stretched', 'Sträckt'], ['3d', '3D']];
  const center = `<div class="rt-center pe-center">
    <div class="segmented rt-tabs" role="group" aria-label="Visa">${views.map(([v, l]) => `<button data-pe-view="${v}" aria-pressed="${st.view === v}">${l}</button>`).join('')}<button disabled title="Ändprofilerna kommer i 0.11.7">Ändprofilen</button></div>
    ${st.view === 'section' ? `<div class="segmented pe-tools" role="group" aria-label="Verktyg">${tools}</div>
    <div class="pe-tool-acts">${st.tool === 'line' && st.pending.length >= 3 ? '<button class="btn btn-small btn-primary" data-pe-act="line-close">Sluta konturen</button>' : ''}${st.pending.length ? '<button class="btn btn-small" data-pe-act="pending-cancel">Avbryt</button>' : ''}<button class="btn btn-small" data-pe-act="part-mirror"${part ? '' : ' disabled'} title="Spegla den valda delprofilen i sidled">Spegla</button><button class="btn btn-small" data-pe-act="dxf" title="Läs slutna konturer ur en DXF-fil som nya delprofiler (mm)">Ur DXF…</button></div>
    ${canvasMarkup(model, part, st)}
    <p class="note rt-canvas-hint">${hintFor(st)}</p>` : st.view === 'stretched' ? stretchedMarkup(model, 1.5) : isoMarkup(model)}
  </div>`;
  return wrap(`${listCol}${typeCol}${center}<div class="rt-side">${part ? partProps(doc, def, part) : ''}${paramsMarkup(def, model)}</div>`);
}

const wrap = (inner: string) => `<section class="style-labels pe-editor"><h3>Profiler</h3><p class="note">Ändras en typ här ändras alla profilobjekt med den. Tvärsnittets x går bort från väggen (till höger om banan), y uppåt, mm. En senare delprofil som ligger ovanpå en tidigare tar sin yta ur den.</p><div class="rt-grid">${inner}</div></section>`;

function hintFor(st: ProfileEditorState): string {
  switch (st.tool) {
    case 'select':
      return 'Klicka på en delprofil för att välja den; dra i dess punkter. Punkterna snäpper till varandra och till 5 mm.';
    case 'line':
      return st.pending.length ? 'Klicka nästa punkt; klicka på den första för att sluta konturen.' : 'Klicka konturens första punkt.';
    case 'rect':
      return st.pending.length ? 'Klicka det motsatta hörnet.' : 'Klicka rektangelns första hörn.';
    case 'circle':
      return st.pending.length ? 'Klicka en punkt på cirkeln.' : 'Klicka cirkelns mitt.';
    case 'anchor':
      return 'Klicka där ankaret ska ligga.';
    case 'zoneH':
      return st.pending.length ? 'Klicka var bandet slutar (höjden).' : 'Klicka var bandet börjar (höjden).';
    case 'zoneW':
      return st.pending.length ? 'Klicka var bandet slutar (bredden).' : 'Klicka var bandet börjar (bredden).';
  }
}

function partProps(doc: ProjectDoc, def: Id, p: SubProfile): string {
  const k = (rest: string) => `ptype:${def}:part:${p.id}:${rest}`;
  const mats = (doc.graphics.materials ?? []).filter((x) => x.building || x.id === p.material);
  const pts = p.contour.pts
    .map((q, i) => `<tr><td>${i + 1}</td>
      <td><input type="text" aria-label="x" data-key="${k(`pt:${i}:x`)}" value="${n1(q[0])}"></td>
      <td><input type="text" aria-label="y" data-key="${k(`pt:${i}:y`)}" value="${n1(q[1])}"></td>
      <td><input type="text" aria-label="Pilhöjd" title="Pilhöjden för kanten till nästa punkt (0 = rak)" data-key="${k(`pt:${i}:b`)}" value="${n1(Number(p.contour.bulges?.[i]) || 0)}"></td>
      <td><button class="icon-btn" data-pe-act="pt-insert" data-pe-part="${escapeHtml(p.id)}" data-pe-index="${i}" title="Ny punkt mitt på kanten" aria-label="Ny punkt">+</button><button class="icon-btn" data-pe-act="pt-remove" data-pe-part="${escapeHtml(p.id)}" data-pe-index="${i}"${p.contour.pts.length > 3 ? '' : ' disabled'} title="Ta bort punkten" aria-label="Ta bort">×</button></td></tr>`)
    .join('');
  return `<div class="rt-partprops">
    <div class="rt-part-name"><input type="text" class="pe-letter-in" aria-label="Bokstav" data-key="${k('letter')}" value="${escapeHtml(p.letter)}"><input type="text" aria-label="Namn" data-key="${k('name')}" value="${escapeHtml(p.name)}"></div>
    <div class="fields">
      <label class="field"><span>Material</span><select data-key="${k('material')}">${opt('', 'Inget', p.material)}${mats.map((x) => opt(x.id, x.name, p.material)).join('')}</select></label>
      <label class="check"><input type="checkbox" data-key="${k('perObject')}"${p.perObject !== false ? ' checked' : ''}> Får bytas per objekt</label>
      <label class="field"><span>Läge</span><select data-key="${k('place')}">${opt('edge', 'Kant i kant', p.place ?? 'edge')}${opt('over', 'Ovanpå', p.place ?? 'edge')}${opt('free', 'Fritt', p.place ?? 'edge')}</select></label>
      <label class="check" title="Avslutet i ändarna gäller delprofilen; annars kapas den vinkelrätt"><input type="checkbox" data-key="${k('followsEnd')}"${p.followsEnd !== false ? ' checked' : ''}> Följer avslutet</label>
      <label class="field" title="Hur långt delprofilen går utöver referenslinjens ände, t.ex. en avtäckning"><span>Förlängning</span><span class="input-unit"><input type="text" data-key="${k('extend')}" value="${p.extend ?? 0}"><i>mm</i></span></label>
      <label class="field"><span>Syns i planen från</span><select data-key="${k('detail')}">${opt('', 'Alla nivåer', p.detail)}${opt('normal', 'Normal', p.detail)}${opt('detail', 'Detalj', p.detail)}</select></label>
    </div>
    <div class="rt-sec">Punkter</div>
    <table class="rt-ptable pe-pts"><thead><tr><th>#</th><th>x</th><th>y</th><th>Båge</th><th></th></tr></thead><tbody>${pts}</tbody></table>
  </div>`;
}

function paramsMarkup(def: Id, m: ProfileTypeModel): string {
  const k = (rest: string) => `ptype:${def}:${rest}`;
  const vals = profileValues(m);
  const rows = m.params
    .map((q, i) => {
      const formula = typeof q.value === 'string';
      return `<tr>
        <td><input type="text" aria-label="Namn" data-key="${k(`param:${i}:name`)}" value="${escapeHtml(q.name)}"></td>
        <td>${formula ? `<span class="rt-calc">${n1(vals.get(q.name) ?? 0)}</span>` : `<input type="text" aria-label="Värde" data-key="${k(`param:${i}:value`)}" value="${escapeHtml(String(q.value))}">`}</td>
        <td><input type="text" aria-label="Formel" placeholder="–" data-key="${k(`param:${i}:formula`)}" value="${formula ? escapeHtml(String(q.value)) : ''}"></td>
        <td class="rt-per"><input type="checkbox" aria-label="Per objekt" title="Får ändras på det enskilda objektet" data-key="${k(`param:${i}:per`)}"${q.perRailing ? ' checked' : ''}></td>
        <td><button class="icon-btn" data-pe-act="param-remove" data-pe-index="${i}" title="Ta bort parametern" aria-label="Ta bort">×</button></td>
      </tr>`;
    })
    .join('');
  return `<div class="rt-params">
    <div class="rt-params-head"><b>Typens parametrar</b><button class="link-btn" data-pe-act="param-add">+ Ny parameter</button></div>
    <table class="rt-ptable"><thead><tr><th>Parameter</th><th>Värde</th><th>Formel</th><th class="rt-per">Per objekt</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">Höjd och Bredd styr sträckzonerna: tvärsnittet sträcks i zonen tills måttet stämmer.</p>
  </div>`;
}

// ---------- Ritytan ----------

/** Punkten i tvärsnittet under pekaren, och hur många mm en skärmpixel är. */
function canvasPoint(svg: SVGSVGElement, e: PointerEvent): { at: PPoint; px: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { at: [p.x, -p.y], px: 1 / Math.max(1e-9, ctm.a) };
}

/** Snäpp till en punkt i typen (inom 8 px), annars till rutnätet. */
function snapped(m: ProfileTypeModel, at: PPoint, px: number, extra: readonly PPoint[] = [], skip?: { part: string; i: number }): PPoint {
  let best: PPoint | null = null;
  let bd = 8 * px;
  for (const p of m.parts)
    p.contour.pts.forEach((q, i) => {
      if (skip && skip.part === p.id && skip.i === i) return;
      const d = Math.hypot(q[0] - at[0], q[1] - at[1]);
      if (d < bd) {
        bd = d;
        best = q;
      }
    });
  for (const q of extra) {
    const d = Math.hypot(q[0] - at[0], q[1] - at[1]);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  return best ?? [Math.round(at[0] / GRID) * GRID, Math.round(at[1] / GRID) * GRID];
}

/** Pekaren i ritytan: rita, välj och dra. Sant om det hörde hit. */
export function profileCanvasPointer(store: DocStore, st: ProfileEditorState, e: PointerEvent, render: () => void): boolean {
  const svg = (e.target as Element).closest?.('svg[data-pe-canvas]') as SVGSVGElement | null;
  if (!svg && !(st.drag && e.type !== 'pointerdown')) return false;
  const def = st.def;
  const m = def ? store.doc.definitions[def]?.profile : undefined;
  if (!def || !m) return false;
  const root = svg ?? (document.querySelector('svg[data-pe-canvas]') as SVGSVGElement | null);
  if (!root) return false;
  const c = canvasPoint(root, e);
  if (!c) return false;
  if (e.type === 'pointermove') {
    if (st.drag) {
      const at = snapped(m, c.at, c.px, [], st.drag);
      const v = root.querySelector<SVGCircleElement>(`[data-pe-vertex="${st.drag.i}"]`);
      v?.setAttribute('cx', String(at[0]));
      v?.setAttribute('cy', String(-at[1]));
      const poly = root.querySelector<SVGPolygonElement>(`[data-pe-pick="${CSS.escape(st.drag.part)}"]`);
      const part = m.parts.find((p) => p.id === st.drag!.part);
      if (poly && part) {
        const pts = part.contour.pts.map((q, i) => (i === st.drag!.i ? at : q));
        poly.setAttribute('points', flatContour({ ...part.contour, pts }).map((q) => `${q[0]},${-q[1]}`).join(' '));
      }
      return true;
    }
    rubber(root, st, snapped(m, c.at, c.px, st.pending));
    return true;
  }
  if (e.type === 'pointerup') {
    if (!st.drag) return false;
    const drag = st.drag;
    st.drag = null;
    const at = snapped(m, c.at, c.px, [], drag);
    const part = m.parts.find((p) => p.id === drag.part);
    const was = part?.contour.pts[drag.i];
    if (was && (was[0] !== at[0] || was[1] !== at[1])) movePoint(store, def, drag.part, drag.i, at);
    else render();
    return true;
  }
  if (e.type !== 'pointerdown' || e.button !== 0) return false;
  e.preventDefault();
  if (st.tool === 'select') {
    const v = (e.target as Element).closest('[data-pe-vertex]')?.getAttribute('data-pe-vertex');
    if (v !== null && v !== undefined && st.part) {
      st.drag = { part: st.part, i: Number(v) };
      return true;
    }
    const pick = (e.target as Element).closest('[data-pe-pick]')?.getAttribute('data-pe-pick');
    if (pick) {
      st.part = pick;
      render();
    }
    return true;
  }
  const at = snapped(m, c.at, c.px, st.pending);
  const close = (a: PPoint, b: PPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 8 * c.px;
  switch (st.tool) {
    case 'line':
      if (st.pending.length >= 3 && close(at, st.pending[0])) {
        const id = addPart(store, def, { pts: st.pending });
        st.pending = [];
        if (id) st.part = id;
      } else st.pending.push(at);
      break;
    case 'rect':
      if (!st.pending.length) st.pending.push(at);
      else {
        const [a] = st.pending;
        st.pending = [];
        const id = addPart(store, def, { pts: [a, [at[0], a[1]], at, [a[0], at[1]]] });
        if (id) st.part = id;
      }
      break;
    case 'circle':
      if (!st.pending.length) st.pending.push(at);
      else {
        const [a] = st.pending;
        st.pending = [];
        const r = Math.hypot(at[0] - a[0], at[1] - a[1]);
        const id = r >= 1 ? addPart(store, def, circleContour(a[0], a[1], 2 * r)) : null;
        if (id) st.part = id;
      }
      break;
    case 'anchor':
      addAnchorAt(store, def, at);
      break;
    case 'zoneH':
    case 'zoneW':
      if (!st.pending.length) st.pending.push(at);
      else {
        const [a] = st.pending;
        st.pending = [];
        const h = st.tool === 'zoneH';
        addZone(store, def, h ? 'height' : 'width', h ? a[1] : a[0], h ? at[1] : at[0]);
      }
      break;
  }
  render();
  return true;
}

/** Gummibandet från det klickade till pekaren. */
function rubber(svg: SVGSVGElement, st: ProfileEditorState, at: PPoint): void {
  const el = svg.querySelector<SVGPathElement>('.pe-rubber');
  if (!el) return;
  const p = st.pending;
  let d = '';
  const P = (q: PPoint) => `${q[0]} ${-q[1]}`;
  if (st.tool === 'line' && p.length) d = `M${P(p[p.length - 1])}L${P(at)}`;
  else if (st.tool === 'rect' && p.length) d = `M${P(p[0])}L${P([at[0], p[0][1]])}L${P(at)}L${P([p[0][0], at[1]])}Z`;
  else if (st.tool === 'circle' && p.length) {
    const r = Math.hypot(at[0] - p[0][0], at[1] - p[0][1]);
    d = `M${p[0][0] - r} ${-p[0][1]}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  } else if ((st.tool === 'zoneH' || st.tool === 'zoneW') && p.length) {
    const vb = svg.viewBox.baseVal;
    d = st.tool === 'zoneH' ? `M${vb.x} ${-p[0][1]}H${vb.x + vb.width}M${vb.x} ${-at[1]}H${vb.x + vb.width}` : `M${p[0][0]} ${vb.y}V${vb.y + vb.height}M${at[0]} ${vb.y}V${vb.y + vb.height}`;
  }
  el.setAttribute('d', d);
}

// ---------- Klick och fält ----------

/** Klick i editorn; sant om det hörde hit. */
export async function profileEditorClick(store: DocStore, st: ProfileEditorState, target: HTMLElement, render: () => void, onError: (msg: string) => void, goTo: (ids: string[]) => void): Promise<boolean> {
  if (!target.closest('.pe-editor')) return false;
  if (target.closest('svg[data-pe-canvas]')) return true;
  const tool = target.closest<HTMLElement>('[data-pe-tool]')?.dataset.peTool;
  if (tool) {
    st.tool = tool as PeTool;
    st.pending = [];
    render();
    return true;
  }
  const view = target.closest<HTMLElement>('[data-pe-view]')?.dataset.peView;
  if (view) {
    st.view = view as PeView;
    st.pending = [];
    render();
    return true;
  }
  const act = target.closest<HTMLElement>('[data-pe-act]');
  if (act) {
    await doAction(store, st, act, onError, goTo);
    render();
    return true;
  }
  const type = target.closest<HTMLElement>('[data-pe-type]')?.dataset.peType;
  if (type) {
    if (st.def !== type) {
      st.part = null;
      st.pending = [];
    }
    st.def = type;
    render();
    return true;
  }
  const row = target.closest<HTMLElement>('[data-pe-part-row]')?.dataset.pePartRow;
  if (row && !target.closest('input, select, button')) {
    st.part = row;
    render();
    return true;
  }
  return false;
}

async function doAction(store: DocStore, st: ProfileEditorState, el: HTMLElement, onError: (msg: string) => void, goTo: (ids: string[]) => void): Promise<void> {
  const doc = store.doc;
  const g = el.dataset.peG ?? '';
  const def = st.def ? doc.definitions[st.def] : undefined;
  const a = el.dataset.peAct!;
  switch (a) {
    case 'group-new': {
      const name = (await askText('Ny grupp', ''))?.trim();
      if (name && !addProfileGroup(store, name)) onError(`Gruppen ${name} finns redan.`);
      return;
    }
    case 'group-rename': {
      const name = (await askText('Byt namn på gruppen', g))?.trim();
      if (name && name !== g && !renameProfileGroup(store, g, name)) onError(`Gruppen ${name} finns redan.`);
      return;
    }
    case 'group-up':
    case 'group-down':
      moveProfileGroup(store, g, a === 'group-up' ? -1 : 1);
      return;
    case 'group-remove':
      removeProfileGroup(store, g);
      return;
    case 'type-new': {
      const group = def?.profile?.group ?? profileGroups(doc)[0] ?? 'Pelare och balkar';
      const name = (await askText(`Ny typ i ${group}`, nextLittera(doc, 'Profile', group === 'Ändprofiler' ? 'PA' : 'PR'), 'Lägg till'))?.trim();
      if (!name) return;
      st.def = addProfileType(store, name, newProfileModel(group));
      st.part = null;
      return;
    }
    case 'type-dup': {
      if (!def?.profile) return;
      st.def = addProfileType(store, nextLittera(doc, 'Profile', 'PR'), structuredClone(def.profile), def.description ? `${def.description} (kopia)` : undefined);
      return;
    }
    case 'type-remove': {
      if (!def || profileTypeUses(doc, def.id)) return;
      if (!(await askConfirm(`Ta bort ${def.name}?`, 'Typen används inte av något objekt.'))) return;
      removeProfileType(store, def.id);
      st.def = null;
      st.part = null;
      return;
    }
    case 'types-default':
      store.transact('Lägg in förvalda profiltyper', (tx) => void addDefaultProfileTypes(tx));
      if (!st.def) st.def = 't-pr01';
      return;
    case 'goto':
      if (def) goTo(Object.values(doc.elements).filter((e) => e.definition === def.id).map((e) => e.id));
      return;
    case 'line-close':
      if (st.def && st.pending.length >= 3) {
        const id = addPart(store, st.def, { pts: st.pending });
        if (id) st.part = id;
      }
      st.pending = [];
      return;
    case 'pending-cancel':
      st.pending = [];
      return;
    case 'part-mirror': {
      if (!st.def || !def?.profile) return;
      const p = def.profile.parts.find((x) => x.id === st.part);
      if (!p) return;
      const box = boxOfPoints(def.profile.parts.flatMap((x) => flatContour(x.contour)));
      const mid = box.minX + box.maxX;
      const pts = p.contour.pts.map((q): PPoint => [mid - q[0], q[1]]);
      const bulges = p.contour.bulges?.map((b) => -b);
      updateProfileType(store, st.def, 'Spegla delprofil', (m) => {
        const q = m.parts.find((x) => x.id === p.id)!;
        q.contour = { pts, ...(bulges ? { bulges } : {}) };
        return m;
      });
      return;
    }
    case 'dxf':
      if (st.def) await readDxf(store, st, onError);
      return;
    default:
      if (st.def) {
        profileTypeAction(store, st.def, a, el);
        if (a === 'part-remove' && st.part === el.dataset.pePart) st.part = null;
      }
  }
}

/** Slutna konturer ur en DXF-fil (mm, eller filens enhet) som nya delprofiler. */
async function readDxf(store: DocStore, st: ProfileEditorState, onError: (msg: string) => void): Promise<void> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.dxf';
  const file = await new Promise<File | null>((ok) => {
    input.onchange = () => ok(input.files?.[0] ?? null);
    input.click();
  });
  if (!file || !st.def) return;
  try {
    const dxf = parseDxf(await file.text());
    const k = dxf.mmPerUnit;
    const closed = dxf.items.filter((it): it is Extract<typeof it, { kind: 'poly' }> => it.kind === 'poly' && it.closed && it.pts.length >= 3);
    if (!closed.length) {
      onError('Filen har inga slutna konturer.');
      return;
    }
    let last: string | null = null;
    for (const it of closed) last = addPart(store, st.def, { pts: it.pts.map((q): PPoint => [q[0] * k, q[1] * k]) }) ?? last;
    if (last) st.part = last;
  } catch {
    onError('Filen gick inte att läsa som DXF.');
  }
}

/** Ett ändrat fält i editorn (`ptype:…`); sant om det hörde hit. */
export function profileEditorChange(store: DocStore, input: HTMLInputElement | HTMLSelectElement): boolean {
  const key = input.dataset.key;
  if (!key?.startsWith('ptype:') || !input.closest('.pe-editor')) return false;
  const [, def, ...rest] = key.split(':');
  applyProfileTypeField(store, def, rest, input);
  return true;
}

/** Dra en typ till en annan grupp. */
export function profileEditorDrag(store: DocStore, e: DragEvent): void {
  const t = e.target as HTMLElement;
  if (e.type === 'dragstart') {
    const id = t.closest?.<HTMLElement>('[data-pe-type]')?.dataset.peType;
    if (id && e.dataTransfer) {
      e.dataTransfer.setData('application/x-pe-type', id);
      e.dataTransfer.effectAllowed = 'move';
    }
    return;
  }
  const group = t.closest?.<HTMLElement>('[data-pe-group]');
  if (!group || !e.dataTransfer?.types.includes('application/x-pe-type')) return;
  if (e.type === 'dragover') {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    group.classList.add('rt-drop');
  } else if (e.type === 'dragleave') {
    if (!group.contains(e.relatedTarget as Node)) group.classList.remove('rt-drop');
  } else if (e.type === 'drop') {
    e.preventDefault();
    group.classList.remove('rt-drop');
    setProfileTypeGroup(store, e.dataTransfer.getData('application/x-pe-type'), group.dataset.peGroup ?? '');
  }
}
