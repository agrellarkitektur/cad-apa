import { dropLeader } from './labelSection';
import { resetTags } from './litteraSection';
import { createDefinition, deleteDefinition, deleteElements, flipWalls, setInState, setSkewOk, updateParams } from '../core/commands';
import { copyElements, mirrorElements, rotateElements } from '../core/transforms';
import type { ViewStates } from '../core/states';
import type { DocStore } from '../core/store';
import { resolveParams, typeOf } from '../elements/registry';
import { rotateFurniture, type FurnitureParams } from '../elements/furniture';
import { faceChoices, faceOf, justificationFor, type WallFace } from '../elements/wallSides';
import { markerFrame } from '../elements/markers';
import { skewOf } from '../elements/angleCheck';
import { nextLittera } from './labels';
import type { Selection } from './selection';
import type { SheetFormHost } from './sheetForms';
import { PROPS } from './selectionFields';
import { patchEach, pick, selectionCenter, straighten } from './selectionEdits';

/**
 * Knapparna i egenskapspanelen, snabbraden och den utfällda smartmenyn
 * (granskningen efter 0.10.12, förut i `propertiesPanel.ts`). Fälten
 * ändras i `selectionEdits.ts`; 2D, taklutning, Visas i och Lås i
 * `drawingPanel.ts`, som får klicket först.
 */

/** Det knapparna lämnar till appen, som panelen förmedlar. */
export interface ActionPanel {
  /** Anropas när något kopierats, så att kopian kan flyttas. */
  onCopied?: (ids: string[], center: [number, number]) => void;
  /** Ta bort det markerade (snabbknappen), med meddelande om låsta (0.10.12). */
  onErase?: (ids: string[]) => void;
  /** Öppna en fasad eller sektion (knappen i panelen). */
  onOpenMarker?: (id: string) => void;
  /** Gränsen för varningen om nästan raka vinklar, grader (0 = av). */
  angleWarn: () => number;
  /** Rikta en sektions- eller fasadmarkör efter något man klickar på i planen. */
  onAlignMarker?: (id: string) => void;
  /** Fler ledare till det generella littrat (0.10.20.2): Littera-verktyget lägger till dem. */
  onAddLeader?: (id: string) => void;
  /** Kalibrera eller rikta ett underlag (0.8 del 2). */
  onUnderlayTool?: (id: string, mode: 'calibrate' | 'align') => void;
  /** Bildens egna proportioner igen (0.8.16). */
  onUnderlayProportions?: (id: string) => void;
  /** Det formulären för ritningsblad behöver av appen (0.8 del 3). */
  sheetHost?: SheetFormHost;
}

export interface ActionContext {
  panel: ActionPanel;
  store: DocStore;
  selection: Selection;
  getView: () => ViewStates;
  /** Panelens innehåll, där fältet för en ny egenskap står. */
  body: HTMLElement;
}

/** Utför knappen `b` (`data-action`) på det markerade. */
export function selectionAction({ panel, store, selection, getView, body }: ActionContext, b: HTMLElement): void {
  const doc = store.doc;
  const ids = selection.list();
  switch (b.dataset.action) {
    case 'ul-calibrate':
    case 'ul-align':
      if (ids[0]) panel.onUnderlayTool?.(ids[0], b.dataset.action === 'ul-calibrate' ? 'calibrate' : 'align');
      return;
    case 'ul-proportions':
      if (ids[0]) panel.onUnderlayProportions?.(ids[0]);
      return;
    case 'open-marker':
      if (ids[0]) panel.onOpenMarker?.(ids[0]);
      return;
    case 'open-stamp': {
      const stamp = doc.elements[ids[0]]?.params.stamp;
      if (typeof stamp === 'string') panel.sheetHost?.openMaster(stamp);
      return;
    }
    case 'straighten-angle': {
      const el = doc.elements[ids[0]];
      const w = el && skewOf(doc, el, panel.angleWarn(), true);
      if (el && w) straighten(store, el, w.nearest);
      return;
    }
    case 'skew-ok':
      setSkewOk(store, ids.slice(0, 1), true);
      return;
    case 'skew-warn':
      setSkewOk(store, ids.slice(0, 1), false);
      return;
    case 'align-marker':
      if (ids[0]) panel.onAlignMarker?.(ids[0]);
      return;
    case 'label-add':
      if (ids[0]) panel.onAddLeader?.(ids[0]);
      return;
    case 'label-drop':
      if (ids[0]) dropLeader(store, ids[0], Number(b.dataset.index));
      return;
    case 'tag-reset':
      resetTags(store, ids);
      return;
    case 'flip-side': {
      const el = doc.elements[ids[0]];
      if (!el) return;
      if (el.params.auto) {
        // Följer linjen byggnaden placeras den först där den ligger.
        const f = markerFrame(doc, el);
        updateParams(store, [el.id], { auto: false, start: [Math.round(f.start[0]), Math.round(f.start[1])], end: [Math.round(f.end[0]), Math.round(f.end[1])], side: -1 }, 'Vänd blickriktningen');
      } else updateParams(store, [el.id], { side: -Number(el.params.side ?? 1) }, 'Vänd blickriktningen');
      return;
    }
    case 'follow-building':
      updateParams(store, ids, { auto: true }, 'Följ byggnaden');
      return;
    case 'slab-hole-remove': {
      const el = doc.elements[ids[0]];
      const i = Number(b.dataset.index);
      const holes = (el?.params.holes as unknown[] | undefined) ?? [];
      if (el && holes[i]) updateParams(store, [el.id], { holes: holes.filter((_, k) => k !== i) }, 'Ta bort håltagning');
      return;
    }
    case 'roof-flip':
      // Referenslinjen vänds; bågen ligger kvar där den låg (0.10).
      patchEach(store, ids.filter((id) => doc.elements[id]?.type === 'Roof'), 'Vänd lutningen', (p) => {
        const ref = p.ref as [[number, number], [number, number]];
        const bulge = Number(p.refBulge ?? 0);
        return { ref: [ref[1], ref[0]], refBulge: bulge ? -bulge : undefined };
      });
      return;
    case 'select-roof':
      if (b.dataset.roof && doc.elements[b.dataset.roof]) selection.set([b.dataset.roof]);
      return;
    case 'toggle-state': {
      const s = b.dataset.state!;
      const allIn = ids.every((id) => doc.elements[id]?.states.includes(s));
      setInState(store, ids, s, !allIn);
      break;
    }
    case 'new-def': {
      const el = doc.elements[ids[0]];
      const t = typeOf(el.type)!;
      const p = resolveParams<Record<string, number>>(doc, el);
      const params = Object.fromEntries(t.typeParams!.map((k) => [k, Number(p[k] ?? 0)]));
      createDefinition(store, el.type, nextLittera(doc, el.type, t.litteraPrefix ?? 'T'), params, ids);
      break;
    }
    case 'add-def': {
      const t = typeOf(b.dataset.type!)!;
      createDefinition(store, t.type, nextLittera(doc, t.type, t.litteraPrefix ?? 'T'), pick(t.defaults() as Record<string, number>, t.typeParams!));
      break;
    }
    case 'delete-def':
      deleteDefinition(store, b.dataset.def!);
      break;
    case 'delete':
      if (panel.onErase) panel.onErase(ids);
      else {
        deleteElements(store, ids);
        selection.clear();
      }
      break;
    case 'justify': {
      const face = b.dataset.value as WallFace;
      patchEach(store, ids, 'Byt referenslinje', (_p, el) => ({ justification: justificationFor(doc, el, face) }));
      break;
    }
    case 'cycle-ref': {
      // Utsida → Center → Insida → Utsida (innerväggar: vänster → center → höger).
      patchEach(store, ids, 'Byt referenslinje', (_p, el) => {
        const choices = faceChoices(doc, el);
        const i = choices.findIndex((c) => c.face === faceOf(doc, el).face);
        return { justification: justificationFor(doc, el, choices[(i + 1) % choices.length].face) };
      });
      break;
    }
    case 'toggle-glazed': {
      const on = ids.every((id) => resolveParams<{ glazed?: boolean }>(doc, doc.elements[id]).glazed);
      patchEach(store, ids, on ? 'Ej glasad' : 'Glasad', () => ({ glazed: !on }));
      break;
    }
    case 'flip-swing':
      patchEach(store, ids, 'Vänd slag', (p) => ({ swing: -((p.swing as number | undefined) ?? 1) }));
      break;
    case 'flip-hinge':
      patchEach(store, ids, 'Byt hängning', (p) => ({ hinge: p.hinge === 'end' ? 'start' : 'end' }));
      break;
    case 'rotate-90':
      if (ids.length === 1 && doc.elements[ids[0]]?.type === 'Furniture') {
        patchEach(store, ids, 'Vrid 90°', (_p, el) => rotateFurniture(resolveParams<FurnitureParams>(doc, el), 90));
      } else rotateElements(store, ids, selectionCenter(doc, ids));
      break;
    case 'mirror':
      mirrorElements(store, ids, selectionCenter(doc, ids));
      break;
    case 'flip-wall':
      flipWalls(store, ids);
      break;
    case 'copy': {
      const copies = copyElements(store, ids);
      selection.set(copies);
      panel.onCopied?.(copies, selectionCenter(store.doc, copies));
      break;
    }
    case 'demolish':
      setInState(store, ids, getView().state, false);
      break;
    case 'restore':
      setInState(store, ids, getView().state, true);
      break;
    case 'deselect':
      selection.clear();
      break;
    case 'add-prop':
    case 'add-defprop': {
      // Fältet bredvid knappen, i panelen eller i den utfällda smartmenyn.
      const input =
        b.parentElement?.querySelector<HTMLInputElement>('input') ??
        body.querySelector<HTMLInputElement>(b.dataset.action === 'add-prop' ? '#new-prop' : '#new-defprop');
      const name = input?.value.trim();
      if (!name) break;
      const el = doc.elements[ids[0]];
      if (b.dataset.action === 'add-prop') {
        store.transact(`Ny egenskap: ${name}`, (tx) => tx.putElement({ ...el, props: { ...el.props, [PROPS]: { ...(el.props[PROPS] ?? {}), [name]: '' } } }));
      } else if (el.definition) {
        const def = doc.definitions[el.definition];
        store.transact(`Ny egenskap för ${def.name}: ${name}`, (tx) =>
          tx.putDefinition({ ...def, props: { ...def.props, [PROPS]: { ...(def.props[PROPS] ?? {}), [name]: '' } } }),
        );
      }
      break;
    }
  }
}
