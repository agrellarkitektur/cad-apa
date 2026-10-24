import type { Element } from '../core/model';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { PlanContext } from './registry';
import { doorNumbersFor } from './rooms';
import { FRAME_LESS, HOLE_EXTRA, type WallFrame } from './wall';

/**
 * Om littera för en objekttyp ska ritas ut i vyn. I Skiss visas ingen
 * littera. Visa släcker den per typ (`littera:Door`, 0.8.11) eller all på en
 * gång (`littera`, som äldre vyer).
 */
export function showLittera(ctx: PlanContext, type: string): boolean {
  const hide = ctx.view.hide;
  return !hide?.includes('littera') && !hide?.includes(`littera:${type}`) && ctx.view.detail !== 'sketch';
}

const LETTER: Record<string, string> = { Door: 'D', Window: 'F', Wall: '' };

/** Modulmått i hela moduler: 1000 → 10. */
function modules(mm: unknown): string {
  const v = Number(mm);
  return Number.isFinite(v) ? String(Math.round(v / 100)) : '';
}

/**
 * Raderna ur en mall med fält inom klammer (littera, och rumsstämpeln sedan
 * 0.8.22). En rad där alla fält blev tomma hoppas över, liksom tomma rader.
 * `fields` är fältens namn på raden, med gemener.
 */
export function fillTemplate(tpl: string, value: (name: string) => string): { text: string; fields: string[] }[] {
  const out: { text: string; fields: string[] }[] = [];
  for (const raw of tpl.split('\n')) {
    const fields: string[] = [];
    let filled = false;
    const line = raw.replace(/\{([^}]+)\}/g, (_, name: string) => {
      fields.push(name.trim().toLowerCase());
      const v = value(name.trim());
      if (v) filled = true;
      return v;
    });
    if ((fields.length && !filled) || !line.trim()) continue;
    out.push({ text: line.trim(), fields });
  }
  return out;
}

/** Ett eget värde med namnet (utan skiftläge) bland egenskaperna, eller tom text. */
export function ownProp(sets: (Element['props'] | undefined)[], name: string): string {
  for (const props of sets) {
    for (const set of Object.values(props ?? {})) {
      for (const [k, v] of Object.entries(set ?? {})) {
        if (k.toLowerCase() === name.toLowerCase() && v !== null && v !== undefined && String(v) !== '') return String(v);
      }
    }
  }
  return '';
}

/** Värdet för ett fält i en litteramall, eller tom text. */
function field(ctx: PlanContext, el: Element<any>, name: string): string {
  const def = el.definition ? ctx.doc.definitions[el.definition] : undefined;
  const p = ctx.params<Record<string, unknown>>(el);
  const w = Number(p.width);
  const h = Number(p.height);
  switch (name.toLowerCase()) {
    case 'typ':
      return def?.name ?? '';
    case 'storlek':
      return Number.isFinite(w) && Number.isFinite(h) ? `${LETTER[el.type] ?? ''}${modules(w)}×${modules(h)}` : '';
    case 'nummer':
      if (el.name) return el.name;
      return el.type === 'Door' ? doorNumbersFor(ctx).get(el.id) ?? '' : '';
    case 'hål':
    case 'hal':
      return Number.isFinite(w) && Number.isFinite(h) ? `${w + HOLE_EXTRA}×${h + HOLE_EXTRA}` : '';
    case 'karm':
      return Number.isFinite(w) && Number.isFinite(h) ? `${w - FRAME_LESS}×${h - FRAME_LESS}` : '';
    case 'tjocklek':
      return p.thickness !== undefined ? String(p.thickness) : '';
  }
  // Egna egenskaper: först objektets egna, sedan typens. Namnet jämförs utan skiftläge.
  return ownProp([el.props, def?.props], name);
}

/**
 * Litterats rader enligt stilmallens mall för typen och vyns detaljnivå.
 * En rad där alla fält blev tomma hoppas över.
 */
export function litteraLines(ctx: PlanContext, el: Element<any>): string[] {
  // Det som rivs får ingen littera.
  if (ctx.actionOf(el) === 'demolished') return [];
  const templates = ctx.style.labels.templates[el.type as 'Wall' | 'Door' | 'Window'];
  if (!templates) return [];
  const tpl = ctx.view.detail === 'detail' ? templates.detail : templates.normal;
  return fillTemplate(tpl, (name) => field(ctx, el, name)).map((r) => r.text);
}

/**
 * Littera intill en vägg, dörr eller ett fönster, längs väggen på angiven
 * sida. Texten vänds så att den läses nedifrån eller från höger, och raderna
 * justeras enligt stilmallen. Väggar får ett rakt streck från texten in
 * till väggens mitt.
 */
export function litteraTag(ctx: PlanContext, el: Element<any>, f: WallFrame, s: number, side: 1 | -1, opts: { leader?: boolean } = {}): Primitive[] {
  const lines = litteraLines(ctx, el);
  if (!lines.length) return [];
  const labels = ctx.style.labels;
  const height = labels.heights.littera;
  const paper = (mm: number) => mm * ctx.scale;
  const step = paper(height * 1.45);
  let a = Math.atan2(f.u[1], f.u[0]);
  while (a > Math.PI / 2 + 1e-6) a -= Math.PI;
  while (a <= -Math.PI / 2 + 1e-6) a += Math.PI;
  const along: Vec2 = [Math.cos(a), Math.sin(a)];
  const up: Vec2 = [-Math.sin(a), Math.cos(a)];
  // Ligger etiketten "ovanför" väggen i läsriktningen staplas raderna uppåt
  // från väggen; annars nedåt.
  const onUpSide = (f.n[0] * up[0] + f.n[1] * up[1]) * side > 0;
  const gap = paper(opts.leader ? 3 : 1.2);
  const n = lines.length;
  const width = Math.max(...lines.map((l) => l.length)) * paper(height) * 0.62;
  const origin = { objectId: el.id, objectType: el.type, part: 'littera' };
  const base = f.at(s, side * f.half);
  const outward: Vec2 = [f.n[0] * side, f.n[1] * side];
  const at = (d: number, x: number): Vec2 => [base[0] + outward[0] * d + along[0] * x, base[1] + outward[1] * d + along[1] * x];
  const left = labels.align === 'left';
  const out: Primitive[] = lines.map((text, k) => {
    const d = onUpSide ? gap + (n - 1 - k) * step : gap + paper(height) + k * step;
    return {
      kind: 'text',
      at: at(d, left ? -width / 2 : 0),
      text,
      height,
      align: left ? 'start' : 'middle',
      angle: a,
      pen: { weight: 0.18 },
      origin,
    };
  });
  if (opts.leader) {
    // Ett rakt streck från texten in till väggens mitt, utan streck längs texten.
    const d = onUpSide ? gap - paper(0.9) : gap - paper(0.3);
    out.push({ kind: 'line', a: at(-f.half, 0), b: at(d, 0), pen: { weight: 0.18 }, origin });
  }
  return out;
}
