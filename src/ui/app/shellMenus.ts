import type { CommandDef } from '../commandRegistry';
import type { MenuItem } from '../contextMenu';
import type { AppContext } from './context';
import { currentPrompt, type PromptOption } from './prompts';

/** Det menyerna behöver av smartshell. */
export interface ShellMenuContext {
  app: AppContext;
  shown: () => boolean;
  busy: () => boolean;
  last: () => CommandDef | null;
  pending: () => CommandDef | null;
  recent: (keep: (c: CommandDef) => boolean) => CommandDef[];
  run: (c: CommandDef) => void;
  runPending: () => void;
  runOption: (o: PromptOption) => void;
  enterInTool: () => void;
  cancelPending: () => boolean;
  refresh: () => void;
  logOpen: () => boolean;
  toggleLog: () => void;
  openAll: () => void;
  dockItems: () => MenuItem[];
}

/**
 * Smartshells menyer (0.8.21; ur commandLine.ts i 0.10.22.1): de senaste
 * kommandona och frågans alternativ i högerklicksmenyn, och radens egen
 * meny med historiken, alla kommandon och var raden ligger.
 */
export function createShellMenus(c: ShellMenuContext) {
  /**
   * De senaste kommandona för högerklicksmenyn (0.8.21). Med något markerat
   * de som gäller det markerade, annars de andra.
   */
  function recentItems(forSelection: boolean): MenuItem[] {
    const cmds = c.recent((cmd) => (forSelection ? !!cmd.rail : !cmd.rail));
    if (!cmds.length) return [];
    return [
      { kind: 'header', label: 'Senaste kommandon' },
      ...cmds.map((cmd, i): MenuItem => ({ label: cmd.label, hint: i === 0 && cmd === c.last() ? 'Mellanslag' : undefined, run: () => c.run(cmd) })),
      { kind: 'sep' },
    ];
  }

  /** Högerklick medan något pågår: alternativen i frågan, Enter och Avbryt, som i AutoCAD. */
  function promptItems(): MenuItem[] | null {
    if (!c.shown() || !c.busy()) return null;
    const p = currentPrompt(c.app, c.pending(), c.runPending);
    return [
      ...(p ? [{ kind: 'header', label: p.head } as MenuItem] : []),
      // Enter avslutar; finns Avsluta eller Klar bland alternativen räcker de.
      ...(c.app.modifier.busy || p?.options.some((o) => o.label === 'Avsluta' || o.label === 'Klar') ? [] : [{ label: 'Enter', run: () => c.enterInTool() } as MenuItem]),
      ...(p?.options.map((o): MenuItem => ({ label: o.label, hint: o.key, checked: o.on, run: () => c.runOption(o) })) ?? []),
      { kind: 'sep' },
      { label: 'Avbryt', hint: 'Esc', run: () => (c.cancelPending() || c.app.cancelCommand(), c.refresh()) },
    ];
  }

  /** Radens egen meny (högerklick på smartshell). */
  function shellMenu(x: number, y: number): void {
    c.app.ctxMenu.open(
      x,
      y,
      [
        ...recentItems(c.app.selection.size > 0),
        { label: 'Historik', hint: 'F2', checked: c.logOpen(), run: () => c.toggleLog() },
        { label: 'Alla kommandon', run: () => c.openAll() },
        { kind: 'sep' },
        ...c.dockItems(),
      ],
      'Smartshell',
    );
  }

  return { recentItems, promptItems, shellMenu };
}
