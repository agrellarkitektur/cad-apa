import { levelOf } from '../../repr/solids';
import { moveElements, moveWallEnd } from '../../core/commands';
import type { Id } from '../../core/model';
import { markerFrame } from '../../elements/markers';
import { resolveParams } from '../../elements/registry';
import type { WallParams } from '../../elements/wall';
import { wallProfile, type GroundParams } from '../../elements/ground';
import { crestAtS } from '../../elements/groundWall';
import { createContext } from '../../repr/context';
import { along, lineLength } from '../../elements/groundLines';
import type { Vec2 } from '../../repr/primitives';
import { buildModel3d } from '../../repr/model3d';
import { finishedForView, terrainMesh } from '../../repr/terrain';
import { contourSegments3d } from '../../elements/site';
import { isShown } from './showMenu';
import { ground3dHost } from './ground3d';
import { POCHE_MATERIALS } from '../../repr/section';
import type { Edit3DHost, Handle3D, View3D } from '../../view3d/view3d';
import { icons } from '../icons';
import { releasedHint } from '../tools/selectTool';
import { snap } from '../tools/snap';
import { saveUiSettings, SPLIT } from '../uiSettings';
import type { AppContext } from './context';
import type { ViewMode } from './shell';

/**
 * 3D-vyn: läget (2D, 3D eller båda), redigering i 3D med samma kommandon och
 * snäpp som i planen, och Följ sektionen. Three.js laddas först när 3D-vyn
 * öppnas, så att planen startar snabbt.
 */
export function installPane3d(app: AppContext) {
  let view3d: View3D | null = null;
  let loading3d: Promise<void> | null = null;
  /** Platsen som marken i 3D-vyn byggdes av. */
  let shownSite: unknown[] = [];

  // Följ sektionen (0.8): 3D-vyn klipps längs en öppen sektion, eller visar hela modellen.
  const followBtn = document.createElement('button');
  followBtn.className = 'follow-section';
  followBtn.hidden = true;
  followBtn.title = 'Klipp 3D-modellen längs sektionen som är öppen';
  followBtn.innerHTML = `${icons.section}<span>Följ sektionen</span>`;
  followBtn.addEventListener('click', () => {
    app.uiSettings.followSection = !app.uiSettings.followSection;
    saveUiSettings(app.uiSettings);
    update3d();
  });
  // Bara den här våningen (0.9): annars visar 3D alla våningar.
  const onlyBtn = document.createElement('button');
  onlyBtn.className = 'follow-section';
  onlyBtn.hidden = true;
  onlyBtn.title = 'Visa bara våningen som är vald i planen';
  onlyBtn.innerHTML = `${icons.storeys}<span>Bara den här våningen</span>`;
  onlyBtn.addEventListener('click', () => {
    app.uiSettings.storeyOnly3d = !app.uiSettings.storeyOnly3d;
    saveUiSettings(app.uiSettings);
    update3d();
  });
  const tools = document.createElement('div');
  tools.className = 'pane3d-tools';
  tools.append(onlyBtn, followBtn);
  app.pane3d.appendChild(tools);

  installSplitGrip(app);

  /** Andra markerade väggar som har en ände i punkten; de följer med när änden dras. */
  function companionWalls(wallId: Id, at: Vec2): Id[] {
    return app.selection.list().filter((id) => {
      const el = app.store.doc.elements[id];
      if (id === wallId || el?.type !== 'Wall') return false;
      const p = el.params as unknown as WallParams;
      return Math.hypot(p.start[0] - at[0], p.start[1] - at[1]) <= 1 || Math.hypot(p.end[0] - at[0], p.end[1] - at[1]) <= 1;
    });
  }

  /** Golvnivån för våningen som är vald, där greppen ritas i 3D (0.9). */
  const floorOf = () => app.store.doc.storeys.find((s) => s.id === app.ui.storey)?.elevation ?? 0;

  // Redigering i 3D: samma kommandon och snäppregler som i planen.
  const edit3d: Edit3DHost = {
    isSelected: (id) => app.selection.has(id),
    selectedIds: () => app.selection.list(),
    handles: () => {
      if (app.ui.tool !== 'select') return [];
      const out: Handle3D[] = [];
      const seen: Vec2[] = [];
      for (const id of app.selection.list()) {
        const el = app.store.doc.elements[id];
        if (el?.type !== 'Wall' || el.storey !== app.ui.storey) continue;
        const p = resolveParams<WallParams>(app.store.doc, el);
        for (const end of ['start', 'end'] as const) {
          const pt = p[end];
          if (seen.some((s) => Math.hypot(s[0] - pt[0], s[1] - pt[1]) <= 1)) continue;
          seen.push(pt);
          out.push({ wallId: id, end, point: pt, z: levelOf(p) + p.height + floorOf(), fixed: end === 'start' ? p.end : p.start });
        }
      }
      return out;
    },
    refLines: () => {
      if (app.ui.tool !== 'select') return [];
      const els = app.selection.list().map((id) => app.store.doc.elements[id]);
      const walls = els
        .filter((el) => el?.type === 'Wall' && el.storey === app.ui.storey)
        .map((el) => {
          const p = resolveParams<WallParams>(app.store.doc, el);
          return { a: p.start, b: p.end, z: levelOf(p) + p.height + floorOf() };
        });
      // Vägens referenslinje (0.10.7), strax över ytan, med höjden rakt mellan ändarna.
      const paths = els.filter((el) => el?.type === 'Ground' && el.params.kind === 'path').flatMap((el) => groundRefLine(resolveParams<GroundParams>(app.store.doc, el)));
      // Stödmurens referenslinje (0.10.9) strax över krönet.
      const retaining = els
        .filter((el) => el?.type === 'Ground' && el.params.kind === 'wall')
        .flatMap((el) => {
          const { ctx } = createContext(app.store.doc, el.storey, app.viewStates(), app.store.doc.graphics, () => true);
          const prof = wallProfile(ctx, el);
          const pts = (resolveParams<GroundParams>(app.store.doc, el).line ?? []) as Vec2[];
          if (!prof) return [];
          const z = (q: Vec2) => crestAtS(prof, along(prof.center, q[0], q[1]).s) + 30;
          return pts.slice(1).map((b, i) => ({ a: pts[i], b, z: z(pts[i]), zb: z(b) }));
        });
      return [...walls, ...paths, ...retaining];
    },
    snap: (cursor, from, exclude, tol, ortho) => {
      const r = snap({ cursor, from, segments: app.host.snapSegments(), tol, ortho, exclude: new Set(exclude) });
      return { point: r.point, label: r.label };
    },
    commitWallEnd: (wallId, end, to) => {
      const el = app.store.doc.elements[wallId];
      if (!el) return;
      const p = el.params as unknown as WallParams;
      const companions = companionWalls(wallId, p[end]);
      const fixed = end === 'start' ? p.end : p.start;
      const original = Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]);
      if (Math.hypot(to[0] - fixed[0], to[1] - fixed[1]) < 1) return;
      moveWallEnd(app.store, wallId, end, [to[0], to[1]], { label: 'Dra väggände', connected: companions });
      app.host.wallEndMoved?.(wallId, end, original, companions);
    },
    commitMove: (ids, d, anchor) => {
      if (Math.hypot(d[0], d[1]) < 1) return;
      const r = moveElements(app.store, ids, [d[0], d[1]]);
      if (r.released) app.hint(releasedHint(r.released), 4000);
      app.host.elementsMoved?.(ids, d, anchor);
    },
  };

  function update3d(): void {
    const { ui, store } = app;
    if (!view3d || ui.mode === '2d') return;
    const several = store.doc.storeys.length > 1;
    onlyBtn.hidden = !several;
    onlyBtn.setAttribute('aria-pressed', String(app.uiSettings.storeyOnly3d));
    view3d.setSolids(buildModel3d(store.doc, app.viewStates(), several && app.uiSettings.storeyOnly3d ? ui.storey : undefined));
    // Marken (0.10.3): byggs om bara när platsen eller den färdiga marken
    // (0.10.4, i ett förslag med markobjekt) ändras.
    const site = app.ui.hide.includes('Terrain') ? undefined : store.doc.site;
    const finished = site ? finishedForView(store.doc, app.viewStates()) : null;
    // Höjdkurvorna på marken (0.10.8), om de inte släckts under Visa.
    const lines = !!site && isShown(app.ui, 'contours3d');
    const shown = [finished ?? site, site?.contours, lines];
    if (shown.some((v, i) => v !== shownSite[i])) {
      shownSite = shown;
      view3d.setTerrain(site ? terrainMesh(store.doc, undefined, finished?.z) : null, lines ? contourSegments3d(store.doc, finished) : null);
    }
    // Markobjekten går att hovra och markera på marken (0.10.11).
    view3d.ground = ground3dHost(store.doc, app.viewStates());
    view3d.setSelection(app.selection.list());
    // Med en sektion öppen klipps modellen längs den, och snittet fylls (0.8).
    // Följ sektionen i 3D-vyn slår av och på det.
    const m = ui.marker ? store.doc.elements[ui.marker] : undefined;
    followBtn.hidden = m?.type !== 'Section';
    followBtn.setAttribute('aria-pressed', String(app.uiSettings.followSection));
    if (m?.type === 'Section' && app.uiSettings.followSection) {
      const f = markerFrame(store.doc, m);
      // Snittytorna har sina verkliga höjder sedan 0.9 (alla våningar).
      const caps = (app.section?.cutFaces ?? []).map((c) => ({ poche: POCHE_MATERIALS.has(c.material), rings: c.rings }));
      view3d.setClip({ start: f.start, right: f.right, view: f.view, length: Math.hypot(f.end[0] - f.start[0], f.end[1] - f.start[1]), depth: f.depth }, caps);
    } else view3d.setClip(null);
  }

  async function setMode(mode: ViewMode): Promise<void> {
    const { ui } = app;
    ui.mode = mode;
    app.appEl.dataset.mode = mode;
    app
      .$<HTMLElement>('.view-modes')
      .querySelectorAll<HTMLElement>('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    if (mode === '3d' && ui.tool === 'wall') app.setTool('select');
    // Rutorna har fått nya storlekar: visa hela planen och modellen igen.
    setTimeout(() => {
      if (mode !== '3d') app.view.zoomToFit();
    }, 60);
    if (mode !== '2d' && !view3d) {
      loading3d ??= import('../../view3d/view3d').then(({ View3D }) => {
        view3d = new View3D(app.pane3d);
        view3d.editor = edit3d;
        view3d.onCameraChange = () => {
          if (app.ui.mode === '3d') app.positionMeasureBox();
        };
        view3d.onPick = (id, additive) => {
          if (!id) app.selection.clear();
          else if (additive) app.selection.toggle(id);
          else app.selection.set([id]);
        };
      });
      try {
        await loading3d;
      } catch {
        app.hint('3D-vyn kunde inte startas i den här webbläsaren.', 4000);
        return;
      }
    }
    update3d();
    if (mode !== '2d') setTimeout(() => view3d?.frameAll(), 60);
  }

  return {
    /** 3D-vyn, eller null innan den öppnats första gången. */
    get view3d() {
      return view3d;
    },
    setMode,
    update3d,
  };
}

/**
 * Skarven mellan planen och 3D i läget Båda (0.8.4). Dra för att ändra
 * fördelningen; pil vänster och höger flyttar den med tangentbordet och
 * dubbelklick delar lika. Fördelningen sparas med de andra inställningarna.
 */
function installSplitGrip(app: AppContext): void {
  const { appEl, uiSettings } = app;
  const canvas = app.pane3d.parentElement!;
  const grip = document.createElement('div');
  grip.className = 'split-grip';
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'vertical');
  grip.tabIndex = 0;
  grip.title = 'Dra för att ändra fördelningen mellan planen och 3D, dubbelklicka för att dela lika';
  grip.setAttribute('aria-label', 'Skarven mellan planen och 3D');
  canvas.appendChild(grip);

  const apply = (f: number) => {
    uiSettings.split = Math.max(SPLIT.min, Math.min(SPLIT.max, f));
    appEl.style.setProperty('--split', `${(uiSettings.split * 100).toFixed(2)}%`);
    grip.setAttribute('aria-valuenow', String(Math.round(uiSettings.split * 100)));
  };
  apply(uiSettings.split);

  let drag: { id: number; left: number; width: number } | null = null;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    drag = { id: e.pointerId, left: r.left, width: r.width };
    grip.setPointerCapture(e.pointerId);
    grip.classList.add('active');
    document.body.classList.add('resizing-pane');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || drag.width <= 0) return;
    apply((e.clientX - drag.left) / drag.width);
  });
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    grip.classList.remove('active');
    document.body.classList.remove('resizing-pane');
    saveUiSettings(uiSettings);
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => {
    apply(0.5);
    saveUiSettings(uiSettings);
  });
  grip.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.shiftKey ? 0.1 : 0.02;
    apply(uiSettings.split + (e.key === 'ArrowLeft' ? -step : step));
    saveUiSettings(uiSettings);
  });
}

/** Vägens referenslinje i 3D (0.10.7): segmenten med höjden längs linjen, mm från ±0, 30 mm över ytan. */
function groundRefLine(p: GroundParams): { a: Vec2; b: Vec2; z: number; zb: number }[] {
  const pts = p.line ?? [];
  const total = lineLength(pts);
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  const out: { a: Vec2; b: Vec2; z: number; zb: number }[] = [];
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const z = (at: number) => (total > 0 ? h0 + ((h1 - h0) * at) / total : h0) + 30;
    out.push({ a: [pts[i - 1][0], pts[i - 1][1]], b: [pts[i][0], pts[i][1]], z: z(s), zb: z(s + l) });
    s += l;
  }
  return out;
}
