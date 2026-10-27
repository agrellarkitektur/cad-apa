import { updateParams } from '../core/commands';
import { fromRh } from '../core/site';
import type { DocStore } from '../core/store';
import type { GroundParams } from '../elements/ground';
import { lineLength } from '../elements/groundLines';
import { rampSides, tidyLevels } from '../elements/groundRamp';
import { resolveParams } from '../elements/registry';

/*
 * Markobjektets fält när de ändras (0.10.4–0.10.18): höjderna i RH 2000
 * eller mm, krönets och rampens punkter med höjd, sidorna och kanterna.
 * Fälten står i groundFields.ts. (Utbrutet i granskningen efter 0.10.18.)
 */

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
