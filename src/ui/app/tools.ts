import { resolveParams } from '../../elements/registry';
import { markerName } from '../../elements/markers';
import { ringArea } from '../../elements/slab';
import { bareWallUnion, type WallParams } from '../../elements/wall';
import { isSite, SITE_STOREY, storeysUpFrom, type Id } from '../../core/model';
import type { ViewTool } from '../../view2d/planView';
import type { ModifyContext } from '../modify/ops';
import { DimensionTool, TextTool } from '../tools/annotationTools';
import { LabelTool } from '../tools/labelTool';
import { Draw2DTool } from '../tools/draw2dTool';
import type { ToolHost } from '../tools/host';
import { AlignTool, MarkerTool } from '../tools/markerTools';
import { RoofTool } from '../tools/roofTool';
import { MeasureTool, ZoomBoxTool } from '../tools/measureTool';
import { OpeningTool } from '../tools/openingTool';
import { RoomTool } from '../tools/roomTool';
import { SelectTool } from '../tools/selectTool';
import { SlabTool } from '../tools/slabTool';
import { GroundTool } from '../tools/groundTool';
import { StairTool } from '../tools/stairTool';
import { RailingTool } from '../tools/railingTool';
import { storeyAbove } from '../../elements/stair';
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
  const wallTool = new WallTool(host, { definition: defaultWallType(app.store.doc), face: 'center', height: null });
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
  const labelTool = new LabelTool(host);
  labelTool.onChange = () => {
    app.toolOpts.renderToolOptions();
    app.view.requestRender();
  };
  labelTool.onCreated = (id) => {
    app.selection.set([id]);
    app.hint('Litteran är lagd. Ändra texten, sorten och ramen i egenskaperna; fälten inom klammer hämtas ur det ledarna pekar på.', 5000);
  };
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
  const slabTool = new SlabTool(host, firstDefinition(app.store.doc, 'Slab'));
  slabTool.onCreated = (id) => {
    app.selection.set([id]);
    app.hint('Bjälklaget är lagt. Rita fler, eller välj Håltagning och dra upp ett hål i det.', 4000);
  };
  slabTool.onChange = () => app.toolOpts.renderToolOptions();
  const groundTool = new GroundTool(host);
  groundTool.onCreated = (id) => {
    app.selection.set([id]);
    const kind = app.store.doc.elements[id]?.params.kind;
    const text: Record<string, string> = {
      path: 'Vägen är lagd med höjderna ur marken i ändarna. Ändra höjder, lutning och bredd i egenskaperna, mittlinjen med punkterna.',
      breakline: 'Brytlinjen är lagd med höjderna ur marken i ändarna. Ändra dem och radien i egenskaperna.',
      point: 'Höjdpunkten är lagd med markens höjd. Ändra den och radien i egenskaperna.',
      wall: 'Stödmuren är lagd; krönet följer den högre sidans mark. Ändra det i egenskaperna, linjen med punkterna.',
      level: 'Markhöjden är lagd: befintlig höjd understruken, ny höjd utan och den som utgår inom parentes. En egen ny höjd sätts i egenskaperna.',
      drain: 'Låglinjen är lagd, med pilarna i linjens riktning. Ändra linjen med punkterna.',
    };
    app.hint(text[String(kind)] ?? 'Markobjektet är lagt. Ändra höjd, fall och slänt i egenskaperna, konturen med hörnen och kanterna.', 5000);
  };
  groundTool.onChange = () => app.toolOpts.renderToolOptions();
  const stairTool = new StairTool(host);
  stairTool.onCreated = (id) => {
    app.selection.set([id]);
    const el = app.store.doc.elements[id];
    const above = el ? storeyAbove(app.store.doc, el.storey) : undefined;
    if (el?.params.spiral) {
      app.hint('Spiraltrappan är lagd. Ändra diametrarna, graderna och varvriktningen i egenskaperna; dra i mitten eller startpunkten för att flytta eller vrida den.', 6000);
      return;
    }
    app.hint(`Trappan är lagd, med stigningen ${above ? `till ${above.name} och hålet i bjälklaget där` : 'lika med våningshöjden'}. Ändra bredd, steg, plansteg och vilplan i egenskaperna, linjen med punkterna; klicka på en punkt för Vilplan härifrån.`, 6000);
  };
  stairTool.onChange = () => app.toolOpts.renderToolOptions();
  const railingTool = new RailingTool(host);
  railingTool.onCreated = (ids) => {
    if (!ids.length) return;
    app.selection.set(ids);
    const el = app.store.doc.elements[ids[0]];
    railingTool.options.def = el?.definition;
    app.hint(el?.host ? 'Räcket är lagt längs trappans kant och följer trappan. Typen, läget och höjderna ändras i egenskaperna; trappan varnar tills båda sidor har ledstång.' : 'Räcket är ritat. Punkternas höjd, typen och måtten ändras i egenskaperna.', 6000);
  };
  railingTool.onChange = () => app.toolOpts.renderToolOptions();
  const sectionTool = new MarkerTool(host, 'Section');
  const elevationTool = new MarkerTool(host, 'Elevation');
  const created = (id: Id) => {
    setTool('select');
    app.selection.set([id]);
    const el = app.store.doc.elements[id];
    if (el?.type === 'BasisFacade') app.hint('Byggnadshöjden mäts nu mot den här fasaden. Fasaden som ser den visar BH från början.', 5000);
    if (el && (el.type === 'Section' || el.type === 'Elevation')) {
      app.hint(`${markerName(app.store.doc, el)} finns nu i projektträdet under Modell. Dubbelklicka på linjen för att öppna den.`, 5000);
    }
  };
  roofTool.onCreated = (ids) => {
    setTool('select');
    app.selection.set(ids);
    if (ids.length > 1) app.hint('Takfallen är lagda. Ändra dem ett och ett, eller markera alla och ändra lutningen på en gång.', 4000);
  };
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
    label: labelTool,
    draw2d: draw2dTool,
    roof: roofTool,
    slab: slabTool,
    ground: groundTool,
    stair: stairTool,
    railing: railingTool,
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
    // Markobjekten hör till Platsen (0.10.25): Mark öppnar den.
    if (id === 'ground' && !app.ui.layout && !app.ui.marker && !app.ui.worksheet && !isSite(app.ui.storey) && app.store.doc.storeys.some((s) => s.site)) {
      app.goTo({ kind: 'storey', id: SITE_STOREY });
      app.hint('Markobjekten ritas på Platsen.', 3000);
    }
    // Trappor ritas på en våning (0.11): från Platsen går man till den närmast ±0. Räcken (staket) ritas också på Platsen (0.11.3).
    if (id === 'stair' && !app.ui.layout && !app.ui.marker && !app.ui.worksheet && isSite(app.ui.storey)) {
      const first = storeysUpFrom(app.store.doc).find((s) => s.elevation >= 0) ?? storeysUpFrom(app.store.doc)[0];
      if (first) app.goTo({ kind: 'storey', id: first.id });
    }
    if (app.ui.tool === 'wall' && id !== 'wall') wallTool.finish();
    if (app.ui.tool === 'dimension' && id !== 'dimension') dimensionTool.reset();
    if (app.ui.tool === 'draw2d' && id !== 'draw2d') draw2dTool.finish(false);
    if (app.ui.tool === 'roof' && id !== 'roof') roofTool.reset();
    if (app.ui.tool === 'slab' && id !== 'slab') slabTool.reset();
    if (app.ui.tool === 'label' && id !== 'label') labelTool.reset();
    if (app.ui.tool === 'ground' && id !== 'ground') groundTool.finish();
    if (app.ui.tool === 'ground' && id !== 'ground') groundTool.reset();
    if (app.ui.tool === 'stair' && id !== 'stair') stairTool.finish();
    if (app.ui.tool === 'railing' && id !== 'railing') railingTool.finish();
    if (app.ui.tool === 'section' && id !== 'section') sectionTool.reset();
    if (app.ui.tool === 'elevation' && id !== 'elevation') elevationTool.reset();
    if (!keep) {
      app.smartMenu.hide();
      app.modifier.cancel();
    }
    // Linjen man kände på för parallellt och vinkelrätt gäller bara verktyget (0.8.16).
    if (app.ui.tool !== id) forgetInferred();
    // Smartspöt gäller verktyget det slogs på i (0.10.22).
    if (app.wand.active) app.wand.dropped();
    app.ui.tool = id;
    app.view.setTool(toolFor(id));
    toolsEl.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => {
      if (!b.hasAttribute('aria-disabled')) b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
    if (PLAN_TOOLS.includes(id) && id !== 'room' && id !== 'text' && id !== 'label' && !keep) {
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
  /**
   * Snabbvalet över hela huset (0.10): rektangeln runt ytterväggarna på
   * våningen, med höjden vid ytterlivet där väggarna slutar. Bara när huset
   * är rektangulärt; annars ritas ett tak per huskropp.
   */
  function roofOverHouse(): void {
    const doc = app.store.doc;
    const state = host.activeState();
    const walls = Object.values(doc.elements)
      .filter((e) => e.type === 'Wall' && e.storey === app.ui.storey && !e.space && e.states.includes(state))
      .map((e) => ({ id: e.id, p: resolveParams<WallParams>(doc, e) }));
    if (!walls.length) {
      app.hint('Rita väggar först, så läggs taket över dem.');
      return;
    }
    const outer = bareWallUnion(walls)
      .map((poly) => poly[0])
      .sort((a, b) => ringArea(b) - ringArea(a))[0];
    if (!outer) return;
    const xs = outer.map((q) => q[0]);
    const ys = outer.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (ringArea(outer) < 0.97 * (x1 - x0) * (y1 - y0)) {
      app.hint('Huset är inte rektangulärt. Dra upp ett tak per huskropp, eller rita takfallen och kapa dem mot varandra.', 5000);
      return;
    }
    if (roofTool.options.mode === 'face') roofTool.options.mode = 'gable';
    roofTool.options.height = Math.max(...walls.map((w) => w.p.height));
    roofTool.options.heightAt = 'under';
    roofTool.createQuick([Math.round(x0), Math.round(y0)], [Math.round(x1), Math.round(y1)]);
  }

  /**
   * Ett bjälklag innanför ytterväggarna på våningen (0.9.1). Finns det redan
   * ett i tillståndet markeras det i stället.
   */
  function slabFromWalls(): void {
    const doc = app.store.doc;
    const state = host.activeState();
    const here = Object.values(doc.elements).filter((e) => e.storey === app.ui.storey && !e.space && e.states.includes(state));
    if (!here.some((e) => e.type === 'Wall')) {
      app.hint('Rita väggar först, så läggs bjälklaget innanför ytterväggarna.');
      return;
    }
    const old = here.find((e) => e.type === 'Slab' && e.params.fromWalls);
    if (old) {
      app.selection.set([old.id]);
      app.hint('Det finns redan ett bjälklag ur väggarna på våningen. Det är markerat.');
      return;
    }
    slabTool.create();
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
    else if (app.ui.tool === 'slab' && slabTool.started) slabTool.reset();
    else if (app.ui.tool === 'label' && (labelTool.count > 0 || labelTool.addTo)) {
      const done = labelTool.addTo;
      labelTool.reset();
      if (done) {
        setTool('select');
        app.selection.set([done]);
      }
    }
    else if (app.ui.tool === 'ground' && groundTool.started) groundTool.reset();
    else if (app.ui.tool === 'stair' && stairTool.started) stairTool.reset();
    else if (app.ui.tool === 'railing' && railingTool.started) railingTool.reset();
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
  app.panel.onAddLeader = (id) => {
    setTool('label');
    labelTool.addTo = id;
    app.selection.set([id]);
    labelTool.onChange?.();
    app.hint('Klicka på det ledaren ska peka på. Esc när du är klar.', 4000);
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
    wallTool.options.height = typeof el.params.height === 'number' ? el.params.height : null;
    wallTool.options.face = p.justification === 'right' ? 'outside' : p.justification === 'left' ? 'inside' : 'center';
    setTool('wall', true);
    wallTool.startAt([p[ctx.end][0], p[ctx.end][1]]);
    return true;
  }

  /** Förläng rampen från änden man klickat på i Modifiera (0.10.18): verktyget Mark ritar vidare på den. */
  function startRampFrom(ctx: ModifyContext): boolean {
    const el = ctx.shapeId ? app.store.doc.elements[ctx.shapeId] : undefined;
    const n = ((el?.params.line ?? []) as unknown[]).length;
    if (!el || el.type !== 'Ground' || el.params.kind !== 'path' || ctx.index === undefined || (ctx.index !== 0 && ctx.index !== n - 1)) return false;
    groundTool.options.mode = 'path';
    setTool('ground', true);
    return groundTool.continueFrom(el.id, ctx.index === 0);
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
    labelTool,
    draw2dTool,
    measureTool,
    roofTool,
    slabTool,
    groundTool,
    stairTool,
    railingTool,
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
    slabFromWalls,
    startWallFrom,
    endWallFrom,
    startRampFrom,
  };
}
