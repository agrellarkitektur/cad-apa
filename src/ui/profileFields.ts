import { newId } from '../core/ids';
import type { Element, Id, ProjectDoc } from '../core/model';
import { ANCHOR_POS_LABELS, END_KIND_LABELS, PROFILE_USE_LABELS, ZONE_PARAM, type EndKind, type ProfileTypeModel } from '../core/profileTypes';
import { profileValues } from '../core/profileTypes';
import type { DocStore } from '../core/store';
import { columnHeight, endOf, partMaterial, profileBodyOf, profileTypeOf, type ProfileParams } from '../elements/profile';
import type { EndSpec } from '../elements/profileBody';
import { resolveParams } from '../elements/registry';
import { numberField } from './fieldMarkup';
import { escapeHtml } from './labels';

/**
 * Profilobjektets fält i egenskaperna (0.11.6, tavla 2): littera, banan
 * (pelarens fot och höjd, eller punkternas höjd), ankaret med
 * förskjutning och vridning, uppåt, Spegla, objektets mått (Höjd, Bredd
 * när typen har sträckzonen), materialet per delprofil och avsluten i
 * början och slutet (sort, inom/utöver, förskjutning). Under *Påverkar fler
 * objekt* står typen i korthet, med *Öppna i profileditorn…*.
 */

const segmented = (action: string, value: string, options: [string, string][], extra = '') =>
  `<div class="segmented" role="group">${options.map(([v, l]) => `<button data-action="${action}" data-value="${v}"${extra} aria-pressed="${v === value}">${escapeHtml(l)}</button>`).join('')}</div>`;

export function profileFieldsMarkup(doc: ProjectDoc, el: Element): string {
  const p = resolveParams<ProfileParams>(doc, el);
  const model = profileTypeOf(doc, el);
  const vals = profileValues(model, p.values);
  const plumb = p.path === 'plumb';
  const body = profileBodyOf(doc, el);
  const out: string[] = [];
  if (!body?.sweep.pieces.length) out.push('<div class="stair-warnings" role="note"><p class="skew-note"><b>!</b> Banan är för kort, eller tvärsnittet saknar yta.</p></div>');
  out.push(`<div class="fields"><label class="field"><span>Littera</span><input type="text" autocomplete="off" data-key="name:littera" value="${escapeHtml(el.name ?? '')}"></label></div>`);
  if (plumb) {
    out.push(`<div class="field-label">Pelaren</div><div class="fields">${numberField('prof:level', 'Fot över golvet', p.level ?? 0, 'mm')}${numberField('prof:height', 'Höjd', columnHeight(p), 'mm')}</div>`);
    if (p.height !== undefined) out.push('<div class="row"><button class="btn btn-small" data-action="prof-height-reset" title="Höjden följer våningen: till våningen ovanför">Till våningen ovanför</button></div>');
  } else {
    const z = p.z ?? [];
    out.push(`<div class="field-label">Punkternas höjd mot golvet</div><div class="fields">${(p.line ?? []).map((_, i) => numberField(`prof:z:${i}`, `Punkt ${i + 1}`, Number(z[i]) || 0, 'mm')).join('')}</div>`);
    if ((p.line?.length ?? 0) > 1) out.push(`<div class="row"><button class="btn btn-small" data-action="prof-z-all" title="Alla punkter får den första punktens höjd">Alla som punkt 1</button></div>`);
  }
  // Ankaret (beslut F), förskjutningen och vridningen kring det (beslut E).
  const anchor = p.anchor ?? model.anchor;
  const anchors = model.anchors.map((a) => `<option value="${a.no}"${a.no === anchor ? ' selected' : ''}>${a.no} ${escapeHtml(a.name)}${a.pos ? ` (${ANCHOR_POS_LABELS[a.pos].toLowerCase()})` : ''}</option>`).join('');
  out.push(`<div class="field-label">Tvärsnittet</div><div class="fields">
    <label class="field"><span>Ankare</span><select data-key="prof:anchor">${anchors}</select></label>
    ${numberField('prof:offset:0', 'Förskjutning i sidled', p.offset?.[0] ?? 0, 'mm')}
    ${numberField('prof:offset:1', 'Förskjutning i höjd', p.offset?.[1] ?? 0, 'mm')}
    ${numberField('prof:rotate', 'Vridning kring ankaret', p.rotate ?? 0, '°', 1)}
  </div>
  <label class="check"><input type="checkbox" data-key="prof:mirror"${p.mirror ? ' checked' : ''}> Speglad (${plumb ? 'tvärsnittet vänt' : 'på andra sidan om banan'})</label>`);
  if (!plumb) out.push(`<div class="field-label">Uppåt i tvärsnittet</div>${segmented('prof-up', p.up ?? model.up ?? 'plumb', [['plumb', 'Lodrätt'], ['normal', 'Vinkelrätt mot banan']])}`);
  // Objektets mått: de parametrar typen låter ändras per objekt.
  const own = model.params.filter((q) => q.perRailing);
  if (own.length) {
    const rows = own
      .map((q) => {
        const mine = typeof p.values?.[q.name] === 'number';
        return `<div class="rail-own">${numberField(`prof:value:${q.name}`, q.name, vals.get(q.name) ?? 0, 'mm')}${mine ? `<button class="btn btn-small" data-action="prof-value-reset" data-name="${escapeHtml(q.name)}" title="Typens värde (${escapeHtml(String(q.value))})">Typens</button>` : ''}</div>`;
      })
      .join('');
    const zones = (['height', 'width'] as const).filter((a) => !model.zones.some((z) => z.axis === a) && own.some((q) => q.name === ZONE_PARAM[a]));
    out.push(`<div class="field-label">Det här objektet</div><div class="fields">${rows}</div>${zones.length ? `<p class="note">${zones.map((a) => ZONE_PARAM[a]).join(' och ')} saknar sträckzon i typen och är låst.</p>` : ''}`);
  }
  // Materialet per delprofil, där typen tillåter.
  const mats = (doc.graphics.materials ?? []).filter((m) => m.building);
  const rows = model.parts
    .map((part) => {
      const cur = partMaterial(p, part);
      const typeMat = part.material ? doc.graphics.materials?.find((m) => m.id === part.material)?.name ?? part.material : 'inget';
      if (part.perObject === false) return `<p class="note">${escapeHtml(part.letter)} ${escapeHtml(part.name)}: ${escapeHtml(typeMat)} (typens)</p>`;
      const opts = [`<option value=""${!p.materials?.[part.id] ? ' selected' : ''}>Typens (${escapeHtml(typeMat)})</option>`, ...mats.map((m) => `<option value="${escapeHtml(m.id)}"${p.materials?.[part.id] && m.id === cur ? ' selected' : ''}>${escapeHtml(m.name)}</option>`)].join('');
      return `<label class="field"><span>${escapeHtml(part.letter)} ${escapeHtml(part.name)}</span><select data-key="prof:material:${escapeHtml(part.id)}">${opts}</select></label>`;
    })
    .join('');
  out.push(`<div class="field-label">Material</div><div class="fields">${rows}</div>`);
  // Avsluten (beslut G): sort, inom eller utöver referenslinjen, förskjutning.
  if (!plumb)
    for (const end of ['start', 'end'] as const) {
      const e = endOf(model, p[end]);
      const kinds = (Object.keys(END_KIND_LABELS) as EndKind[]).map((k) => `<option value="${k}"${k === e.kind ? ' selected' : ''}>${END_KIND_LABELS[k]}</option>`).join('');
      out.push(`<div class="field-label">Avslut i ${end === 'start' ? 'början' : 'slutet'}</div><div class="fields">
        <label class="field"><span>Avslut</span><select data-key="prof:end:${end}:kind">${kinds}</select></label>
        ${e.kind === 'angle' ? numberField(`prof:end:${end}:angle`, 'Vinkel', e.angle ?? 0, '°', 1) : ''}
        ${numberField(`prof:end:${end}:shift`, 'Förskjutning (+ ut)', e.shift ?? 0, 'mm')}
      </div>${segmented('prof-end-beyond', e.beyond ? 'beyond' : 'inside', [['inside', 'Inom'], ['beyond', 'Utöver']], ` data-end="${end}"`)}`);
    }
  if (!plumb) out.push('<p class="note">I knäckarna geras profilen, i plan och höjd. Ändprofiler (PA01 …) kommer i 0.11.7.</p>');
  return out.join('');
}

/** Typen i korthet under *Påverkar fler objekt*: grupp, delprofiler, ankare, sträckzoner, parametrar och editorn. */
export function profileTypeMarkup(doc: ProjectDoc, defId: Id): string {
  const def = doc.definitions[defId];
  const m = def?.profile;
  if (!m) return '';
  const users = Object.values(doc.elements).filter((e) => e.definition === defId).length;
  const parts = m.parts.map((q) => `${escapeHtml(q.letter)} ${escapeHtml(q.name)}`).join(', ');
  const zones = m.zones.map((z) => (z.axis === 'height' ? 'Höjd' : 'Bredd')).join(' och ') || 'inga (måtten låsta)';
  const params = m.params.map((q) => `${escapeHtml(q.name)} ${escapeHtml(String(q.value))}${q.perRailing ? ' (per objekt)' : ''}`).join(', ');
  const uses = (m.uses ?? ['free']).map((u) => PROFILE_USE_LABELS[u]).join(', ');
  return `<div class="shared-block">
    <div class="shared-head">Typen ${escapeHtml(def.name)} <span>gäller alla ${users} ${users === 1 ? 'profil' : 'profiler'}</span></div>
    <p class="note">${escapeHtml(def.description ?? '')}${def.description ? '. ' : ''}${escapeHtml(m.group)}. Delprofiler: ${parts}. Ankare: ${m.anchors.length}. Sträckzoner: ${zones}.${params ? ` Parametrar: ${params}.` : ''} Får användas som: ${escapeHtml(uses)}.</p>
    <div class="row"><button class="btn" data-action="style-profile-type" data-def="${escapeHtml(defId)}">Öppna i profileditorn…</button></div>
  </div>`;
}

/** Patch av profilens parametrar, där undefined tar bort nyckeln. */
export function patchProfiles(store: DocStore, ids: Id[], label: string, fn: (p: ProfileParams, el: Element) => Record<string, unknown> | null): boolean {
  const doc = store.doc;
  const patches: [Id, Record<string, unknown>][] = [];
  for (const id of ids) {
    const el = doc.elements[id];
    if (el?.type !== 'Profile') continue;
    const patch = fn(el.params as unknown as ProfileParams, el);
    if (patch) patches.push([id, patch]);
  }
  if (!patches.length) return false;
  store.transact(label, (tx) => {
    for (const [id, patch] of patches) {
      const el = tx.doc.elements[id];
      if (!el) continue;
      const params: Record<string, unknown> = { ...el.params };
      for (const [key, v] of Object.entries(patch)) {
        if (v === undefined) delete params[key];
        else params[key] = v;
      }
      tx.putElement({ ...el, params });
    }
  });
  return true;
}

const parse = (raw: string) => Number(raw.replace(/\s/g, '').replace(',', '.').replace('−', '-'));

/** Ett avslut med en ändring, utan det som är förval. */
function endPatch(model: ProfileTypeModel, e: Partial<EndSpec> | undefined, change: Partial<EndSpec>): Partial<EndSpec> | undefined {
  const next: Partial<EndSpec> = { ...e, ...change };
  if (next.kind === undefined || next.kind === endOf(model, undefined).kind) delete next.kind;
  if (!next.shift) delete next.shift;
  if (!next.beyond) delete next.beyond;
  if (next.kind !== 'angle') delete next.angle;
  return Object.keys(next).length ? next : undefined;
}

/** Ett ändrat fält med nyckeln `prof:…` (det efter `prof:`). Ger false när värdet inte gick att använda. */
export function applyProfileField(store: DocStore, ids: Id[], rest: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const raw = input.value;
  const [name, ...more] = rest.split(':');
  const n = parse(raw);
  const ok = Number.isFinite(n) && raw.trim() !== '';
  switch (name) {
    case 'level':
      return ok && patchProfiles(store, ids, 'Pelarens fot', () => ({ level: Math.round(n) || undefined }));
    case 'height':
      return ok && n > 0 && patchProfiles(store, ids, 'Pelarens höjd', () => ({ height: Math.round(n) }));
    case 'z': {
      const i = Number(more[0]);
      return ok && patchProfiles(store, ids, 'Punktens höjd', (p) => {
        const z = (p.line ?? []).map((_, j) => (j === i ? Math.round(n) : Number(p.z?.[j]) || 0));
        return { z: z.some((v) => v) ? z : undefined };
      });
    }
    case 'anchor':
      return ok && patchProfiles(store, ids, 'Ankare', (_, el) => ({ anchor: n === profileTypeOf(store.doc, el).anchor ? undefined : n }));
    case 'offset': {
      const i = Number(more[0]);
      return ok && patchProfiles(store, ids, 'Förskjutning', (p) => {
        const o: [number, number] = [p.offset?.[0] ?? 0, p.offset?.[1] ?? 0];
        o[i] = Math.round(n);
        return { offset: o[0] || o[1] ? o : undefined };
      });
    }
    case 'rotate':
      return ok && patchProfiles(store, ids, 'Vridning', () => {
        const v = Math.round((((n % 360) + 360) % 360) * 10) / 10;
        return { rotate: v || undefined };
      });
    case 'mirror':
      return patchProfiles(store, ids, 'Spegla', () => ({ mirror: (input as HTMLInputElement).checked || undefined }));
    case 'value': {
      const key = more.join(':');
      return ok && n > 0 && patchProfiles(store, ids, key, (p) => ({ values: { ...p.values, [key]: Math.round(n) } }));
    }
    case 'material': {
      const part = more.join(':');
      return patchProfiles(store, ids, 'Material', (p) => {
        const m = { ...p.materials };
        if (raw) m[part] = raw;
        else delete m[part];
        return { materials: Object.keys(m).length ? m : undefined };
      });
    }
    case 'end': {
      const end = more[0] === 'end' ? 'end' : 'start';
      const field = more[1];
      return patchProfiles(store, ids, `Avslut i ${end === 'start' ? 'början' : 'slutet'}`, (p, el) => {
        const model = profileTypeOf(store.doc, el);
        if (field === 'kind') return { [end]: endPatch(model, p[end], { kind: raw as EndKind }) };
        if (!ok) return null;
        if (field === 'shift') return { [end]: endPatch(model, p[end], { shift: Math.round(n) }) };
        if (field === 'angle') return { [end]: endPatch(model, p[end], { kind: 'angle', angle: Math.max(-80, Math.min(80, n)) }) };
        return null;
      });
    }
  }
  return false;
}

/** Knapparna i profilens fält. */
export function profileAction(store: DocStore, ids: Id[], action: string, b: HTMLElement): boolean {
  switch (action) {
    case 'prof-height-reset':
      return patchProfiles(store, ids, 'Till våningen ovanför', () => ({ height: undefined }));
    case 'prof-z-all':
      return patchProfiles(store, ids, 'Samma höjd', (p) => {
        const z0 = Number(p.z?.[0]) || 0;
        return { z: z0 ? (p.line ?? []).map(() => z0) : undefined };
      });
    case 'prof-up':
      return patchProfiles(store, ids, b.dataset.value === 'normal' ? 'Vinkelrätt mot banan' : 'Lodrätt', (_, el) => ({ up: b.dataset.value === (profileTypeOf(store.doc, el).up ?? 'plumb') ? undefined : b.dataset.value }));
    case 'prof-value-reset': {
      const name = b.dataset.name!;
      return patchProfiles(store, ids, `Typens ${name}`, (p) => {
        const { [name]: _, ...rest } = p.values ?? {};
        return { values: Object.keys(rest).length ? rest : undefined };
      });
    }
    case 'prof-end-beyond': {
      const end = b.dataset.end === 'end' ? 'end' : 'start';
      return patchProfiles(store, ids, b.dataset.value === 'beyond' ? 'Utöver referenslinjen' : 'Inom referenslinjen', (p, el) => ({ [end]: endPatch(profileTypeOf(store.doc, el), p[end], { beyond: b.dataset.value === 'beyond' }) }));
    }
  }
  return false;
}

/** En kopia av den markerades typ (Ny typ i panelen), som de markerade får. */
export function duplicateProfileType(store: DocStore, ids: Id[], nextName: string): void {
  const doc = store.doc;
  const el = doc.elements[ids[0]];
  const m = structuredClone(profileTypeOf(doc, el));
  const old = el.definition ? doc.definitions[el.definition] : undefined;
  const id = newId('t');
  store.transact(`Ny typ ${nextName}`, (tx) => {
    tx.putDefinition({ id, origin: 'component', name: nextName, elementType: 'Profile', params: {}, props: {}, profile: m, ...(old?.description ? { description: `${old.description} (kopia)` } : {}) });
    for (const i of ids) {
      const e = tx.doc.elements[i];
      if (e?.type === 'Profile') tx.putElement({ ...e, definition: id });
    }
  });
}
