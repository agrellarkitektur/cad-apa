import { moveElements, moveWallEnd } from '../../core/commands';
import type { Id } from '../../core/model';
import { markerFrame } from '../../elements/markers';
import { resolveParams } from '../../elements/registry';
import type { WallParams } from '../../elements/wall';
import type { Vec2 } from '../../repr/primitives';
import { buildModel3d } from '../../repr/model3d';
import type { Edit3DHost, Handle3D, View3D } from '../../view3d/view3d';
import { icons } from '../icons';
import { releasedHint } from '../tools/selectTool';
import { snap } from '../tools/snap';
import { saveUiSettings } from '../uiSettings';
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
  app.pane3d.appendChild(followBtn);

  /** Andra markerade väggar som har en ände i punkten; de följer med när änden dras. */
  function companionWalls(wallId: Id, at: Vec2): Id[] {
    return app.selection.list().filter((id) => {
      const el = app.store.doc.elements[id];
      if (id === wallId || el?.type !== 'Wall') return false;
      const p = el.params as unknown as WallParams;
      return Math.hypot(p.start[0] - at[0], p.start[1] - at[1]) <= 1 || Math.hypot(p.end[0] - at[0], p.end[1] - at[1]) <= 1;
    });
  }

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
          out.push({ wallId: id, end, point: pt, z: p.height, fixed: end === 'start' ? p.end : p.start });
        }
      }
      return out;
    },
    refLines: () => {
      if (app.ui.tool !== 'select') return [];
      return app.selection
        .list()
        .map((id) => app.store.doc.elements[id])
        .filter((el) => el?.type === 'Wall' && el.storey === app.ui.storey)
        .map((el) => {
          const p = resolveParams<WallParams>(app.store.doc, el);
          return { a: p.start, b: p.end, z: p.height };
        });
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
    view3d.setSolids(buildModel3d(store.doc, ui.storey, app.viewStates()));
    view3d.setSelection(app.selection.list());
    // Med en sektion öppen klipps modellen längs den, och snittet fylls (0.8).
    // Följ sektionen i 3D-vyn slår av och på det.
    const m = ui.marker ? store.doc.elements[ui.marker] : undefined;
    followBtn.hidden = m?.type !== 'Section';
    followBtn.setAttribute('aria-pressed', String(app.uiSettings.followSection));
    if (m?.type === 'Section' && app.uiSettings.followSection) {
      const f = markerFrame(store.doc, m);
      const z0 = store.doc.storeys.find((x) => x.id === m.storey)?.elevation ?? 0;
      const caps = (app.section?.cutFaces ?? []).map((c) => ({ poche: ['wall', 'wall-new', 'roof', 'floor'].includes(c.material), rings: c.rings }));
      view3d.setClip({ start: f.start, right: f.right, view: f.view, length: Math.hypot(f.end[0] - f.start[0], f.end[1] - f.start[1]), depth: f.depth }, caps, z0);
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
