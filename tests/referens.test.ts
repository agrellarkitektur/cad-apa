import { beforeAll, describe, expect, it } from 'vitest';
import type { ProjectDoc } from '../src/core/model';
import { modelViewId } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { addViewport, createSheet } from '../src/core/sheets';
import { registerBuiltInTypes } from '../src/elements';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import type { Primitive, Vec2 } from '../src/repr/primitives';
import { buildSection } from '../src/repr/section';
import { buildSheet, centeredAt } from '../src/repr/sheet';
import type { Shape3D } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { roomGrid } from './projekt';

/**
 * Referensritningar (0.8.2). Några testprojekt ritas (planer, fasader,
 * sektioner, 3D och ett blad) och jämförs mot facit i `tests/referens/`, en
 * rad per ritad sak. Ändras en ritning syns det som en skillnad i facit:
 *
 *   npx vitest run tests/referens.test.ts        jämför
 *   npx vitest run tests/referens.test.ts -u     skriv nytt facit (efter en avsiktlig ändring)
 *
 * Läs skillnaden i git innan nytt facit läggs in; den visar vad som ändrats.
 * Koordinaterna avrundas till 0,1 mm, så att små skillnader i flyttal inte syns.
 */

beforeAll(() => registerBuiltInTypes());

const n = (x: number): string => {
  const r = Math.round(x * 10) / 10;
  return String(Object.is(r, -0) ? 0 : r);
};
const pt = (p: Vec2): string => `${n(p[0])},${n(p[1])}`;
const pen = (p: { weight: number; color?: string; dash?: readonly number[]; opacity?: number } | null | undefined): string =>
  p ? [`w${p.weight}`, p.color, p.dash?.length ? `d${p.dash.join('/')}` : '', p.opacity !== undefined && p.opacity !== 1 ? `o${p.opacity}` : ''].filter(Boolean).join(' ') : 'ingen';

/** En rad per primitiv: slag, geometri, penna och vems den är. */
export function primLine(p: Primitive): string {
  const who = p.origin ? ` @${p.origin.objectId ?? ''}${p.origin.part ? `/${p.origin.part}` : ''}` : '';
  switch (p.kind) {
    case 'line':
      return `linje ${pt(p.a)} ${pt(p.b)} [${pen(p.pen)}]${who}`;
    case 'polyline':
      return `polylinje${p.closed ? ' sluten' : ''} ${p.points.map(pt).join(' ')} [${pen(p.pen)}]${who}`;
    case 'arc':
      return `båge ${pt(p.center)} r${n(p.radius)} ${n((p.start * 180) / Math.PI)}°–${n((p.end * 180) / Math.PI)}° [${pen(p.pen)}]${who}`;
    case 'text':
      return `text "${p.text}" ${pt(p.at)} h${n(p.height)}${p.angle ? ` ${n((p.angle * 180) / Math.PI)}°` : ''}${p.align ? ` ${p.align}` : ''}${p.bold ? ' fet' : ''} [${pen(p.pen)}]${who}`;
    case 'region': {
      const fill = p.fill.kind === 'solid' ? `fylld ${p.fill.color ?? ''}` : p.fill.kind;
      return `yta ${fill} [${pen(p.outline)}] ${p.rings.map((r) => r.map(pt).join(' ')).join(' | ')}${who}`;
    }
    case 'image':
      return `bild ${p.source.asset} ${pt(p.corner)} ${pt(p.u)} ${pt(p.v)}${who}`;
  }
}

const drawing = (prims: readonly Primitive[]): string => `${prims.map(primLine).join('\n')}\n`;

/** 3D-formerna: vad, material och höjd, och formen i plan. */
function model(shapes: readonly Shape3D[]): string {
  return `${shapes
    .map((s) =>
      s.kind === 'edges'
        ? `kanter @${s.id} ${s.part ?? ''} ${s.segments.length}`
        : `form @${s.id} ${s.material} z${n(s.z0)}–${n(s.z1)}${s.top || s.bottom ? ' sned' : ''}${s.cuts ? ` urtag ${s.cuts.length}` : ''} ${s.rings.map((r) => r.map(pt).join(' ')).join(' | ')}`,
    )
    .join('\n')}\n`;
}

const file = (name: string) => `./referens/${name}.txt`;

function referenceSet(name: string, doc: ProjectDoc) {
  const storey = doc.storeys[0].id;
  const ex = doc.states.find((s) => s.kind === 'existing');
  const proposal = doc.states.find((s) => s.kind !== 'existing')!;
  const compare = { state: proposal.id, compareTo: ex?.id };
  const markers = Object.values(doc.elements)
    .filter((e) => e.type === 'Elevation' || e.type === 'Section')
    .map((e) => e.id)
    .sort();

  describe(name, () => {
    it('plan, förslaget jämfört med befintligt', async () => {
      await expect(drawing(buildPlan(doc, storey, compare).prims)).toMatchFileSnapshot(file(`${name}-plan`));
    });
    if (ex) {
      it('plan, befintligt', async () => {
        await expect(drawing(buildPlan(doc, storey, { state: ex.id }).prims)).toMatchFileSnapshot(file(`${name}-plan-befintligt`));
      });
    }
    for (const id of markers) {
      it(`${doc.elements[id].type === 'Section' ? 'sektion' : 'fasad'} ${id}`, async () => {
        await expect(drawing(buildSection(doc, id, compare)!.prims)).toMatchFileSnapshot(file(`${name}-${id}`));
      });
    }
    it('3D', async () => {
      await expect(model(buildModel3d(doc, storey, compare))).toMatchFileSnapshot(file(`${name}-3d`));
    });
  });
}

referenceSet('exempel', sampleProject());
referenceSet('rumsrutnat', roomGrid(3));

describe('blad', () => {
  it('A3 med plan i 1:100 och fasad i 1:50, med exempelmallbladet', async () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { number: 'A-40.1-101', name: 'Plan och fasad' });
    addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [150, 160]) });
    addViewport(store, id, { view: modelViewId('fasad-1'), scale: 50, at: centeredAt(store.doc, modelViewId('fasad-1'), 50, [300, 200]) });
    const d = buildSheet(store.doc, store.doc.sheets.find((s) => s.id === id)!, { today: '2026-10-20' });
    await expect(drawing(d.prims)).toMatchFileSnapshot(file('blad-a3'));
  });
});
