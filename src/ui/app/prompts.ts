import { isLineMode, type GroundMode } from '../tools/groundTool';
import type { RoofMode } from '../tools/roofTool';
import type { SlabShape } from '../tools/slabTool';
import { commandFor, type CommandDef } from '../commandRegistry';
import { ALIGN_BUTTONS, ArrangeTool } from '../modify/arrangeTool';
import { OPS, RAIL_ITEMS } from '../modify/ops';
import { ModifyTool } from '../modify/tool';
import type { AppContext } from './context';

/** Ett alternativ i hakparentesen: skrivs med `key` (eller början av namnet) eller klickas. */
export interface PromptOption {
  key: string;
  label: string;
  run: () => void;
  /** Valt nu (t.ex. sadeltak), visas intryckt. */
  on?: boolean;
}

/** Vad kommandot som pågår frågar efter, som i AutoCAD: `Vägg: Klicka nästa punkt [Avsluta/Stäng/Ångra]`. */
export interface Prompt {
  head: string;
  text: string;
  options: PromptOption[];
}

/**
 * Frågan i smartshell (0.8.21) för läget just nu: verktyget, Modifiera, eller
 * ett kommando som väntar på att något markeras (`pending`). Null när inget
 * pågår och inget verktyg utom Markera är valt.
 */
export function currentPrompt(app: AppContext, pending: CommandDef | null, runPending: () => void): Prompt | null {
  const redraw = () => {
    app.toolOpts.renderToolOptions();
    app.view.requestRender();
  };
  if (pending)
    return {
      head: pending.label,
      text: pending.action === 'erase' ? 'Markera det som ska tas bort och tryck Enter.' : 'Markera det som ska ändras och tryck Enter.',
      options: [{ key: 'K', label: 'Klar', run: runPending }],
    };
  const m = app.modifier;
  if (m.picking) {
    const def = RAIL_ITEMS.find((r) => r.id === m.picking);
    return { head: def?.label ?? 'Ändra', text: def?.ask ?? 'Klicka i ritningen.', options: [] };
  }
  if (m.active && m.active !== 'wallOn') {
    const def = OPS[m.active];
    const t = m.runningTool;
    const options: PromptOption[] = [];
    if (t instanceof ModifyTool && t.hasBase && t.takesPoints && ['move', 'rotate', 'mirror', 'multiply'].includes(m.active))
      options.push({ key: 'B', label: 'Baspunkt', run: () => t.repickBase() });
    if (t instanceof ArrangeTool && m.active === 'align')
      for (const [i, b] of ALIGN_BUTTONS.entries()) options.push({ key: ALIGN_KEYS[i], label: b.label, run: () => t.alignBy(b.kind) });
    return { head: def.label, text: t?.prompt() ?? def.hint, options };
  }
  if (app.aligning) return { head: 'Rikta', text: 'Klicka på en vägg eller linje att rikta efter. Shift: vinkelrätt.', options: [] };
  if (app.zoomingBox) return { head: 'Zooma', text: 'Dra en ruta runt det som ska synas.', options: [] };
  const tool = app.ui.tool;
  const head = tool === 'draw2d' ? (commandFor({ shape: app.draw2dTool.options.kind })?.label ?? '2D-form') : (commandFor({ tool })?.label ?? '');
  switch (tool) {
    case 'wall': {
      const w = app.wallTool;
      const options: PromptOption[] = [];
      if (w.drawing) {
        options.push({ key: 'A', label: 'Avsluta', run: () => w.finish() });
        if (w.canClose) options.push({ key: 'S', label: 'Stäng', run: () => w.close() });
        options.push({ key: 'Å', label: 'Ångra', run: () => w.undoLast() });
      }
      return { head, text: w.hintText(), options };
    }
    case 'draw2d': {
      const d = app.draw2dTool;
      const options: PromptOption[] = [];
      if (d.open && d.count >= 2) options.push({ key: 'A', label: 'Avsluta', run: () => d.finish(false) });
      if (d.canClose) options.push({ key: 'S', label: 'Stäng', run: () => d.finish(true) });
      if (d.count) options.push({ key: 'Å', label: 'Ångra', run: () => d.undoPoint() });
      return { head, text: d.hintText(), options };
    }
    case 'dimension': {
      const d = app.dimensionTool;
      const options: PromptOption[] = [];
      if (d.count >= 2 && !d.isPlacing) options.push({ key: 'K', label: 'Klar', run: () => d.donePoints() });
      if (d.count) options.push({ key: 'Å', label: 'Ångra', run: () => d.undoPoint() });
      return { head, text: d.hintText(), options };
    }
    case 'roof': {
      const r = app.roofTool;
      const mode = (m: RoofMode) => () => {
        r.options.mode = m;
        r.reset();
        redraw();
      };
      const options: PromptOption[] = [
        { key: 'T', label: 'Takfall', run: mode('face'), on: r.options.mode === 'face' },
        { key: 'P', label: 'Pulpet', run: mode('shed'), on: r.options.mode === 'shed' },
        { key: 'S', label: 'Sadel', run: mode('gable'), on: r.options.mode === 'gable' },
        { key: 'V', label: 'Valm', run: mode('hip'), on: r.options.mode === 'hip' },
      ];
      if (!r.started) options.push({ key: 'H', label: 'Över hela huset', run: () => app.roofOverHouse() });
      // Bågar i konturen direkt (0.10.17).
      if (r.options.mode === 'face' && r.step === 'contour')
        options.push({
          key: 'G',
          label: 'Båge',
          run: () => {
            r.setArc(!r.arc);
            redraw();
          },
          on: r.arc,
        });
      if (r.canClose) options.push({ key: 'A', label: 'Avsluta', run: () => r.closeContour() });
      if (r.started) options.push({ key: 'Å', label: 'Ångra', run: () => r.undoPoint() });
      return { head, text: r.hintText(), options };
    }
    case 'slab': {
      const r = app.slabTool;
      const mode = (m: 'slab' | 'hole') => () => {
        r.options.mode = m;
        r.reset();
        redraw();
      };
      const options: PromptOption[] = [
        { key: 'B', label: 'Bjälklag', run: mode('slab'), on: r.options.mode === 'slab' },
        { key: 'H', label: 'Håltagning', run: mode('hole'), on: r.options.mode === 'hole' },
      ];
      // Formen (0.10.17): rektangel, polygon, och cirkel för håltagningar.
      const shape = (f: SlabShape) => () => {
        r.options.shape = f;
        r.reset();
        redraw();
      };
      options.push({ key: 'R', label: 'Rektangel', run: shape('rect'), on: r.shape === 'rect' }, { key: 'P', label: 'Polygon', run: shape('polygon'), on: r.shape === 'polygon' });
      if (r.options.mode === 'hole') options.push({ key: 'C', label: 'Cirkel', run: shape('circle'), on: r.shape === 'circle' });
      if (r.shape === 'polygon')
        options.push({
          key: 'G',
          label: 'Båge',
          run: () => {
            r.setArc(!r.arc);
            redraw();
          },
          on: r.arc,
        });
      if (r.canClose) options.push({ key: 'K', label: 'Klar', run: () => r.closePolygon() });
      if (!r.started && r.options.mode === 'slab') options.push({ key: 'V', label: 'Ur väggarna', run: () => app.slabFromWalls() });
      if (r.started) options.push({ key: 'Å', label: 'Ångra', run: () => r.undoPoint() });
      return { head, text: r.hintText(), options };
    }
    case 'railing': {
      const r = app.railingTool;
      const options: PromptOption[] = [{ key: 'L', label: r.options.mode === 'edge' ? 'Ritat' : 'Längs kant', run: () => r.setMode(r.options.mode === 'edge' ? 'drawn' : 'edge') }];
      if (r.options.mode === 'drawn') {
        options.push({ key: 'G', label: 'Båge', run: () => { r.setArc(!r.arc); redraw(); }, on: r.arc });
        if (r.chain.count >= 2) options.push({ key: 'K', label: 'Klar', run: () => r.finish() });
        if (r.started) options.push({ key: 'Å', label: 'Ångra', run: () => r.undoPoint() });
      }
      return { head, text: r.hintText(), options };
    }
    case 'stair': {
      const r = app.stairTool;
      const spiral = r.options.form === 'spiral';
      const form: PromptOption = { key: 'S', label: spiral ? 'Linje' : 'Spiral', run: () => r.setForm(spiral ? 'line' : 'spiral') };
      if (spiral) {
        const options: PromptOption[] = [form];
        if (r.started) options.push({ key: 'Å', label: 'Ångra', run: () => r.undoPoint() });
        return { head, text: r.hintText(), options };
      }
      const options: PromptOption[] = [
        form,
        {
          key: 'G',
          label: 'Båge',
          run: () => {
            r.setArc(!r.arc);
            redraw();
          },
          on: r.arc,
        },
      ];
      if (r.chain.count >= 2) options.push({ key: 'K', label: 'Klar', run: () => r.finish() });
      if (r.started) options.push({ key: 'Å', label: 'Ångra', run: () => r.undoPoint() });
      return { head, text: r.hintText(), options };
    }
    case 'ground': {
      const r = app.groundTool;
      const mode = (m: GroundMode) => () => {
        r.options.mode = m;
        r.reset();
        redraw();
      };
      const options: PromptOption[] = [
        { key: 'Y', label: 'Markyta', run: mode('area'), on: r.options.mode === 'area' },
        { key: 'B', label: 'Under bjälklag', run: mode('slab'), on: r.options.mode === 'slab' },
        { key: 'R', label: 'Ramp/väg', run: mode('path'), on: r.options.mode === 'path' },
        { key: 'L', label: 'Brytlinje', run: mode('breakline'), on: r.options.mode === 'breakline' },
        { key: 'M', label: 'Stödmur', run: mode('wall'), on: r.options.mode === 'wall' },
        { key: 'K', label: 'Höjdpunkt', run: mode('point'), on: r.options.mode === 'point' },
        { key: 'J', label: 'Markhöjd', run: mode('level'), on: r.options.mode === 'level' },
        { key: 'D', label: 'Låglinje', run: mode('drain'), on: r.options.mode === 'drain' },
      ];
      // Markytan som polygon (0.10.24).
      if (r.options.mode === 'area')
        options.push({
          key: 'P',
          label: 'Polygon',
          run: () => {
            r.options.shape = r.options.shape === 'polygon' ? 'rect' : 'polygon';
            r.reset();
            redraw();
          },
          on: r.polygon,
        });
      // Bågar i linjen direkt (0.10.19), som takets kontur; i markytans polygon (0.10.24).
      if (isLineMode(r.options.mode) || r.polygon)
        options.push({
          key: 'G',
          label: 'Båge',
          run: () => {
            r.setArc(!r.arc);
            redraw();
          },
          on: r.arc,
        });
      if ((r.started && isLineMode(r.options.mode)) || r.canClose) options.push({ key: 'A', label: r.polygon ? 'Klar' : 'Avsluta', run: () => r.finish() });
      if (!r.started) options.push({ key: 'H', label: 'Runt huset', run: () => r.aroundHouse() });
      if (r.started) options.push({ key: 'Å', label: 'Ångra', run: () => r.undoPoint() });
      return { head, text: r.hintText(), options };
    }
    case 'section':
    case 'elevation': {
      const t = tool === 'section' ? app.sectionTool : app.elevationTool;
      return { head, text: t.hintText(), options: t.step ? [{ key: 'Å', label: 'Ångra', run: () => t.back() }] : [] };
    }
    case 'measure': {
      const n = app.measureTool.measurement().points;
      return {
        head,
        text: n ? 'Klicka nästa punkt. Tab flyttar objektet vid sista punkten.' : 'Klicka första punkten att mäta från.',
        options: n ? [{ key: 'N', label: 'Nollställ', run: () => app.measureTool.reset() }] : [],
      };
    }
    case 'door':
    case 'window':
      return { head, text: 'Klicka på en vägg där öppningen ska sitta.', options: [] };
    case 'room':
      return { head, text: 'Klicka inuti ett rum som är omslutet av väggar.', options: [] };
    case 'text':
      return { head, text: 'Klicka där texten ska stå. Texten skrivs i verktygsraden.', options: [] };
    default:
      return null;
  }
}

/** Kortkommandona för Justera och fördela, i samma ordning som knapparna. */
const ALIGN_KEYS = ['V', 'ML', 'H', 'Ö', 'MV', 'U', 'FV', 'FL'];

/**
 * Det skrivna valt som ett alternativ: exakt bokstaven (eller bokstäverna),
 * eller början av namnet med minst två tecken.
 */
export function matchOption(options: PromptOption[], text: string): PromptOption | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const exact = options.find((o) => o.key.toLowerCase() === t);
  if (exact) return exact;
  if (t.length < 2) return null;
  const starts = options.filter((o) => o.label.toLowerCase().startsWith(t));
  return starts.length === 1 ? starts[0] : null;
}
