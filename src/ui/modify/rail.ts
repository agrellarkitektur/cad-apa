import type { IconName } from '../icons';
import type { OpId } from './opDefs';

/*
 * Modifiera-radens knappar (0.8.5): ett verb per knapp, som kan vara flera
 * val. Vilka som tänds för det markerade räknas i ops.ts (`railFor`).
 * (Utbrutet ur ops.ts i granskningen efter 0.10.18.)
 */

/** En knapp i Modifiera-raden: ett verb, som kan vara flera val (för vägg, tak och 2D). */
export type RailId =
  | 'move'
  | 'rotate'
  | 'mirror'
  | 'multiply'
  | 'offset'
  | 'parallel'
  | 'offsetAll'
  | 'wallOn'
  | 'stretch'
  | 'extend'
  | 'insert'
  | 'pointMove'
  | 'remove'
  | 'curve'
  | 'tangent'
  | 'straighten'
  | 'fillet'
  | 'chamfer'
  | 'trim'
  | 'join'
  | 'split'
  | 'fuse'
  | 'align'
  | 'pick'
  | 'scale';

export interface RailDef {
  id: RailId;
  label: string;
  icon: IconName;
  ops: OpId[];
  /** Vad man ska klicka på när verktyget behöver en ände, ett hörn eller en kant. */
  ask?: string;
  /** Kortkommandot: Shift och bokstaven (0.8.13). */
  key: string;
}

/** Modifiera-radens knappar i grupper, i den ordning de visas. */
export const RAIL: RailDef[][] = [
  [
    // En håltagning man klickat på flyttas, vrids och speglas för sig (0.10.17).
    { id: 'move', label: 'Flytta', icon: 'move', ops: ['holeMove', 'move'], key: 'M' },
    { id: 'rotate', label: 'Vrid', icon: 'rotate', ops: ['holeRotate', 'rotate'], key: 'R' },
    { id: 'mirror', label: 'Spegla', icon: 'mirror', ops: ['holeMirror', 'mirror'], key: 'S' },
    { id: 'multiply', label: 'Kopiera i rad', icon: 'multiply', ops: ['multiply'], key: 'U' },
  ],
  [
    { id: 'offset', label: 'Förskjut', icon: 'offset', ops: ['offset', 'shapeOffset'], ask: 'Klicka på referenslinjen eller kanten som ska förskjutas.', key: 'O' },
    { id: 'parallel', label: 'Parallell kopia', icon: 'parallelCopy', ops: ['parallel'], ask: 'Klicka på referenslinjen för väggen som ska kopieras.', key: 'P' },
    { id: 'offsetAll', label: 'Förskjut alla kanter', icon: 'offsetAll', ops: ['offsetAll'], key: 'A' },
  ],
  [
    { id: 'wallOn', label: 'Ny vägg härifrån', icon: 'wall', ops: ['wallOn'], ask: 'Klicka på änden där den nya väggen ska börja.', key: 'W' },
    { id: 'stretch', label: 'Sträck', icon: 'stretch', ops: ['stretch'], ask: 'Klicka på änden som ska sträckas.', key: 'E' },
    { id: 'extend', label: 'Förläng till', icon: 'extend', ops: ['extend', 'extendAll'], ask: 'Klicka på änden som ska förlängas.', key: 'X' },
    { id: 'trim', label: 'Trimma', icon: 'trim', ops: ['trim', 'trimAll'], key: 'T' },
    { id: 'join', label: 'Hörnskarv', icon: 'cornerJoin', ops: ['join'], key: 'J' },
    { id: 'fuse', label: 'Foga ihop', icon: 'fuse', ops: ['shapeFuse'], key: 'V' },
  ],
  [
    { id: 'insert', label: 'Lägg till punkt', icon: 'insertNode', ops: ['insert', 'shapeInsert'], ask: 'Klicka på referenslinjen eller kanten där punkten ska läggas till.', key: 'I' },
    { id: 'pointMove', label: 'Flytta punkt', icon: 'movePoint', ops: ['shapeMove'], ask: 'Klicka på punkten som ska flyttas.', key: 'K' },
    { id: 'remove', label: 'Ta bort punkt', icon: 'merge', ops: ['merge', 'shapeRemove'], ask: 'Klicka på hörnet eller punkten som ska tas bort.', key: 'Q' },
    { id: 'split', label: 'Dela', icon: 'split', ops: ['split'], key: 'D' },
  ],
  [
    { id: 'curve', label: 'Böj', icon: 'curveEdge', ops: ['curve', 'shapeBend'], ask: 'Klicka på referenslinjen eller kanten som ska böjas.', key: 'B' },
    { id: 'tangent', label: 'Båge med tangent', icon: 'tangentArc', ops: ['tangent'], ask: 'Klicka på referenslinjen för väggen som ska bli en båge.', key: 'G' },
    { id: 'straighten', label: 'Räta ut', icon: 'straighten', ops: ['straighten', 'shapeStraighten'], ask: 'Klicka på referenslinjen eller kanten för bågen som ska rätas ut.', key: 'L' },
  ],
  [
    { id: 'fillet', label: 'Avrunda hörn', icon: 'fillet', ops: ['fillet', 'filletAll', 'shapeFillet'], ask: 'Klicka på hörnet som ska avrundas.', key: 'F' },
    { id: 'chamfer', label: 'Fasa hörn', icon: 'chamfer', ops: ['chamfer', 'chamferAll', 'shapeChamfer'], ask: 'Klicka på hörnet som ska fasas.', key: 'C' },
  ],
  [
    { id: 'align', label: 'Justera och fördela', icon: 'align', ops: ['align'], key: 'N' },
    { id: 'pick', label: 'Hämta och överför', icon: 'eyedropper', ops: ['pick'], key: 'H' },
    { id: 'scale', label: 'Skala', icon: 'scale', ops: ['scale'], key: 'Y' },
  ],
];

export const RAIL_ITEMS: RailDef[] = RAIL.flat();

/** Knappen i raden som ett val hör till. */
export function railOf(op: OpId): RailDef | undefined {
  return RAIL_ITEMS.find((r) => r.ops.includes(op));
}
