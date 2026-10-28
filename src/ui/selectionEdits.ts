import { applyTagField } from './litteraSection';
import { applyGroundField } from './groundFieldEdits';
import { setLevel } from '../core/levels';
import { moveElements, moveWallEnd, renameElement, updateDefinition, updateParams } from '../core/commands';
import type { Element, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import type { DocStore } from '../core/store';
import { reshapeWall } from '../core/wallEdit';
import { resolveParams } from '../elements/registry';
import { markerFrame, type MarkerHeights, type MarkerParams } from '../elements/markers';
import { markerHeights } from '../repr/sectionLevels';
import { buildingHeight } from '../repr/buildingHeight';
import { MAX_LEAN, type WallParams } from '../elements/wall';
import { bulgeForRadius } from '../geometry/arc';
import { add, norm, scale, sub } from '../geometry/vec';
import { PARAM_LABELS } from './labels';
import { PROPS } from './selectionFields';
import { rotateFurniture, type FurnitureParams } from '../elements/furniture';
import { dimensionSegments, type DimensionParams } from '../elements/annotation';
import { doorNumbersFor, numberingOf, roomNumbersFor } from '../elements/rooms';
import { createContext } from '../repr/context';
import type { RoofParams } from '../elements/roof';
import { ringArea, slabBase, type SlabParams } from '../elements/slab';

/**
 * Ändringar som egenskapspanelens knappar och fält gör (0.8.1, ur
 * propertiesPanel.ts). Allt går genom kommandon, ett ångra-steg per ändring.
 */

/**
 * Nytt värde för en sträcka i en måttkedja: det måttet pekar på i sträckans
 * bortre ände flyttas (en vägg vinkelrätt, en dörr längs sin vägg). Är den
 * änden fri flyttas punkten själv.
 */
export function setDimension(store: DocStore, id: string, k: number, value: number): void {
  const doc = store.doc;
  const el = doc.elements[id];
  if (!el || !(value > 0)) return;
  const p = resolveParams<DimensionParams>(doc, el);
  const seg = dimensionSegments(doc, p)[k];
  if (!seg) return;
  const delta = value - seg.value;
  if (Math.abs(delta) < 0.5) return;
  const r = (p.angle * Math.PI) / 180;
  const dir: [number, number] = [Math.cos(r), Math.sin(r)];
  const pick = (i: number) => {
    const q = p.points[i];
    return !Array.isArray(q) ? q.refs.find((ref) => doc.elements[ref.id]) : undefined;
  };
  const toRef = pick(seg.to);
  const fromRef = pick(seg.from);
  if (toRef) moveElements(store, [toRef.id], [Math.round(dir[0] * delta), Math.round(dir[1] * delta)], 'Ändra mått');
  else if (fromRef) moveElements(store, [fromRef.id], [Math.round(-dir[0] * delta), Math.round(-dir[1] * delta)], 'Ändra mått');
  else {
    const points = p.points.map((q, i) => (i === seg.to && Array.isArray(q) ? ([Math.round(q[0] + dir[0] * delta), Math.round(q[1] + dir[1] * delta)] as [number, number]) : q));
    updateParams(store, [id], { points }, 'Ändra mått');
  }
}

/** Lås dörrnumren: numren som de är nu sparas i dörrarna. */
export function lockDoorNumbers(store: DocStore, view: ViewStates, locked: boolean): void {
  const doc = store.doc;
  store.transact(locked ? 'Lås dörrnumren' : 'Lås upp dörrnumren', (tx) => {
    if (locked) {
      for (const storey of doc.storeys) {
        const { ctx } = createContext(doc, storey.id, view, doc.graphics, () => true);
        for (const [id, number] of doorNumbersFor(ctx)) {
          const el = tx.doc.elements[id];
          if (el) tx.putElement({ ...el, params: { ...el.params, number } });
        }
      }
    }
    tx.setProject({ ...tx.doc.project, doorNumbering: { locked } });
  });
}

/**
 * Ändra rumsnumreringen. Låses den sparas de nummer rummen har just nu, så
 * att de ligger kvar när rum läggs till eller flyttas.
 */
export function setNumbering(store: DocStore, view: ViewStates, name: string, input: HTMLInputElement | HTMLSelectElement): void {
  const doc = store.doc;
  const current = numberingOf(doc);
  const next = { ...current };
  if (name === 'locked') next.locked = (input as HTMLInputElement).checked;
  if (name === 'digits') next.digits = input.value === '3' ? 3 : 4;
  if (name === 'building') next.building = input.value.trim() || '1';
  store.transact(next.locked && !current.locked ? 'Lås rumsnumrering' : 'Ändra rumsnumrering', (tx) => {
    if (next.locked && !current.locked) {
      // Spara numren som de ser ut nu, plan för plan.
      for (const storey of doc.storeys) {
        const { ctx } = createContext(doc, storey.id, view, doc.graphics, () => true);
        for (const [id, number] of roomNumbersFor(ctx)) {
          const el = tx.doc.elements[id];
          if (el) tx.putElement({ ...el, params: { ...el.params, number } });
        }
      }
    }
    tx.setProject({ ...tx.doc.project, roomNumbering: next });
  });
}

/** Ändra varje markerat element utifrån dess egna värden, i en ångra-bar ändring. */
export function patchEach(store: DocStore, ids: string[], label: string, patch: (p: Record<string, unknown>, el: Element) => Record<string, unknown>): void {
  // Värdena räknas ut före ändringen, så att alla utgår från samma läge.
  const doc = store.doc;
  const patches = ids.filter((id) => doc.elements[id]).map((id) => [id, patch(doc.elements[id].params, doc.elements[id])] as const);
  store.transact(label, (tx) => {
    for (const [id, p] of patches) {
      const el = tx.doc.elements[id];
      if (el) tx.putElement({ ...el, params: { ...el.params, ...p } });
    }
  });
}

/** Räta upp ett element till en rak vinkel. Början (eller mitten för tak och inredning) ligger still. */
export function straighten(store: DocStore, el: Element, nearest: number): void {
  const doc = store.doc;
  const p = el.params as Record<string, any>;
  const snapAngle = (a: number) => {
    // Den av nearest och nearest + 180 som ligger närmast a.
    const options = [nearest, nearest + 180, nearest - 180, nearest + 360];
    return options.reduce((b, o) => (Math.abs(o - a) < Math.abs(b - a) ? o : b));
  };
  if (el.type === 'Wall' || el.type === 'Section' || el.type === 'Elevation') {
    const d = sub(p.end, p.start);
    const len = Math.hypot(d[0], d[1]);
    const a = (snapAngle((Math.atan2(d[1], d[0]) * 180) / Math.PI) * Math.PI) / 180;
    const end: [number, number] = [Math.round(p.start[0] + Math.cos(a) * len), Math.round(p.start[1] + Math.sin(a) * len)];
    if (el.type === 'Wall') moveWallEnd(store, el.id, 'end', end, { label: 'Räta upp', connected: true });
    else updateParams(store, [el.id], { end }, 'Räta upp');
  } else if (el.type === 'Furniture') {
    const fp = resolveParams<FurnitureParams>(doc, el);
    const target = snapAngle(((fp.rotation % 180) + 180) % 180) + (fp.rotation - (((fp.rotation % 180) + 180) % 180));
    updateParams(store, [el.id], rotateFurniture(fp, target - fp.rotation), 'Räta upp');
  } else if (el.type === 'Roof') {
    // Hela takfallet vrids kring referenslinjens start (0.10).
    const rp = resolveParams<RoofParams>(doc, el);
    const [a, b] = rp.ref;
    const now = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const turn = (snapAngle((now * 180) / Math.PI) * Math.PI) / 180 - now;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const rot = (q: readonly number[]): [number, number] => [Math.round(a[0] + (q[0] - a[0]) * c - (q[1] - a[1]) * s), Math.round(a[1] + (q[0] - a[0]) * s + (q[1] - a[1]) * c)];
    updateParams(store, [el.id], { outline: rp.outline.map(rot), ref: [rot(a), rot(b)] }, 'Räta upp');
  }
}

/** Mittpunkten för det markerade, för att vrida och spegla kring. */
export function selectionCenter(doc: ProjectDoc, ids: string[]): [number, number] {
  const pts: [number, number][] = [];
  for (const id of ids) {
    const p = doc.elements[id]?.params as Record<string, any> | undefined;
    if (!p) continue;
    if (p.start && p.end) pts.push(p.start, p.end);
    if (p.origin && typeof p.width === 'number') {
      const r = ((p.rotation ?? 0) * Math.PI) / 180;
      const c = (x: number, y: number): [number, number] => [p.origin[0] + x * Math.cos(r) - y * Math.sin(r), p.origin[1] + x * Math.sin(r) + y * Math.cos(r)];
      pts.push(c(0, 0), c(p.width, p.depth));
    }
    if (Array.isArray(p.outline)) pts.push(...p.outline);
    if (Array.isArray(p.points)) pts.push(...p.points.map((q: any) => (Array.isArray(q) ? q : q.at)));
    if (p.pos) pts.push(p.pos);
  }
  if (!pts.length) return [0, 0];
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
}

/** Bara nycklarna `keys` ur `o`. */
export function pick(o: Record<string, number>, keys: string[]): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, o[k]]));
}

/**
 * Ett ändrat fält i egenskapspanelen, med nyckeln `data-key` = "omfång:namn"
 * (t.ex. "param:height", "marker:length", "prop:Brandklass"). Ger false när
 * värdet inte gick att använda, så att panelen ritas om med det gamla.
 */
export function applyField(store: DocStore, ids: string[], key: string, input: HTMLInputElement | HTMLSelectElement, view: ViewStates): boolean {
  const doc = store.doc;
  const [scope, name] = key.split(':');
  if (scope === 'ground') return applyGroundField(store, ids, name, input);
  if (scope === 'tag') return applyTagField(store, ids, name, input.value);
  if (scope === 'name') {
    renameElement(store, ids[0], input.value);
    return true;
  }
  if (scope === 'scalebar') {
    // Skalstocken (0.8.12): skalan från en vy på bladet, eller en egen.
    if (name === 'view') {
      const el = doc.elements[ids[0]];
      const vp = doc.sheets.flatMap((s) => s.viewports).find((v) => v.id === input.value);
      updateParams(store, ids, input.value ? { view: input.value, scale: vp?.scale ?? el?.params.scale } : { view: undefined }, input.value ? 'Skalstocken följer vyn' : 'Egen skala');
      return true;
    }
    const v = Math.round(Number(input.value.replace(',', '.').replace(/^1:/, '')));
    if (!(v >= 1)) return false;
    updateParams(store, ids, { scale: v, view: undefined }, 'Ändra skalstockens skala');
    return true;
  }
  if (scope === 'stamp') {
    if (!input.value) return false;
    updateParams(store, ids, { stamp: input.value }, 'Byt stämpel');
    return true;
  }
  if (scope === 'level') {
    // Nivån mot våningen (0.10.13); väggens topp ligger kvar.
    const v = Number(input.value.replace(',', '.').replace('−', '-'));
    if (!Number.isFinite(v)) return false;
    if (!setLevel(store, ids, v)) {
      return false;
    }
    return true;
  }
  if (scope === 'roof' && name === 'heightAt') {
    // Taket ligger kvar; höjden räknas om till den andra sidan (0.10).
    const top = input.value === 'top';
    patchEach(store, ids, top ? 'Höjden gäller ovansidan' : 'Höjden gäller undersidan', (_, el) => {
      const rp = resolveParams<RoofParams>(doc, el);
      if ((rp.heightAt === 'top') === top) return {};
      const tv = rp.thickness / Math.cos((Math.max(0, Math.min(80, rp.slope)) * Math.PI) / 180);
      return { heightAt: top ? 'top' : undefined, height: Math.round(rp.height + (top ? tv : -tv)) };
    });
    return true;
  }
  if (scope === 'roof' && name === 'overhang') {
    // Språngets tjocklek (0.10.2); samma som takets sparas inte.
    const v = Number(input.value.replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) return false;
    patchEach(store, ids, 'Språngets tjocklek', (_, el) => ({ overhangThickness: Math.round(v) === resolveParams<RoofParams>(doc, el).thickness ? undefined : Math.round(v) }));
    return true;
  }
  if (scope === 'roof' && (name === 'eaveCut' || name === 'eaveAngle')) {
    // Takfotens snitt (0.10.2): vinkelrätt (förval), lodrätt eller en vinkel mot det vågräta.
    const v = name === 'eaveAngle' ? Number(input.value.replace(',', '.')) : input.value;
    if (typeof v === 'number' && (!Number.isFinite(v) || v < 5 || v > 90)) return false;
    patchEach(store, ids, 'Takfotens snitt', (_, el) => {
      const rp = resolveParams<RoofParams>(doc, el);
      if (v === 'angle') return { eaveCut: typeof rp.eaveCut === 'number' ? rp.eaveCut : Math.round(90 - rp.slope) };
      return { eaveCut: v === 'perp' ? undefined : v };
    });
    return true;
  }
  if (scope === 'roof' && name === 'radius') {
    // Positiv radie: taket stiger mot bågens centrum (en kon med spetsen uppåt).
    const v = Number(input.value.replace(',', '.'));
    if (!Number.isFinite(v)) return false;
    patchEach(store, ids, v ? 'Ändra referenslinjens radie' : 'Rak referenslinje', (_, el) => {
      const rp = resolveParams<RoofParams>(doc, el);
      return { refBulge: v ? Math.round(bulgeForRadius(rp.ref[0], rp.ref[1], Math.abs(v), v > 0 ? -1 : 1) * 10) / 10 : undefined };
    });
    return true;
  }
  if (scope === 'marker') {
    const el = doc.elements[ids[0]];
    if (!el) return true;
    if (name === 'length' || name === 'angle') {
      const raw = el.params as unknown as MarkerParams;
      const fr = markerFrame(doc, el);
      // En linje som följer byggnaden placeras för hand där den ligger.
      const p: MarkerParams = raw.auto ? { ...raw, start: [Math.round(fr.start[0]), Math.round(fr.start[1])], end: [Math.round(fr.end[0]), Math.round(fr.end[1])], side: 1 } : raw;
      const v = Number(input.value.replace(',', '.'));
      const d = [p.end[0] - p.start[0], p.end[1] - p.start[1]];
      const len = name === 'length' ? v : Math.hypot(d[0], d[1]);
      const ang = name === 'angle' ? (v * Math.PI) / 180 : Math.atan2(d[1], d[0]);
      if (!Number.isFinite(v) || len < 300) return false;
      // Början ligger still; slutet flyttas.
      const end: [number, number] = [Math.round(p.start[0] + Math.cos(ang) * len), Math.round(p.start[1] + Math.sin(ang) * len)];
      updateParams(store, [el.id], raw.auto ? { auto: false, start: p.start, side: 1, end } : { end }, name === 'length' ? 'Ändra längd' : 'Ändra vinkel');
    } else if (name.startsWith('heights.')) {
      // Höjderna i fasaden eller sektionen (0.10.8b): alla fyra sparas, så att förvalet inte ändras under ens fötter.
      const k = name.slice(8) as keyof MarkerHeights;
      const { ctx } = createContext(doc, doc.storeys[0].id, view, doc.graphics, () => true);
      const now = markerHeights(el, markerFrame(doc, el).view, buildingHeight(ctx));
      updateParams(store, [el.id], { heights: { ...now, [k]: (input as HTMLInputElement).checked } }, 'Höjder i vyn');
    } else if (name === 'depth' || name === 'toneDepth') {
      const v = Number(input.value);
      updateParams(store, [el.id], { [name]: input.value === '' || !(v > 0) ? null : Math.round(v) }, name === 'depth' ? 'Ändra djup' : 'Ändra tonat djup');
    } else if (name === 'auto') {
      const on = (input as HTMLInputElement).checked;
      if (on) updateParams(store, [el.id], { auto: true }, 'Placera automatiskt');
      else {
        const f = markerFrame(doc, el);
        updateParams(store, [el.id], { auto: false, start: [Math.round(f.start[0]), Math.round(f.start[1])], end: [Math.round(f.end[0]), Math.round(f.end[1])], side: 1 }, 'Placera själv');
      }
    }
    return true;
  }
  if (scope === 'wall' && name === 'storeyHeight') {
    // Väggens höjd följer våningen (0.9), eller är ett eget mått.
    const on = (input as HTMLInputElement).checked;
    store.transact(on ? 'Följ våningshöjden' : 'Egen höjd', (tx) => {
      for (const id of ids) {
        const el = tx.doc.elements[id];
        if (el?.type !== 'Wall') continue;
        const { height: _h, ...rest } = el.params;
        tx.putElement({ ...el, params: on ? rest : { ...rest, height: resolveParams<WallParams>(tx.doc, el).height } });
      }
    });
    return true;
  }
  if (scope === 'slab' && name === 'fromWalls') {
    // Ur väggarna (0.9.1): bocka ur, så blir konturen som den är nu en ritad kontur.
    const on = (input as HTMLInputElement).checked;
    store.transact(on ? 'Bjälklag ur väggarna' : 'Egen kontur', (tx) => {
      for (const id of ids) {
        const el = tx.doc.elements[id];
        if (el?.type !== 'Slab') continue;
        if (on) {
          tx.putElement({ ...el, params: { ...el.params, fromWalls: true, outline: [] } });
          continue;
        }
        const { ctx } = createContext(doc, el.storey, view, doc.graphics, () => true);
        const polys = slabBase(ctx, { ...resolveParams<SlabParams>(doc, el), fromWalls: true });
        const largest = polys.map((p) => p[0]).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0] ?? [];
        tx.putElement({ ...el, params: { ...el.params, fromWalls: false, outline: largest.map((q) => [Math.round(q[0]), Math.round(q[1])]) } });
      }
    });
    return true;
  }
  if (scope === 'wall' && (name === 'lean' || name === 'topOffset')) {
    // Lutande vägg (0.10.21): vinkeln från lodlinjen, eller toppens förskjutning i sidled (räknas om till vinkeln).
    const v = Number(input.value.replace(',', '.').replace('−', '-'));
    if (!Number.isFinite(v)) return false;
    patchEach(store, ids, 'Ändra lutning', (_, el) => {
      const p = resolveParams<WallParams>(doc, el);
      const deg = name === 'lean' ? v : p.height > 0 ? (Math.atan2(v, p.height) * 180) / Math.PI : 0;
      const lean = Math.round(Math.max(-MAX_LEAN, Math.min(MAX_LEAN, deg)) * 100) / 100;
      return { lean: lean ? lean : undefined };
    });
    return true;
  }
  if (scope === 'wall' && name === 'radius') {
    const el = doc.elements[ids[0]];
    const p = el?.params as unknown as WallParams;
    const v = Number(input.value);
    if (!el || !(v > 0)) return false;
    reshapeWall(store, el.id, p.start, p.end, bulgeForRadius(p.start, p.end, v, (p.bulge ?? 1) >= 0 ? 1 : -1), 'Ändra radie');
    return true;
  }
  if (scope === 'text' && name === 'anchor') {
    updateParams(store, ids, { anchor: input.value || undefined }, 'Ändra förankring');
    return true;
  }
  if (scope === 'text') {
    updateParams(store, ids, { [name]: input.value }, name === 'number' ? 'Ändra rumsnummer' : 'Ändra text');
    return true;
  }
  if (scope === 'prop' || scope === 'defprop') {
    const prop = key.slice(scope.length + 1);
    if (scope === 'prop') {
      const el = doc.elements[ids[0]];
      const set = { ...(el.props[PROPS] ?? {}) };
      if (input.value === '') delete set[prop];
      else set[prop] = input.value;
      store.transact(`Ändra ${prop.toLowerCase()}`, (tx) => tx.putElement({ ...el, props: { ...el.props, [PROPS]: set } }));
    } else {
      const def = doc.definitions[doc.elements[ids[0]].definition!];
      store.transact(`Ändra ${prop.toLowerCase()} för ${def.name}`, (tx) =>
        tx.putDefinition({ ...def, props: { ...def.props, [PROPS]: { ...(def.props[PROPS] ?? {}), [prop]: input.value } } }),
      );
    }
    return true;
  }
  if (scope === 'dimseg') {
    setDimension(store, ids[0], Number(name), Number(input.value));
    return true;
  }
  if (scope === 'doornumbering') {
    lockDoorNumbers(store, view, (input as HTMLInputElement).checked);
    return true;
  }
  if (scope === 'numbering') {
    setNumbering(store, view, name, input);
    return true;
  }
  if (scope === 'param' && name === 'ceilingHeight' && input.value === '') {
    updateParams(store, ids, { ceilingHeight: undefined }, 'Ta bort takhöjd');
    return true;
  }
  if (scope === 'param' && (input as HTMLInputElement).type === 'checkbox') {
    const on = (input as HTMLInputElement).checked;
    const label =
      name === 'glazed' ? (on ? 'Glasad' : 'Ej glasad') : name === 'fixed' ? (on ? 'Fast inredning' : 'Lös möblering') : name === 'toRoof' ? (on ? 'Upp till taket' : 'Egen höjd') : name === 'bold' ? (on ? 'Fet stil' : 'Normal stil') : 'Ändra';
    updateParams(store, ids, { [name]: on }, label);
    return true;
  }
  if (scope === 'param' && name === 'inset' && input.value === '') {
    updateParams(store, ids, { inset: null }, 'Automatiskt indrag');
    return true;
  }
  const v = Number(input.value);
  if (!(v >= 0)) return false;
  if (scope === 'def') {
    const el = doc.elements[ids[0]];
    if (el?.definition && v > 0) updateDefinition(store, el.definition, { params: { [name]: v } });
  } else if (scope === 'param') {
    updateParams(store, ids, { [name]: v }, `Ändra ${(PARAM_LABELS[name] ?? name).toLowerCase()}`);
  } else if (scope === 'wall' && name === 'length' && v > 0) {
    // Ny längd: slutpunkten flyttas längs väggen och anslutna väggar följer med.
    const el = doc.elements[ids[0]];
    const p = el.params as unknown as WallParams;
    const end = add(p.start, scale(norm(sub(p.end, p.start)), v));
    moveWallEnd(store, el.id, 'end', [Math.round(end[0]), Math.round(end[1])], { label: 'Ändra längd' });
  }
  return true;
}
