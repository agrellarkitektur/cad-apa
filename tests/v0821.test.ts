import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { sampleProject } from '../src/sample/sampleProject';
import { matchOption, type PromptOption } from '../src/ui/app/prompts';
import type { ToolHost } from '../src/ui/tools/host';
import { MarkerTool, RoofTool } from '../src/ui/tools/markerTools';
import { WallTool } from '../src/ui/tools/wallTool';
import { Draw2DTool } from '../src/ui/tools/draw2dTool';
import { parsePoint, resolvePoint } from '../src/ui/pointInput';

beforeAll(() => registerBuiltInTypes());

/** Det verktygen behöver för att ta emot skrivna punkter, utan webbläsare. */
function host(): ToolHost & { hints: string[] } {
  const store = new DocStore(sampleProject());
  const hints: string[] = [];
  return {
    store,
    hints,
    selection: { set: () => {} } as never,
    view: { requestRender: () => {}, camera: { scale: 1 }, drawingScale: 100 } as never,
    plan: () => ({ pickables: [] }) as never,
    activeState: () => store.doc.states[0].id,
    storey: () => store.doc.storeys[0].id,
    snapSegments: () => [],
    hint: (t: string) => hints.push(t),
  };
}

const count = (h: ToolHost, type: string) => Object.values(h.store.doc.elements).filter((e) => e.type === type).length;

describe('Alternativen i frågan (0.8.21)', () => {
  const opts: PromptOption[] = [
    { key: 'A', label: 'Avsluta', run: () => {} },
    { key: 'S', label: 'Stäng', run: () => {} },
    { key: 'Å', label: 'Ångra', run: () => {} },
    { key: 'ML', label: 'Mitt (lodrätt)', run: () => {} },
    { key: 'MV', label: 'Mitt (vågrätt)', run: () => {} },
  ];
  it('väljs med bokstaven, oavsett stor eller liten', () => {
    expect(matchOption(opts, 's')?.label).toBe('Stäng');
    expect(matchOption(opts, 'Å')?.label).toBe('Ångra');
    expect(matchOption(opts, 'ml')?.label).toBe('Mitt (lodrätt)');
  });
  it('eller med början av namnet, minst två tecken och bara om det är entydigt', () => {
    expect(matchOption(opts, 'avs')?.label).toBe('Avsluta');
    expect(matchOption(opts, 'stän')?.label).toBe('Stäng');
    expect(matchOption(opts, 'mitt')).toBeNull();
    expect(matchOption(opts, 'x')).toBeNull();
    expect(matchOption(opts, '')).toBeNull();
  });
});

describe('Väggen med Stäng och Ångra (0.8.21)', () => {
  it('Stäng ritar sista väggen till första punkten', () => {
    const h = host();
    const t = new WallTool(h, { definition: null, face: 'center', height: 2700 });
    const before = count(h, 'Wall');
    for (const p of [[50000, 0], [54000, 0], [54000, 3000], [50000, 3000]] as [number, number][]) t.takePoint(p);
    expect(count(h, 'Wall') - before).toBe(3);
    expect(t.canClose).toBe(true);
    t.close();
    expect(count(h, 'Wall') - before).toBe(4);
    expect(t.drawing).toBe(false);
  });

  it('Ångra tar bort den senaste väggen och fortsätter från punkten före', () => {
    const h = host();
    const t = new WallTool(h, { definition: null, face: 'center', height: 2700 });
    const before = count(h, 'Wall');
    t.takePoint([50000, 0]);
    t.takePoint([54000, 0]);
    t.takePoint([54000, 3000]);
    t.undoLast();
    expect(count(h, 'Wall') - before).toBe(1);
    expect(t.lastPoint()).toEqual([54000, 0]);
    t.undoLast();
    t.undoLast();
    expect(count(h, 'Wall')).toBe(before);
    expect(t.drawing).toBe(false);
  });
});

describe('2D-formen med Ångra (0.8.21)', () => {
  it('tar bort den senaste punkten och sluter med tre punkter', () => {
    const h = host();
    const t = new Draw2DTool(h);
    t.setKind('polyline');
    t.takePoint([0, 0]);
    t.takePoint([1000, 0]);
    t.takePoint([1000, 1000]);
    t.undoPoint();
    expect(t.count).toBe(2);
    expect(t.canClose).toBe(false);
    t.takePoint([0, 1000]);
    expect(t.canClose).toBe(true);
  });
});

describe('Skrivna punkter i tak, sektion och fasad (0.8.21)', () => {
  it('taket ritas med @ från första hörnet', () => {
    const h = host();
    const t = new RoofTool(h);
    const before = count(h, 'Roof');
    t.takePoint([50000, 0]);
    const r = resolvePoint(parsePoint('@9000,6000')!, t.lastPoint(), undefined);
    expect('p' in r && r.p).toEqual([59000, 6000]);
    if ('p' in r) t.takePoint(r.p);
    expect(count(h, 'Roof') - before).toBe(1);
  });

  it('ett för litet tak säger till i stället för att tyst låta bli', () => {
    const h = host();
    const t = new RoofTool(h);
    t.takePoint([0, 0]);
    t.takePoint([200, 5000]);
    expect(h.hints.at(-1)).toMatch(/500 mm/);
    expect(t.started).toBe(true);
  });

  it('sektionen tar början, slut och sidan som punkter, och Ångra går ett steg tillbaka', () => {
    const h = host();
    const t = new MarkerTool(h, 'Section');
    const before = count(h, 'Section');
    t.takePoint([0, 1500]);
    t.takePoint([6000, 1500]);
    expect(t.step).toBe(2);
    t.back();
    expect(t.step).toBe(1);
    t.takePoint([6000, 1500]);
    t.takePoint([3000, 5000]);
    expect(count(h, 'Section') - before).toBe(1);
    const s = Object.values(h.store.doc.elements).filter((e) => e.type === 'Section').at(-1)!;
    expect(s.params.side).toBe(1);
  });
});
