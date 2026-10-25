import { describe, expect, it } from 'vitest';
import { COMMANDS, aliasText, commandFor, complete, findCommand } from '../src/ui/commandRegistry';
import { RAIL_ITEMS } from '../src/ui/modify/ops';
import { TOOLS } from '../src/ui/app/shell';
import { SHAPE_LABELS } from '../src/elements/drawing2d';
import { looksLikePoint, parsePoint, resolvePoint } from '../src/ui/pointInput';

describe('Kommandoregistret (0.8.20)', () => {
  it('har varje namn bara en gång, i gemener utan mellanslag', () => {
    const seen = new Map<string, string>();
    for (const c of COMMANDS)
      for (const n of [...c.sv, ...c.en]) {
        expect(n, `${c.id}: ${n}`).toBe(n.toLowerCase().replace(/\s/g, ''));
        expect(seen.get(n), `${n} används av både ${seen.get(n)} och ${c.id}`).toBeUndefined();
        seen.set(n, c.id);
      }
    expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length);
  });

  it('täcker alla verktyg, alla sätt att rita en 2D-form och hela Modifiera-raden', () => {
    for (const t of TOOLS.filter((t) => !t.comesIn)) expect(commandFor({ tool: t.id as never }), t.id).toBeTruthy();
    for (const k of Object.keys(SHAPE_LABELS)) expect(commandFor({ shape: k as never }), k).toBeTruthy();
    for (const r of RAIL_ITEMS) expect(commandFor({ rail: r.id }), r.id).toBeTruthy();
  });

  it('känner AutoCADs förkortningar och de svenska namnen', () => {
    // L, LINE, PL och PLINE är polylinjen, som heter Linje, sedan 0.8.22.
    for (const n of ['L', 'line', 'linje', 'pl', 'PLINE', 'polyline', 'polylinje']) expect(findCommand(n)?.shape, n).toBe('polyline');
    expect(commandFor({ shape: 'polyline' })?.label).toBe('Linje');
    expect(SHAPE_LABELS.polyline).toBe('Linje');
    expect(findCommand('REC')?.id).toBe('rect');
    expect(findCommand('c')?.id).toBe('circle');
    expect(findCommand('M')?.id).toBe('move');
    expect(findCommand('co')?.id).toBe('multiply');
    expect(findCommand('TR')?.id).toBe('trim');
    expect(findCommand('o')?.id).toBe('offset');
    expect(findCommand('E')?.id).toBe('erase');
    expect(findCommand('u')?.id).toBe('undo');
    expect(findCommand('Z')?.id).toBe('zoom-box');
    expect(findCommand('vägg')?.id).toBe('wall');
    expect(findCommand('Rektangel')?.id).toBe('rect');
    expect(findCommand('ta bort')?.id).toBe('erase');
    expect(findCommand('flytta')?.id).toBe('move');
    expect(findCommand('xyz')).toBeUndefined();
  });

  it('kompletterar: exakt först, sedan det som börjar så, kortast först', () => {
    expect(complete('l')[0].cmd.id).toBe('polyline');
    expect(complete('l')[0].exact).toBe(true);
    const r = complete('rek');
    expect(r[0].cmd.id).toBe('rect');
    expect(complete('fön')[0].cmd.id).toBe('window');
    expect(complete('polyl')[0].cmd.id).toBe('polyline');
    // Etiketten räknas också: "Kopiera i rad".
    expect(complete('irad').map((m) => m.cmd.id)).toContain('multiply');
    expect(complete('')).toEqual([]);
  });

  it('visar korta förkortningar på knapparna', () => {
    expect(aliasText(commandFor({ shape: 'polyline' })!)).toBe('L, LI, PL, LINE');
    expect(aliasText(commandFor({ tool: 'wall' })!)).toBe('WA, VG, WALL, VÄGG');
  });
});

describe('Skrivna punkter (0.8.20)', () => {
  const last: [number, number] = [1000, 2000];
  const at = (text: string, cursor?: [number, number], lock: number | null = null) => {
    const e = parsePoint(text);
    if (!e) return null;
    const r = resolvePoint(e, last, cursor, lock);
    return 'p' in r ? r.p.map((v) => Math.round(v * 1000) / 1000) : r.error;
  };

  it('läser avstånd, relativa, polära och absoluta punkter', () => {
    expect(at('2400', [5000, 2000])).toEqual([3400, 2000]);
    expect(at('@1200,600')).toEqual([2200, 2600]);
    expect(at('@3000<90')).toEqual([1000, 5000]);
    expect(at('@1000<45')).toEqual([1707.107, 2707.107]);
    expect(at('1200,600')).toEqual([1200, 600]);
    expect(at('#-500,250')).toEqual([-500, 250]);
    expect(at('1200,5;600')).toEqual([1200.5, 600]);
    expect(at('2,4m', [1000, 0])).toEqual([1000, -400]);
    expect(at('@1,2m;0')).toEqual([2200, 2000]);
    expect(at('1200+300', [1000, 9000])).toEqual([1000, 3500]);
    expect(at('1000', undefined, 180)).toEqual([0, 2000]);
  });

  it('låser vinkeln med <, och säger till när avståndet saknar riktning', () => {
    expect(parsePoint('<45')).toEqual({ kind: 'angle', deg: 45 });
    expect(at('2400')).toBe('Peka först åt det håll avståndet ska gå.');
    const e = parsePoint('2400')!;
    expect('error' in resolvePoint(e, undefined, [0, 0])).toBe(true);
    expect(parsePoint('@abc')).toBeNull();
    expect(parsePoint('@1200')).toBeNull();
  });

  it('skiljer punkter från kommandon', () => {
    for (const t of ['2400', '@1,2', '#0,0', '<45', '.5', '-100,0']) expect(looksLikePoint(t), t).toBe(true);
    for (const t of ['l', 'vägg', 'rec', '3d']) expect(looksLikePoint(t), t).toBe(t === '3d');
  });
});
