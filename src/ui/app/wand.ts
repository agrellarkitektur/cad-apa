import { registerWands } from '../wand';
import { wandSupports } from '../wand/wand';
import { WandTool } from '../wand/wandTool';
import type { AppContext } from './context';

/**
 * Smartspöt (0.10.22): Q eller knappen i statusraden slår på det över
 * verktyget man står i (i Markera utan ritverktyg). Byte av verktyg, Esc
 * eller Q igen slår av det. Funktionerna ligger i `src/ui/wand/`.
 */
export function installWand(app: AppContext) {
  registerWands();
  const tool = new WandTool(app);
  let on = false;

  function sync(): void {
    const btn = app.root.querySelector<HTMLElement>('[data-action="wand"]');
    btn?.setAttribute('aria-pressed', String(on));
    const out = app.root.querySelector<HTMLElement>('[data-out="wand"]');
    if (out) out.textContent = on ? 'På' : 'Av';
  }

  function set(next: boolean): void {
    if (next === on) return;
    if (next) {
      if (app.ui.mode === '3d') {
        app.hint('Smartspöt fungerar i planen, sektionerna och fasaderna.');
        return;
      }
      if (app.ui.layout) {
        app.hint('Smartspöt fungerar inte på ritningsbladen än.');
        return;
      }
      if (!wandSupports(app.ui.tool)) {
        app.hint('Smartspöt har inget att göra i det här verktyget än. Det finns i Markera, Vägg, Bjälklag, Tak, Mark, 2D, Littera och Mått.', 4000);
        return;
      }
      app.modifier.cancel();
      app.smartMenu.hide();
      on = true;
      tool.reset();
      app.view.setTool(tool);
      app.hint(HINTS[app.ui.tool] ?? 'Smartspöt: peka och klicka. Tab växlar förslag, Esc stänger.', 5000);
    } else {
      on = false;
      tool.reset();
      app.view.setTool(app.toolFor(app.ui.tool));
    }
    sync();
    app.view.requestRender();
  }

  return {
    get active() {
      return on;
    },
    tool,
    set,
    toggle: () => set(!on),
    /** Slå av utan att byta verktyg i vyn (verktyget byts ändå). */
    dropped(): void {
      on = false;
      tool.reset();
      sync();
    },
    cycle: (back: boolean) => on && tool.cycle(back),
    flush: () => on && tool.flush(),
  };
}

const HINTS: Record<string, string> = {
  select: 'Smartspöt: klicka på ett objekt för allt som hänger ihop med det; Tab för allt av samma sort i vyn, Shift lägger till.',
  wall: 'Smartspöt: peka på en kant (bjälklag, markobjekt, linje, underlag …) och klicka för väggar runt konturen; Tab för bara sidan. Shift samlar fler.',
  ground: 'Smartspöt: peka på en kant för en stödmur (eller brytlinje, låglinje, väg) längs sidan; Tab för hela konturen. Med Markyta: klicka i huset, en form eller mellan linjer.',
  draw2d: 'Smartspöt: peka på en kant för en linje längs den, eller klicka i en yta (snittyta, objekt, yta mellan linjer) för en form runt den.',
  slab: 'Smartspöt: klicka i ett rum för ett bjälklag innanför väggarna, eller i ett tak eller en form för ett bjälklag med dess kontur. Tab växlar.',
  roof: 'Smartspöt: klicka i huset eller ett bjälklag för ett tak över det, med takfoten utanför. Takfallets takfot hamnar vid kanten närmast.',
  label: 'Smartspöt: klicka på ett objekt för en littera med verktygets text. Shift samlar fler.',
  dimension: 'Smartspöt: klicka på en vägg för en måttkedja över öppningarna och de anslutande väggarna; Tab för andra sidan.',
};
