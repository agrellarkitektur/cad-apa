import { resolveParams } from '../../elements/registry';
import { markerName, modelBounds } from '../../elements/markers';
import type { WallParams } from '../../elements/wall';
import type { Id } from '../../core/model';
import type { ViewTool } from '../../view2d/planView';
import type { ModifyContext } from '../modify/ops';
import { DimensionTool, TextTool } from '../tools/annotationTools';
import { Draw2DTool } from '../tools/draw2dTool';
import type { ToolHost } from '../tools/host';
import { AlignTool, MarkerTool, RoofTool } from '../tools/markerTools';
import { MeasureTool, ZoomBoxTool } from '../tools/measureTool';
import { OpeningTool } from '../tools/openingTool';
import { RoomTool } from '../tools/roomTool';
import { SelectTool } from '../tools/selectTool';
import { forgetInferred } from '../tools/snap';
import { WallTool, type WallToolOptions } from '../tools/wallTool';
import { icons } from '../icons';
import type { AppContext } from './context';
import { aliasText, commandFor } from '../commandRegistry';
import { defaultWallType, firstDefinition } from './helpers';
import { GROUP_LABEL, PLAN_TOOLS, SHEET_TOOLS, SPACE_TOOLS, TOOLS, type ToolId } from './shell';

/**
 * Verktygen (0.8.11, ur app.ts): verktygsraden, ett objekt per verktyg, att
 * byta verktyg, Avbryt, Zooma till område, Rikta efter objekt och Ny vägg
 * härifrån. Verktygen får appen genom `host` (se src/ui/tools/host.ts).
 */
export function installTools(app: AppContext, host: ToolHost) {
  // ---------- Verktygsraden ----------
  const toolsEl = app.$<HTMLElement>('.tools');
  let lastGroup = '';
  for (const t of TOOLS) {
    if (t.group !== lastGroup) {
      const label = document.createElement('div');
      label.className = 'tool-group-label';
      label.textContent = GROUP_LABEL[t.group];
      toolsEl.appendChild(label);
      lastGroup = t.group;
    }
    const b = document.createElement('button');
    b.className = 'tool';
    b.dataset.tool = t.id;
    b.innerHTML = `${icons[t.icon]}<span>${t.label}</span>`;
    const cmd = commandFor({ tool: t.id as ToolId });
    b.title = t.comesIn ? `${t.label} – kommer i ${t.comesIn}` : `${t.label}${t.key ? ` (${t.key})` : ''}${cmd ? ` · skriv ${aliasText(cmd)}` : ''}`;
    if (t.comesIn) {
      b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', () => app.hint(`${t.label} kommer i ${t.comesIn}, med smartobjekten.`));
    } else {
      b.addEventListener('click', () => setTool(t.id as ToolId));
    }
    toolsEl.appendChild(b);
  }


  const selectTool = new SelectTool(host);
  const wallTool = new WallTool(host, { definition: defaultWallType(app.store.doc), face: 'center', height: 2700 });
  wallTool.onChange = () => {
    // Ny vägg härifrån: smartmenyn försvinner när första väggen är ritad, och
    // när kedjan är klar går det tillbaka till Markera.
    if (wallFrom && app.modifier.drawingWall && wallTool.placed > 0) {
      app.modifier.release();
      app.smartMenu.hide();
    }
    if (wallFrom && !wallTool.drawing) {
      if (app.modifier.drawingWall) app.modifier.release();
      endWallFrom();
    }
    app.toolOpts.renderToolOptions();
  };
  const panTool: ViewTool = { cursor: 'grab', down: () => 'pan', tap: (p) => selectTool.tap(p) };
  const doorTool = new OpeningTool(host, 'Door', { definition: firstDefinition(app.store.doc, 'Door') });
  const windowTool = new OpeningTool(host, 'Window', { definition: firstDefinition(app.store.doc, 'Window') });
  const roomTool = new RoomTool(host);
  const dimensionTool = new DimensionTool(host);
  dimensionTool.onChange = () => app.toolOpts.renderToolOptions();
  const textTool = new TextTool(host);
  const draw2dTool = new Draw2DTool(host);
  draw2dTool.onChange = () => app.toolOpts.renderToolOptions();
  const measureTool = new MeasureTool(host);
  // Zooma till område: ett tillfälligt verktyg, sedan tillbaka.
  const zoomBoxTool = new ZoomBoxTool(host);
  let zoomingBox = false;
  const endZoomBox = (): void => {
    zoomingBox = false;
    app.view.setTool(tools[app.ui.tool]);
    app.view.requestRender();
  };
  zoomBoxTool.onDone = endZoomBox;
  function startZoomBox(): void {
    if (app.ui.mode === '3d') return;
    zoomingBox = true;
    app.view.setTool(zoomBoxTool);
    app.hint('Dra upp en ruta att zooma till, eller klicka för att zooma in. Shift+Z: förra zoomen.', 3500);
  }
  function previousZoom(): void {
    if (!app.view.previousZoom()) app.hint('Ingen tidigare zoom.');
  }
  measureTool.onChange = () => {
    app.toolOpts.updateMeasureOptions();
    app.view.requestRender();
  };
  // Flytta med måttbandet (0.8.4): fältet för avståndet får fokus direkt.
  measureTool.onTarget = () => {
    app.toolOpts.renderToolOptions();
    const input = app.toolOptions.querySelector<HTMLInputElement>('#measure-move');
    if (input) {
      input.focus();
      input.select();
    }
  };
  const roofTool = new RoofTool(host);
  const sectionTool = new MarkerTool(host, 'Section');
  const elevationTool = new MarkerTool(host, 'Elevation');
  const created = (id: Id) => {
    setTool('select');
    app.selection.set([id]);
    const el = app.store.doc.elements[id];
    if (el && (el.type === 'Section' || el.type === 'Elevation')) {
      app.hint(`${markerName(app.store.doc, el)} finns nu i projektträdet under Modell. Dubbelklicka på linjen för att öppna den.`, 5000);
    }
  };
  roofTool.onCreated = created;
  sectionTool.onCreated = created;
  elevationTool.onCreated = created;
  roofTool.onChange = () => app.toolOpts.renderToolOptions();
  sectionTool.onChange = () => app.toolOpts.renderToolOptions();
  elevationTool.onChange = () => app.toolOpts.renderToolOptions();
  const tools: Record<ToolId, ViewTool> = {
    select: selectTool,
    wall: wallTool,
    pan: panTool,
    door: doorTool,
    window: windowTool,
    room: roomTool,
    dimension: dimensionTool,
    text: textTool,
    draw2d: draw2dTool,
    roof: roofTool,
    section: sectionTool,
    elevation: elevationTool,
    measure: measureTool,
  };

  /** `keep`: smartmenyn och markeringen ligger kvar (Ny vägg härifrån, 0.8.4). */
  function setTool(id: ToolId, keep = false): void {
    settingTool = true;
    try {
      changeTool(id, keep);
    } finally {
      settingTool = false;
    }
  }
  let settingTool = false;
  /** Verktyget för ett verktygsval: på ett ritningsblad markerar Markera också vyerna (0.8.9). */
  const toolFor = (id: ToolId): ViewTool => (app.ui.layout && id === 'select' ? app.sheets.tool : tools[id]);
  function changeTool(id: ToolId, keep: boolean): void {
    app.measureBox.close();
    // Ritverktygen ritar i planen: från en fasad eller sektion går man tillbaka dit.
    // Mått, text och 2D ritas i fasaden eller sektionen (0.8).
    if (PLAN_TOOLS.includes(id) && !SPACE_TOOLS.includes(id) && (app.ui.marker || app.ui.worksheet)) app.goTo({ kind: 'storey', id: app.ui.storey });
    // På ett ritningsblad ritas text, linjer och ytor i mm på papperet (0.8.9).
    // Mått stannar på bladet med ett tips; övriga ritverktyg går till planen.
    if (app.ui.layout && id === 'dimension') {
      app.hint('Mått ritas i vyerna, så får de vyns skala. Lägg vyn på bladet.', 4500);
      return;
    }
    if (app.ui.layout && id !== 'select' && id !== 'pan' && !SHEET_TOOLS.includes(id)) app.goTo({ kind: 'storey', id: app.ui.storey });
    if (PLAN_TOOLS.includes(id) && app.ui.mode === '3d') void app.setMode('2d');
    if (app.ui.tool === 'wall' && id !== 'wall') wallTool.finish();
    if (app.ui.tool === 'dimension' && id !== 'dimension') dimensionTool.reset();
    if (app.ui.tool === 'draw2d' && id !== 'draw2d') draw2dTool.finish(false);
    if (app.ui.tool === 'roof' && id !== 'roof') roofTool.reset();
    if (app.ui.tool === 'section' && id !== 'section') sectionTool.reset();
    if (app.ui.tool === 'elevation' && id !== 'elevation') elevationTool.reset();
    if (!keep) {
      app.smartMenu.hide();
      app.modifier.cancel();
    }
    // Linjen man kände på för parallellt och vinkelrätt gäller bara verktyget (0.8.16).
    if (app.ui.tool !== id) forgetInferred();
    app.ui.tool = id;
    app.view.setTool(toolFor(id));
    toolsEl.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => {
      if (!b.hasAttribute('aria-disabled')) b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
    if (PLAN_TOOLS.includes(id) && id !== 'room' && id !== 'text' && !keep) {
      app.selection.clear();
      if (window.innerWidth <= 960) app.setPanel(false);
    }
    app.toolOpts.renderToolOptions();
    app.commandLine?.toolChosen(id);
  }

  /**
   * Ett tak över alla väggar på våningen, med 500 mm utsprång och takfoten
   * så att undersidan möter de högsta väggarnas överkant vid ytterlivet.
   */
  function roofOverHouse(): void {
    const b = modelBounds(app.store.doc, app.ui.storey);
    if (!b) {
      app.hint('Rita väggar först, så läggs taket över dem.');
      return;
    }
    const over = 500;
    const walls = Object.values(app.store.doc.elements).filter((e) => e.type === 'Wall' && e.storey === app.ui.storey);
    const top = Math.max(...walls.map((w) => resolveParams<WallParams>(app.store.doc, w).height));
    const k = Math.tan((roofTool.options.slope * Math.PI) / 180);
    roofTool.options.eave = Math.round(top - k * over);
    roofTool.create([
      [Math.round(b.minX - over), Math.round(b.minY - over)],
      [Math.round(b.maxX + over), Math.round(b.minY - over)],
      [Math.round(b.maxX + over), Math.round(b.maxY + over)],
      [Math.round(b.minX - over), Math.round(b.maxY + over)],
    ]);
  }

  /** Avbryt: först det pågående kommandot, sedan verktyget. */
  function cancelCommand(): void {
    if (app.underlays.busy()) {
      app.underlays.cancel();
      setTool('select');
    } else if (app.modifier.busy) app.modifier.cancel();
    else if (app.ui.tool === 'wall' && wallTool.drawing) wallTool.finish();
    else if (app.ui.tool === 'dimension' && dimensionTool.count > 0) dimensionTool.reset();
    else if (app.ui.tool === 'draw2d' && draw2dTool.count > 0) draw2dTool.reset();
    else if (app.ui.tool === 'roof' && roofTool.started) roofTool.reset();
    else if (app.ui.tool === 'section' && sectionTool.step > 0) sectionTool.reset();
    else if (app.ui.tool === 'elevation' && elevationTool.step > 0) elevationTool.reset();
    else if (app.ui.tool === 'measure' && measureTool.measurement().points > 0) measureTool.reset();
    else setTool('select');
    app.view.requestRender();
  }

  // Rikta efter objekt: ett klick i planen, sedan tillbaka till verktyget.
  const alignTool = new AlignTool(host);
  let aligning = false;
  const endAlign = (): void => {
    aligning = false;
    alignTool.target = null;
    app.view.setTool(tools[app.ui.tool]);
    app.view.requestRender();
  };
  alignTool.onDone = (ok) => {
    endAlign();
    if (!ok) app.hint('Ingen vägg eller linje där. Tryck på Rikta efter objekt och försök igen.');
  };
  app.panel.onAlignMarker = (id) => {
    if (app.ui.marker) app.goTo({ kind: 'storey', id: app.ui.storey });
    if (app.ui.tool !== 'select') setTool('select');
    alignTool.target = id;
    aligning = true;
    app.view.setTool(alignTool);
    app.hint(`Klicka på en vägg eller linje. ${app.store.doc.elements[id]?.type === 'Section' ? 'Sektionen' : 'Fasaden'} blir parallell med den; håll Shift för vinkelrät.`, 5000);
  };

  /** Väggverktygets val innan Ny vägg härifrån tog över, eller null. */
  let wallFrom: WallToolOptions | null = null;
  function endWallFrom(): void {
    if (!wallFrom) return;
    Object.assign(wallTool.options, wallFrom);
    wallFrom = null;
    // Byts verktyget just nu (en knapp i verktygsraden) går det dit i stället.
    if (app.ui.tool === 'wall' && !settingTool) setTool('select', true);
  }
  /**
   * Ny vägg härifrån (0.8.4): väggverktyget med den klickade väggens typ,
   * höjd och liv, som börjar i änden. Verktygets egna val kommer tillbaka efteråt.
   */
  function startWallFrom(ctx: ModifyContext): boolean {
    const el = ctx.wallId ? app.store.doc.elements[ctx.wallId] : undefined;
    if (!el || el.type !== 'Wall' || !ctx.end) return false;
    const p = resolveParams<WallParams>(app.store.doc, el);
    wallFrom ??= { ...wallTool.options };
    wallTool.options.definition = el.definition ?? null;
    wallTool.options.height = p.height;
    wallTool.options.face = p.justification === 'right' ? 'outside' : p.justification === 'left' ? 'inside' : 'center';
    setTool('wall', true);
    wallTool.startAt([p[ctx.end][0], p[ctx.end][1]]);
    return true;
  }

  return {
    tools,
    selectTool,
    wallTool,
    doorTool,
    windowTool,
    roomTool,
    dimensionTool,
    textTool,
    draw2dTool,
    measureTool,
    roofTool,
    sectionTool,
    elevationTool,
    get aligning() {
      return aligning;
    },
    get zoomingBox() {
      return zoomingBox;
    },
    setTool,
    toolFor,
    cancelCommand,
    endAlign,
    startZoomBox,
    endZoomBox,
    previousZoom,
    roofOverHouse,
    startWallFrom,
    endWallFrom,
  };
}
