import type { FillFamily, FillTypeDef } from './fillTypes';

/** `.pat`-filer (AutoCAD, ArchiCAD), 0.8.36; egen fil sedan 0.8.38. DXF-skrafferingarna läses med `patFamily`. */

/**
 * Fyllningstyperna i en `.pat`-fil (AutoCAD, ArchiCAD): en rubrik
 * `*NAMN, beskrivning` och en rad per linjefamilj, `vinkel, x, y,
 * förskjutning, avstånd, streck …` där positiva tal är streck, negativa
 * mellanrum och 0 en punkt. Kommentarer börjar med `;`. Typer utan någon
 * läsbar familj hoppas över. Mönster med stora mått (över 20 mm mellan
 * linjerna) antas vara i verkliga mått (modellen).
 */
export function parsePat(text: string): FillTypeDef[] {
  const out: FillTypeDef[] = [];
  let cur: FillTypeDef | null = null;
  const done = () => {
    if (cur?.families.length) {
      if (cur.families.some((f) => f.spacing > 20)) cur.model = true;
      out.push(cur);
    }
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('*')) {
      done();
      const [name, desc] = line.slice(1).split(',');
      const n = name.trim();
      cur = { name: n || desc?.trim() || 'Fyllning', families: [] };
      continue;
    }
    if (!cur) continue;
    const v = line.split(',').map((s) => Number(s.trim()));
    if (v.length < 5 || v.slice(0, 5).some((x) => !Number.isFinite(x))) continue;
    const f = patFamily(v[0], v[1], v[2], v[3], v[4], v.slice(5).filter(Number.isFinite));
    if (f) cur.families.push(f);
  }
  done();
  return out;
}

/**
 * En linjefamilj ur `.pat`-filens tal (också DXF-skrafferingens): vinkel,
 * baspunkt, förskjutning längs och tvärs linjerna och strecken. Null om
 * linjerna inte har något avstånd.
 */
export function patFamily(angle: number, x: number, y: number, along: number, across: number, dashes: readonly number[]): FillFamily | null {
  // En negativ förskjutning tvärs linjerna är samma linjer åt andra hållet.
  const flip = across < 0 ? -1 : 1;
  const spacing = Math.abs(across);
  if (!(spacing > 1e-9)) return null;
  let d = [...dashes];
  let [bx, by] = [x, y];
  // Börjar streckningen med ett mellanrum flyttas det sist och baspunkten lika långt fram.
  const lead = d.findIndex((v) => v >= 0);
  if (lead > 0) {
    const g = d.slice(0, lead).reduce((s, v) => s - v, 0);
    const a = (angle * Math.PI) / 180;
    bx += g * Math.cos(a);
    by += g * Math.sin(a);
    d = [...d.slice(lead), ...d.slice(0, lead)];
  }
  return { angle, x: bx, y: by, spacing, shift: along * flip, dash: lead < 0 ? [] : patDash(d) };
}

/** `.pat`-strecken (positiva streck, negativa mellanrum, 0 punkt) som omväxlande streck och mellanrum. */
export function patDash(v: readonly number[]): number[] {
  if (!v.length) return [];
  const out: number[] = [];
  // Lika tecken i rad slås ihop (mönstret börjar med ett streck, se parsePat).
  for (const x of v) {
    const stroke = x >= 0;
    const len = Math.abs(x);
    const wantStroke = out.length % 2 === 0;
    if (stroke === wantStroke) out.push(len);
    else if (out.length) out[out.length - 1] += len;
  }
  // Två punkter i rad (0, 0) blir ett streck på 0 och ett mellanrum på 0, som ritas som en punkt.
  if (out.length % 2) out.push(0);
  // Ett mönster utan mellanrum är heldraget.
  return out.some((x, i) => i % 2 === 1 && x > 0) ? out : [];
}

/** Typerna som `.pat`-text, för att spara och dela. */
export function formatPat(types: readonly FillTypeDef[]): string {
  const n = (x: number) => String(Math.round(x * 10000) / 10000);
  return types
    .map((t) => {
      const head = `*${t.name.replace(/[,*\r\n]/g, ' ').trim() || 'Fyllning'}`;
      const rows = t.families.map((f) => {
        const dash = f.dash.map((d, i) => (i % 2 ? -d : d)).filter((d, i) => i % 2 === 0 || d !== 0);
        return [f.angle, f.x, f.y, f.shift, f.spacing, ...dash].map(n).join(', ');
      });
      return [head, ...rows].join('\n');
    })
    .join('\n') + '\n';
}
