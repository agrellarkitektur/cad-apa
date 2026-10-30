import { onPaper, type Id } from '../../core/model';
import { placeLogo } from '../../core/office';
import type { MenuItem } from '../contextMenu';
import type { AppContext } from './context';

/**
 * Kontorets logotyp på papperet (0.10.39): *Lägg in logotypen här* i
 * högerklicksmenyn på ett blad, ett mallblad eller en stämpel, när
 * stilboken har en logotyp.
 */

/** Menyraden för ytan `space` (ett blad, mallblad eller en stämpel), med punkten i mm på papperet. */
export function logoItems(app: AppContext, space: Id, at: readonly [number, number]): MenuItem[] {
  if (!app.store.doc.graphics.office?.logo) return [];
  return [
    {
      label: 'Lägg in logotypen här',
      run: () => {
        const id = placeLogo(app.store, space, [Math.round(at[0]), Math.round(at[1])]);
        if (id) {
          app.selection.set([id]);
          app.hint('Logotypen ligger med nedre vänstra hörnet där du klickade. Dra i hörnen för storleken.', 4000);
        }
      },
    },
  ];
}

/** Menyraden på ett mallblad eller en stämpel (inte i modellen eller på arbetsblad). */
export function paperLogoItems(app: AppContext, clientX: number, clientY: number): MenuItem[] {
  const ws = app.store.doc.worksheets.find((w) => w.id === app.ui.worksheet);
  if (!ws || !onPaper(ws) || app.ui.layout) return [];
  const r = app.view.svg.getBoundingClientRect();
  return logoItems(app, ws.id, app.view.camera.toModel([clientX - r.left, clientY - r.top]));
}
