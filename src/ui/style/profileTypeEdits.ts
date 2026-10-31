import type { Id } from '../../core/model';
import { updateProfileType } from '../../core/profiles';
import { boxOfPoints, flatContour, nextPartLetter, ringArea, ZONE_PARAM, type AnchorPos, type EndKind, type PPoint, type ProfileContour, type ProfileTypeModel, type ProfileUse, type SubProfile } from '../../core/profileTypes';
import type { DocStore } from '../../core/store';

/**
 * Ändringarna i profileditorn (0.11.6): fälten (`ptype:<typ>:…`) och det
 * som ritas i ritytan. Allt går genom `updateProfileType`, så att alla
 * objekt av typen ändras med den och ångra tar hela ändringen.
 */

const parse = (raw: string) => Number(raw.replace(/\s/g, '').replace(',', '.').replace('−', '-'));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Höjd och Bredd följer det ritade när konturerna ändras (ett fast värde; en formel lämnas). */
export function syncSize(m: ProfileTypeModel): ProfileTypeModel {
  const box = boxOfPoints(m.parts.flatMap((p) => flatContour(p.contour)));
  for (const axis of ['height', 'width'] as const) {
    const q = m.params.find((x) => x.name === ZONE_PARAM[axis]);
    if (q && typeof q.value === 'number') q.value = Math.round(axis === 'height' ? box.maxY - box.minY : box.maxX - box.minX);
  }
  return m;
}

/** Ett nytt id för en delprofil. */
function partId(m: ProfileTypeModel, letter: string): string {
  const ids = new Set(m.parts.map((p) => p.id));
  let id = letter.toLowerCase();
  for (let n = 2; ids.has(id); n++) id = `${letter.toLowerCase()}${n}`;
  return id;
}

/** Lägg till en delprofil med konturen; svarar med dess id. */
export function addPart(store: DocStore, defId: Id, contour: ProfileContour): string | null {
  let made: string | null = null;
  updateProfileType(store, defId, 'Ny delprofil', (m) => {
    const pts = contour.pts.map((q): PPoint => [r1(q[0]), r1(q[1])]);
    if (pts.length < 2) return null;
    const letter = nextPartLetter(m);
    const id = partId(m, letter);
    const flat = flatContour({ pts, ...(contour.bulges ? { bulges: contour.bulges } : {}) });
    if (Math.abs(ringArea(flat)) < 1) return null;
    m.parts.push({ id, letter, name: `Del ${letter}`, contour: { pts, ...(contour.bulges?.some((b) => b) ? { bulges: contour.bulges } : {}) }, ...(m.parts.length ? { place: 'edge' as const } : {}) });
    made = id;
    return syncSize(m);
  });
  return made;
}

/** Flytta en punkt i en delprofil (dra i ritytan). */
export function movePoint(store: DocStore, defId: Id, part: string, i: number, to: PPoint): boolean {
  return updateProfileType(store, defId, 'Flytta punkt', (m) => {
    const p = m.parts.find((x) => x.id === part);
    if (!p?.contour.pts[i]) return null;
    p.contour.pts[i] = [r1(to[0]), r1(to[1])];
    return syncSize(m);
  });
}

/** Ett ankare i en egen punkt (verktyget Ankare). */
export function addAnchorAt(store: DocStore, defId: Id, at: PPoint): number | null {
  let no: number | null = null;
  updateProfileType(store, defId, 'Nytt ankare', (m) => {
    no = Math.max(0, ...m.anchors.map((a) => a.no)) + 1;
    m.anchors.push({ no, name: `Ankare ${no}`, at: [r1(at[0]), r1(at[1])] });
    return m;
  });
  return no;
}

/** En sträckzon mellan två värden (verktyget Sträckzon); parametern läggs till om den saknas. */
export function addZone(store: DocStore, defId: Id, axis: 'height' | 'width', a: number, b: number): boolean {
  return updateProfileType(store, defId, axis === 'height' ? 'Sträckzon Höjd' : 'Sträckzon Bredd', (m) => {
    const from = r1(Math.min(a, b));
    const to = r1(Math.max(a, b));
    if (to - from < 1) return null;
    m.zones.push({ axis, from, to });
    if (!m.params.some((q) => q.name === ZONE_PARAM[axis])) {
      const box = boxOfPoints(m.parts.flatMap((p) => flatContour(p.contour)));
      m.params.unshift({ name: ZONE_PARAM[axis], value: Math.round(axis === 'height' ? box.maxY - box.minY : box.maxX - box.minX), perRailing: true });
    }
    return m;
  });
}

/** Ett ändrat fält i editorn: `rest` är det efter `ptype:<typ>:`. */
export function applyProfileTypeField(store: DocStore, defId: Id, rest: string[], input: HTMLInputElement | HTMLSelectElement): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.profile) return false;
  const raw = input.value;
  const n = parse(raw);
  const ok = Number.isFinite(n) && raw.trim() !== '';
  const checked = (input as HTMLInputElement).checked;
  const [field, a, b, c, d] = rest;
  if (field === 'name' || field === 'description') {
    const v = raw.trim();
    if (field === 'name' && !v) return false;
    store.transact(field === 'name' ? `Littera ${v}` : 'Beskrivning', (tx) => {
      const cur = tx.doc.definitions[defId];
      if (!cur) return;
      const next = { ...cur };
      if (field === 'name') next.name = v;
      else if (v) next.description = v;
      else delete next.description;
      tx.putDefinition(next);
    });
    return true;
  }
  return updateProfileType(store, defId, 'Ändra profiltyp', (m) => {
    switch (field) {
      case 'group':
        m.group = raw;
        return m;
      case 'ground':
      case 'building':
        if (checked) m[field] = true;
        else delete m[field];
        return m;
      case 'use': {
        const set = new Set<ProfileUse>(m.uses ?? ['free']);
        if (checked) set.add(a as ProfileUse);
        else set.delete(a as ProfileUse);
        m.uses = [...set];
        if (m.uses.length === 1 && m.uses[0] === 'free') delete m.uses;
        return m;
      }
      case 'up':
        if (raw === 'normal') m.up = 'normal';
        else delete m.up;
        return m;
      case 'ends':
        if (raw) m.ends = raw as EndKind;
        else delete m.ends;
        return m;
      case 'part': {
        const p = m.parts.find((x) => x.id === a);
        if (!p) return null;
        return partField(m, p, b, c, d, raw, n, ok, checked);
      }
      case 'anchor': {
        const an = m.anchors.find((x) => String(x.no) === a);
        if (!an) return null;
        if (b === 'name') an.name = raw.trim() || an.name;
        else if (b === 'pos') {
          if (raw) {
            an.pos = raw as AnchorPos;
            delete an.at;
          } else if (!an.at) return null;
        } else if (b === 'x' || b === 'y') {
          if (!ok) return null;
          const at: PPoint = an.at ? [...an.at] : [0, 0];
          at[b === 'x' ? 0 : 1] = r1(n);
          an.at = at;
          delete an.pos;
        }
        return m;
      }
      case 'zone': {
        const z = m.zones[Number(a)];
        if (!z || !ok || (b !== 'from' && b !== 'to')) return null;
        z[b] = r1(n);
        if (z.to - z.from < 1) return null;
        return m;
      }
      case 'param': {
        const q = m.params[Number(a)];
        if (!q) return null;
        if (b === 'name') {
          const v = raw.trim();
          if (!v || m.params.some((x) => x !== q && x.name === v)) return null;
          q.name = v;
        } else if (b === 'value') {
          if (!ok) return null;
          q.value = n;
        } else if (b === 'formula') q.value = raw.trim() ? raw.trim() : 0;
        else if (b === 'per') {
          if (checked) q.perRailing = true;
          else delete q.perRailing;
        } else return null;
        return m;
      }
    }
    return null;
  });
}

function partField(m: ProfileTypeModel, p: SubProfile, field: string, i: string | undefined, coord: string | undefined, raw: string, n: number, ok: boolean, checked: boolean): ProfileTypeModel | null {
  switch (field) {
    case 'letter': {
      const v = raw.trim().toUpperCase();
      if (!v || m.parts.some((x) => x !== p && x.letter === v)) return null;
      p.letter = v;
      return m;
    }
    case 'name':
      p.name = raw.trim() || p.name;
      return m;
    case 'material':
      if (raw) p.material = raw;
      else delete p.material;
      return m;
    case 'perObject':
      if (checked) delete p.perObject;
      else p.perObject = false;
      return m;
    case 'followsEnd':
      if (checked) delete p.followsEnd;
      else p.followsEnd = false;
      return m;
    case 'place':
      if (raw === 'over' || raw === 'free' || raw === 'edge') p.place = raw;
      return m;
    case 'extend':
      if (!ok) return null;
      if (n) p.extend = Math.round(n);
      else delete p.extend;
      return m;
    case 'detail':
      if (raw === 'normal' || raw === 'detail' || raw === 'sketch') p.detail = raw;
      else delete p.detail;
      return m;
    case 'pt': {
      const k = Number(i);
      if (!p.contour.pts[k] || !ok) return null;
      if (coord === 'x' || coord === 'y') p.contour.pts[k][coord === 'x' ? 0 : 1] = r1(n);
      else if (coord === 'b') {
        const bs = p.contour.pts.map((_, j) => Number(p.contour.bulges?.[j]) || 0);
        bs[k] = r1(n);
        if (bs.some((v) => v)) p.contour.bulges = bs;
        else delete p.contour.bulges;
      } else return null;
      return syncSize(m);
    }
  }
  return null;
}

/** Knapparna för delprofilerna, punkterna, ankarna, zonerna och parametrarna. */
export function profileTypeAction(store: DocStore, defId: Id, act: string, el: HTMLElement): boolean {
  const part = el.dataset.pePart ?? '';
  const i = Number(el.dataset.peIndex);
  return updateProfileType(store, defId, 'Ändra profiltyp', (m) => {
    const pi = m.parts.findIndex((x) => x.id === part);
    const p = m.parts[pi];
    switch (act) {
      case 'part-remove':
        if (!p || m.parts.length <= 1) return null;
        m.parts.splice(pi, 1);
        return syncSize(m);
      case 'part-up':
      case 'part-down': {
        const j = pi + (act === 'part-up' ? -1 : 1);
        if (!p || j < 0 || j >= m.parts.length) return null;
        [m.parts[pi], m.parts[j]] = [m.parts[j], m.parts[pi]];
        return m;
      }
      case 'pt-remove':
        if (!p || p.contour.pts.length <= 3) return null;
        p.contour.pts.splice(i, 1);
        if (p.contour.bulges) p.contour.bulges.splice(i, 1);
        return syncSize(m);
      case 'pt-insert': {
        if (!p) return null;
        const a = p.contour.pts[i];
        const b = p.contour.pts[(i + 1) % p.contour.pts.length];
        p.contour.pts.splice(i + 1, 0, [r1((a[0] + b[0]) / 2), r1((a[1] + b[1]) / 2)]);
        if (p.contour.bulges) p.contour.bulges.splice(i + 1, 0, 0);
        return m;
      }
      case 'anchor-new': {
        const no = Math.max(0, ...m.anchors.map((x) => x.no)) + 1;
        m.anchors.push({ no, name: `Ankare ${no}`, pos: 'c' });
        return m;
      }
      case 'anchor-remove': {
        if (m.anchors.length <= 1) return null;
        m.anchors = m.anchors.filter((x) => x.no !== i);
        if (m.anchor === i) m.anchor = m.anchors[0].no;
        return m;
      }
      case 'anchor-default':
        if (!m.anchors.some((x) => x.no === i)) return null;
        m.anchor = i;
        return m;
      case 'zone-remove':
        if (!m.zones[i]) return null;
        m.zones.splice(i, 1);
        return m;
      case 'param-add': {
        let k = 1;
        while (m.params.some((q) => q.name === `Parameter${k}`)) k++;
        m.params.push({ name: `Parameter${k}`, value: 0 });
        return m;
      }
      case 'param-remove':
        if (!m.params[i]) return null;
        m.params.splice(i, 1);
        return m;
    }
    return null;
  });
}
