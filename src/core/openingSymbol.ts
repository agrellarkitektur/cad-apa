import type { LaidCell } from './openingTypes';

/** En linje i luftens plan: u från vänster sett utifrån, z uppåt (mm). */
export type Seg = [u1: number, z1: number, u2: number, z2: number];

/**
 * Öppningssymbolen för en luft i fasaden (0.11.8.1), gemensam för 3D,
 * fasader, sektioner och editorns förhandsvisning:
 *
 * - Hängda lufter och dörrblad: linjerna **spretar mot gångjärnssidan**,
 *   från en punkt mitt på handtagssidan ut till gångjärnssidans två hörn
 *   (Carl August, kommentar A på mockupen). Underkantshängd: från
 *   överkantens mitt till de nedre hörnen; överkantshängd tvärtom.
 * - Skjut: bara en pil, åt det håll bladet skjuts (mot gångjärnssidan i
 *   typen, *Skjuts åt*, dit kassetten eller det öppna läget är), inga sneda
 *   linjer (kommentar E).
 * - Vik: en sicksack. Porten: en pil uppåt.
 */
export function symbolSegments(c: Pick<LaidCell, 'rect' | 'op' | 'hinge'>): Seg[] {
  const r = c.rect;
  const out: Seg[] = [];
  const um = (r.u0 + r.u1) / 2;
  const zm = (r.z0 + r.z1) / 2;
  const side = (left: boolean) => {
    const hu = left ? r.u0 : r.u1;
    const fu = left ? r.u1 : r.u0;
    out.push([fu, zm, hu, r.z0], [fu, zm, hu, r.z1]);
  };
  // Gångjärnen nere: från överkantens mitt till de nedre hörnen.
  const bottom = () => out.push([um, r.z1, r.u0, r.z0], [um, r.z1, r.u1, r.z0]);
  const top = () => out.push([um, r.z0, r.u0, r.z1], [um, r.z0, r.u1, r.z1]);
  const arrow = (toLeft: boolean) => {
    const w = r.u1 - r.u0;
    const a = toLeft ? r.u1 - w * 0.2 : r.u0 + w * 0.2;
    const e = toLeft ? r.u0 + w * 0.2 : r.u1 - w * 0.2;
    const k = Math.min(80, w * 0.1) * (toLeft ? 1 : -1);
    out.push([a, zm, e, zm], [e, zm, e + k, zm + Math.abs(k) * 0.6], [e, zm, e + k, zm - Math.abs(k) * 0.6]);
  };
  const left = c.hinge !== 'right';
  switch (c.op) {
    case 'side':
    case 'leaf':
      side(left);
      break;
    case 'tiltturn':
      side(left);
      bottom();
      break;
    case 'bottom':
      bottom();
      break;
    case 'top':
      top();
      break;
    case 'pivotH':
      bottom();
      top();
      break;
    case 'pivotV':
      side(true);
      side(false);
      break;
    case 'slide':
    case 'slideLeaf':
    case 'pocket':
      arrow(left);
      break;
    case 'fold':
    case 'foldLeaf': {
      const n = 4;
      const w = (r.u1 - r.u0) / n;
      for (let i = 0; i < n; i++) out.push([r.u0 + i * w, i % 2 ? r.z0 + 200 : zm, r.u0 + (i + 1) * w, i % 2 ? zm : r.z0 + 200]);
      break;
    }
    case 'garage': {
      const k = Math.min(120, (r.u1 - r.u0) * 0.1);
      const z0 = r.z0 + (r.z1 - r.z0) * 0.25;
      const z1 = r.z1 - (r.z1 - r.z0) * 0.25;
      out.push([um, z0, um, z1], [um, z1, um - k, z1 - k], [um, z1, um + k, z1 - k]);
      break;
    }
  }
  return out;
}
