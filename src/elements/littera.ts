import type { Element } from '../core/model';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { PlanContext } from './registry';
import { doorNumbersFor } from './rooms';
import { FRAME_LESS, HOLE_EXTRA, type WallFrame } from './wall';

/** Om littera ska ritas ut i vyn. I Skiss visas ingen littera. */
export function showLittera(ctx: PlanContext): boolean {
  return !ctx.view.hide?.includes('littera') && ctx.view.detail !== 'sketch';
}

const LETTER: Record<string, string> = { Door: 'D', Window: 'F', Wall: '' };

/** Modulmått i hela moduler: 1000 → 10. */
function modules(mm: unknown): string {
  const v = Number(mm);
  return Number.isFinite(v) ? String(Math.round(v / 100)) : '';
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
  for (const sets of [el.props, def?.props]) {
    for (const set of Object.values(sets ?? {})) {
      for (const [k, v] of Object.entries(set ?? {})) {
        if (k.toLowerCase() === name.toLowerCase() && v !== null && v !== undefined && String(v) !== '') return String(v);
      }
    }
  }
  return '';
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
  const out: string[] = [];
  for (const raw of tpl.split('\n')) {
    let any = false;
    let filled = false;
    const line = raw.replace(/\{([^}]+)\}/g, (_, name: string) => {
      any = true;
      const v = field(ctx, el, name.trim());
      if (v) filled = true;
      return v;
    });
    if ((any && !filled) || !line.trim()) continue;
    out.push(line.trim());
  }
  return out;
}

/**
 * Littera intill en vägg, dörr eller ett fönster, längs väggen på angiven
 * sida. Texten vänds så att den läses nedifrån eller från höger, och raderna
 * justeras enligt stilmallen. Väggar får ett streck under texten som pekar
 * på väggen.
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
    // Ett streck längs texten på väggens sida och ett kort streck in till väggen.
    const d = onUpSide ? gap - paper(0.9) : gap - paper(0.3);
    const pen = { weight: 0.18 };
    out.push(
      { kind: 'line', a: at(d, -width / 2), b: at(d, width / 2), pen, origin },
      { kind: 'line', a: at(0, 0), b: at(d, 0), pen, origin },
    );
  }
  return out;
}
