import { defaultSheet } from '../src/core/viewCategories';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { normalizeMaterials } from '../src/core/graphics';
import { deleteMaterial, linkMaterial, setMaterialTexture } from '../src/core/materials';
import type { Asset } from '../src/core/model';
import { applySitePackage, parseSitePackage, removeSite } from '../src/core/siteImport';
import { orthoFromWorld, orthoUvMatrix, parseWorldFile, setSiteOrtho } from '../src/core/siteOrtho';
import { localToZone } from '../src/core/site';
import { pruneAssets } from '../src/core/commands';
import { registerBuiltInTypes } from '../src/elements';
import { groundType, type GroundParams } from '../src/elements/ground';
import { colorGroups, colorShapes } from '../src/repr/groundColors';
import { finishedForView, terrainMesh3d } from '../src/repr/terrain';
import { createContext } from '../src/repr/context';
import { parse, serialize } from '../src/storage/format';
import { fillPanel } from '../src/ui/fillPanel';
import { materialFieldChange } from '../src/ui/style/materials';
import { boxUv } from '../src/view3d/geometry3d';
import type { FillParams } from '../src/elements/drawing2d';
import { addGround, onSlope, slopeSite } from './projekt';

/**
 * Texturer i 3D och ortofotot på marken (0.10.31): materialets bild,
 * upprepad i verkliga mått, och ortofotot draperat på marken med läget ur
 * platspaketet eller en världsfil.
 */

beforeAll(() => registerBuiltInTypes());

const img = (id = 'tex-1'): Asset => ({ id, name: 'gräs.jpg', mime: 'image/jpeg', data: 'AAAA' });
/** Den sneda marken ligger på 1000–1100 × 5000–5080 med nollpunkten 1050, 5040. */
const orto = { bild: 'data:image/jpeg;base64,QUJD', x0: 1000.125, y1: 5079.875, s: 0.25, W: 400, H: 320, ar: 2023 };
/** Matrisen på en punkt i modellen (mm): bildens u och v. */
const uv = (q: number[], x: number, y: number) => [q[0] * x + q[1] * y + q[2], q[3] * x + q[4] * y + q[5]];

describe('Ortofotot (0.10.31)', () => {
  it('läser en världsfil och lägger bilden rätt, i zonens eller de lokala koordinaterna', () => {
    expect(parseWorldFile('0.25\n0\n0\n-0.25\n1000.125\n5079.875\n')).toEqual({ s: 0.25, x: 1000.125, y: 5079.875 });
    // Vriden bild och trasig fil.
    expect(parseWorldFile('0.25\n0.1\n0\n-0.25\n1000\n5080')).toBeNull();
    expect(parseWorldFile('hej')).toBeNull();
    const site = { origin: [1050, 5040] as [number, number], extent: { xmin: 1000, ymin: 5000, xmax: 1100, ymax: 5080 } };
    expect(orthoFromWorld({ s: 0.25, x: 1000.125, y: 5079.875 }, 400, 320, site)).toEqual({ x0: 1000, y1: 5080, s: 0.25, W: 400, H: 320 });
    // Höjdkurvors _lokal.jgw: meter från nollpunkten.
    expect(orthoFromWorld({ s: 0.25, x: -49.875, y: 39.875 }, 400, 320, site)).toEqual({ x0: 1000, y1: 5080, s: 0.25, W: 400, H: 320 });
  });

  it('avbildningen tar planens punkter till bildens hörn, också när modellen är vriden mot zonen', () => {
    const o = { x0: 1000, y1: 5080, s: 0.25, W: 400, H: 320 };
    for (const rotation of [0, 30]) {
      const site = { origin: [1050, 5040] as [number, number], rotation };
      const q = orthoUvMatrix(site, o);
      for (const [x, y] of [
        [0, 0],
        [12345, -6789],
      ]) {
        const [X, Y] = localToZone(site, x, y);
        const [u, v] = uv(q, x, y);
        expect(u).toBeCloseTo((X - 1000) / 100, 9);
        expect(v).toBeCloseTo((Y - 5000) / 80, 9);
      }
    }
  });

  it('följer med platspaketet, ligger kvar när platsen uppdateras utan det och tas bort med platsen', () => {
    const store = onSlope();
    applySitePackage(store, parseSitePackage(JSON.stringify(slopeSite({ ortofoto: orto }))));
    const o = store.doc.site!.ortho!;
    expect(o).toMatchObject({ x0: 1000, y1: 5080, s: 0.25, W: 400, H: 320, year: 2023 });
    expect(store.doc.assets[o.asset]).toMatchObject({ mime: 'image/jpeg', data: 'QUJD' });
    // Sparas i filen.
    expect(parse(serialize(store.doc)).site!.ortho).toEqual(o);
    // Samma plats utan ortofoto: det gamla ligger kvar, och det som visas i 3D behålls.
    setSiteOrtho(store, null);
    expect(store.doc.assets[o.asset]).toBeUndefined();
    store.undo();
    applySitePackage(store, slopeSite());
    expect(store.doc.site!.ortho!.asset).toBe(o.asset);
    // Ett nytt ortofoto ersätter det gamla.
    applySitePackage(store, slopeSite({ ortofoto: { ...orto, ar: 2024 } }));
    expect(store.doc.site!.ortho!.year).toBe(2024);
    expect(store.doc.assets[o.asset]).toBeUndefined();
    const now = store.doc.site!.ortho!.asset;
    // Inte bara en underlagsfil: pruneAssets låter det vara.
    store.transact('x', (tx) => pruneAssets(tx, [now]));
    expect(store.doc.assets[now]).toBeDefined();
    removeSite(store);
    expect(store.doc.assets[now]).toBeUndefined();
  });

  it('ett ortofoto som inte ligger över platsen eller är trasigt hoppas över', () => {
    const store = onSlope();
    applySitePackage(store, slopeSite({ ortofoto: { ...orto, x0: 9000 } }));
    expect(store.doc.site!.ortho).toBeUndefined();
    applySitePackage(store, slopeSite({ ortofoto: { ...orto, bild: 'http://exempel.se/bild.jpg' } }));
    expect(store.doc.site!.ortho).toBeUndefined();
  });
});

describe('Texturer i 3D (0.10.31)', () => {
  it('materialet får en bild som fil i projektet; en ny bild ersätter den gamla, och den tas bort med materialet', () => {
    const store = onSlope();
    setMaterialTexture(store, 'gras', img('tex-1'));
    const m = () => store.doc.graphics.materials!.find((q) => q.id === 'gras')!;
    expect(m().texture).toEqual({ asset: 'tex-1', size: 1000 });
    expect(store.doc.assets['tex-1']).toBeDefined();
    // Storleken behålls när bilden byts; den gamla bilden tas bort.
    store.transact('storlek', (tx) => tx.setGraphics({ ...tx.doc.graphics, materials: tx.doc.graphics.materials!.map((q) => (q.id === 'gras' ? { ...q, texture: { asset: 'tex-1', size: 2500 } } : q)) }));
    setMaterialTexture(store, 'gras', img('tex-2'));
    expect(m().texture).toEqual({ asset: 'tex-2', size: 2500 });
    expect(store.doc.assets['tex-1']).toBeUndefined();
    // Sparas och läses.
    expect(parse(serialize(store.doc)).graphics.materials!.find((q) => q.id === 'gras')!.texture).toEqual({ asset: 'tex-2', size: 2500 });
    expect(normalizeMaterials([{ id: 'a', plan: { fill: 'solid' }, texture: { asset: 'x', size: 0 } }])![0].texture).toBeUndefined();
    deleteMaterial(store, 'gras');
    expect(store.doc.assets['tex-2']).toBeUndefined();
    store.undo();
    expect(store.doc.assets['tex-2']).toBeDefined();
    setMaterialTexture(store, 'gras', null);
    expect(m().texture).toBeUndefined();
    expect(store.doc.assets['tex-2']).toBeUndefined();
  });

  it('markens trianglar med materialet får texturen, och stödmuren får den på kroppen', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'area', outline: [[20000, 0], [26000, 0], [26000, 4000], [20000, 4000]], height: 2000 } as GroundParams);
    linkMaterial(store, [a], 'asfalt');
    setMaterialTexture(store, 'asfalt', img());
    const view = { state: 'st-a' };
    const mesh = terrainMesh3d(store.doc, view, finishedForView(store.doc, view))!;
    const c = colorGroups(mesh, colorShapes(store.doc, view))!;
    const g = c.groups.find((q) => q.texture)!;
    expect(g).toMatchObject({ color: '#8f8e8a', texture: { asset: 'tex-1', size: 1000 } });
    expect(g.count).toBeGreaterThan(0);
    const w = addGround(store, { kind: 'wall', outline: [], line: [[20000, -2000], [26000, -2000]], height: 3000, width: 300 } as GroundParams);
    linkMaterial(store, [w], 'asfalt');
    const ctx = createContext(store.doc, 'platsen', { state: 'st-a' }, defaultSheet(store.doc.graphics), () => true).ctx;
    const solids = groundType.model3d!(store.doc.elements[w] as never, ctx).filter((s) => s.kind !== 'edges');
    expect(solids.every((s) => (s as { texture?: unknown }).texture)).toBe(true);
  });

  it('panelen och stilmallen har bild och bildens sida', () => {
    const store = onSlope();
    setMaterialTexture(store, 'gras', img());
    const m = store.doc.graphics.materials!.find((q) => q.id === 'gras')!;
    const html = fillPanel('x', { fill: 'solid', material: 'gras' } as FillParams, (k) => `data-key="d2:${k}"`, store.doc.graphics);
    expect(html).toContain('material-texture-remove');
    expect(html).toContain('d2:matTextureSize');
    const change = materialFieldChange(store.doc.graphics, { dataset: { material: 'gras:tsize' }, value: '300' } as unknown as HTMLInputElement)!;
    expect(change.fn(m).texture).toEqual({ asset: 'tex-1', size: 300 });
  });

  it('texturens koordinater följer en vägg i vilken riktning som helst, i mm', () => {
    // En stående yta snett i plan: 1 m lång, 1 m hög.
    const d = Math.SQRT1_2 * 1000;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, d, d, 0, d, d, 1000], 3));
    const u = boxUv(geom).getAttribute('uv');
    expect(Math.abs(u.getX(1) - u.getX(0))).toBeCloseTo(1000, 3);
    expect(u.getY(2) - u.getY(1)).toBeCloseTo(1000, 3);
  });
});
