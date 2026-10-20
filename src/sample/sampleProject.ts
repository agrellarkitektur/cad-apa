import { SWEDISH_STANDARD } from '../core/graphics';
import { exampleMaster } from '../core/exampleMaster';
import { drawingMarkers, emptyTree, FORMAT, FORMAT_VERSION, type ViewDef, type Definition, type Element, type Id, type ProjectDoc } from '../core/model';
import type { DoorParams } from '../elements/door';
import type { FurnitureParams } from '../elements/furniture';
import type { RoofParams } from '../elements/roof';
import type { SpaceParams } from '../elements/space';
import type { WallParams } from '../elements/wall';
import type { WindowParams } from '../elements/window';
import { orientExteriorWalls } from '../elements/orient';

/**
 * Exempelprojekt: ombyggnad av en villa med två förslag.
 *
 * - Förslag A flyttar väggen mellan sovrum 2 och badet, så att badet blir större.
 * - Förslag B behåller väggarna men gör om dörrarna: badet nås från sovrum 2,
 *   och sovrummen får en dörr mellan sig.
 */

const BEF = 'st-bef';
const A = 'st-a';
const B = 'st-b';
const ALL = [BEF, A, B];
const STOREY = 'pl-1';

const definitions: Record<Id, Definition> = {};
const elements: Record<Id, Element> = {};

function type(id: Id, elementType: string, name: string, params: Record<string, number>, description?: string): void {
  definitions[id] = { id, origin: 'component', name, elementType, params, props: {}, description };
}

// Typer med littera. Tjocklek och mått hör till typen och delas av alla av samma littera.
type('t-yv01', 'Wall', 'YV01', { thickness: 400 }, 'Yttervägg, puts på lättbetong');
type('t-iv01', 'Wall', 'IV01', { thickness: 120 }, 'Lätt innervägg, 70 regel + 2 × gips');
type('t-d1', 'Door', 'D1', { width: 900, height: 2100 }, 'Innerdörr M9×21');
type('t-d2', 'Door', 'D2', { width: 1000, height: 2100 }, 'Entrédörr M10×21');
type('t-d3', 'Door', 'D3', { width: 800, height: 2100 }, 'Badrumsdörr M8×21');
type('t-f1', 'Window', 'F1', { width: 1200, height: 1200 });
type('t-f2', 'Window', 'F2', { width: 600, height: 600 });
type('t-f3', 'Window', 'F3', { width: 1500, height: 1200 });
type('t-f4', 'Window', 'F4', { width: 2400, height: 1200 });

function add<P extends object>(id: Id, t: string, params: P, extra: Partial<Element> = {}): void {
  elements[id] = { id, type: t, storey: STOREY, states: ALL, tags: [], params, props: {}, ...extra } as Element;
}

const wall = (id: Id, def: Id, start: [number, number], end: [number, number], states = ALL) =>
  add<Omit<WallParams, 'thickness'>>(id, 'Wall', { start, end, height: 2700, justification: 'center' }, { definition: def, states });

const door = (id: Id, def: Id, host: Id, at: number, swing: 1 | -1, states = ALL, glazed = false) =>
  add<Pick<DoorParams, 'at' | 'swing' | 'hinge' | 'glazed'>>(
    id,
    'Door',
    { at, swing, hinge: 'start', glazed },
    { definition: def, host, states, props: { Dörr: { öppningssätt: 'Slagdörr', brandklass: '', ljudklass: '' } } },
  );

const win = (id: Id, def: Id, host: Id, at: number) =>
  add<Pick<WindowParams, 'at' | 'sill'>>(id, 'Window', { at, sill: 900 }, { definition: def, host });

const furn = (id: Id, name: string, symbol: FurnitureParams['symbol'], x: number, y: number, w: number, d: number, rotation = 0) =>
  add<FurnitureParams>(id, 'Furniture', { origin: [x, y], rotation, width: w, depth: d, symbol }, { name });

const room = (id: Id, name: string, x0: number, y0: number, x1: number, y1: number, states = ALL) =>
  add<SpaceParams>(
    id,
    'Space',
    {
      outline: [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      seed: [Math.round((x0 + x1) / 2), Math.round((y0 + y1) / 2)],
    },
    { name, states },
  );

// Ytterväggar, ritade längs mittlinjen. Hörnen geras automatiskt.
wall('yv-s', 't-yv01', [200, 200], [11800, 200]);
wall('yv-o', 't-yv01', [11800, 200], [11800, 7800]);
wall('yv-n', 't-yv01', [11800, 7800], [200, 7800]);
wall('yv-v', 't-yv01', [200, 7800], [200, 200]);
// Gavlarna går upp till taket.
for (const id of ['yv-o', 'yv-v']) elements[id].params.toRoof = true;

// Innerväggar som slutar mot ytterväggarnas insida (T-skarvar).
wall('iv-1', 't-iv01', [5000, 400], [5000, 7600]);
wall('iv-2', 't-iv01', [5000, 4000], [11600, 4000]);
wall('iv-3', 't-iv01', [8500, 400], [8500, 4000], [BEF, B]);
wall('iv-4', 't-iv01', [7300, 400], [7300, 4000], [A]);

// Dörrar. Läget anges längs väggen från dess startpunkt.
door('d01', 't-d2', 'yv-s', 2300, 1);
door('d02', 't-d1', 'iv-1', 2600, -1);
door('d03', 't-d1', 'iv-1', 5400, -1);
door('d04', 't-d1', 'iv-2', 5100, -1, [BEF, A]);
door('d05', 't-d1', 'iv-2', 1500, 1, [B], true);
door('d06', 't-d3', 'iv-3', 2600, -1, [B]);

// Fönster.
win('f01', 't-f1', 'yv-s', 6550);
win('f02', 't-f2', 'yv-s', 9900);
win('f03', 't-f1', 'yv-o', 5600);
win('f04', 't-f3', 'yv-n', 3500);
win('f05', 't-f4', 'yv-n', 9100);
win('f06', 't-f1', 'yv-v', 4800);

// Inredning.
furn('m01', 'Köksbänk', 'counter', 400, 7000, 3000, 600);
furn('m02', 'Diskbänk', 'sink', 2300, 7100, 500, 400);
furn('m03', 'Matbord', 'table', 2220, 4400, 900, 1600);
furn('m04', 'Soffa', 'sofa', 1300, 1300, 2200, 900, 90);
furn('m05', 'Dubbelsäng', 'bed', 9800, 5600, 1600, 2000);
furn('m06', 'Säng', 'bed', 5960, 2400, 900, 2000, 180);
furn('m07', 'Dusch', 'shower', 10700, 3040, 900, 900);
furn('m08', 'Tvättställ', 'sink', 11600, 1800, 600, 450, 90);

// Rum. Förslag A har egna rum där väggen flyttats.
room('r01', 'Allrum', 400, 400, 4940, 7600);
room('r02', 'Sovrum 1', 5060, 4060, 11600, 7600);
room('r03', 'Sovrum 2', 5060, 400, 8440, 3940, [BEF, B]);
room('r04', 'Bad', 8560, 400, 11600, 3940, [BEF, B]);
room('r05', 'Sovrum 2', 5060, 400, 7240, 3940, [A]);
room('r06', 'Bad', 7360, 400, 11600, 3940, [A]);

// Sadeltak med nock i öst–västlig riktning och 500 mm utsprång. Undersidan
// når väggarnas överkant (2700) vid ytterlivet.
add<RoofParams>('tak', 'Roof', {
  outline: [
    [-500, -500],
    [12500, -500],
    [12500, 8500],
    [-500, 8500],
  ],
  kind: 'gable',
  slope: 27,
  eave: 2450,
  thickness: 300,
  ridge: 0,
});

// Norrpil, fyra fasader runt huset och en sektion tvärs nocken, mot väster.
Object.assign(elements, drawingMarkers(STOREY, [14800, 7400]));
elements['sektion-a'] = {
  ...elements['sektion-a'],
  params: { start: [6500, -1800], end: [6500, 9800], side: 1, depth: null, auto: false, label: 'A' },
};

const views: ViewDef[] = [
  { id: 'vy-bef', name: 'Plan 1 – Befintligt', storey: STOREY, state: BEF, compare: false, detail: 'normal', hide: [], hideDemolished: false },
  { id: 'vy-a', name: 'Plan 1 – Förslag A, jämförelse', storey: STOREY, state: A, compare: true, detail: 'normal', hide: [], hideDemolished: false },
  { id: 'vy-a-bl', name: 'Plan 1 – Förslag A, bygglov', storey: STOREY, state: A, compare: true, detail: 'normal', hide: ['Dimension'], hideDemolished: true },
  { id: 'vy-b-bh', name: 'Plan 1 – Förslag B, bygghandling', storey: STOREY, state: B, compare: true, detail: 'detail', hide: [], hideDemolished: false },
  { id: 'vy-skiss', name: 'Plan 1 – Skiss', storey: STOREY, state: A, compare: false, detail: 'sketch', hide: ['Furniture'], hideDemolished: false, style: 'Poché' },
];

export function sampleProject(): ProjectDoc {
  const master = exampleMaster(STOREY, [BEF, A, B]);
  // Ytterväggarna är ritade moturs ovan; de vänds så att insidan vetter in.
  return orientExteriorWalls(structuredClone({
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    project: { name: 'Exempelvilla', kind: 'ombyggnad', fields: { adress: 'Exempelgatan 1' }, master: master.worksheet.id },
    states: [
      { id: BEF, name: 'Befintligt', kind: 'existing' },
      { id: A, name: 'Förslag A', kind: 'proposal' },
      { id: B, name: 'Förslag B', kind: 'proposal' },
    ],
    storeys: [{ id: STOREY, name: 'Plan 1', elevation: 0, height: 2700 }],
    definitions,
    elements: { ...elements, ...master.elements },
    graphics: SWEDISH_STANDARD,
    views,
    ...emptyTree(),
    worksheets: [master.worksheet],
    // Vyerna i mappar, som exempel på projektträdets mappar (0.8).
    folders: [
      { id: 'mapp-forslag', name: 'Förslag', tab: 'vyer', parent: null },
      { id: 'mapp-handlingar', name: 'Handlingar', tab: 'vyer', parent: 'mapp-forslag' },
    ],
    tree: { 'vy-a-bl': 'mapp-handlingar', 'vy-b-bh': 'mapp-handlingar', 'vy-a': 'mapp-forslag', 'vy-skiss': 'mapp-forslag' },
  }));
}
