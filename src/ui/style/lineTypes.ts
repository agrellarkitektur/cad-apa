import type { StyleBook, StyleResources } from '../../core/graphics';
import { formatDash, LINE_TYPES, newLineTypeId, parseDash } from '../../core/lineTypes';
import { escapeHtml } from '../labels';
import { icons } from '../icons';
import { lineTypeSwatch } from '../lineTypePick';

/**
 * Linjetyperna i stilboken (0.8.30): de inbyggda att se, och projektets
 * egna att lägga till, döpa, ändra och ta bort. `uses` är hur många former
 * och pennor som har varje egen linjetyp, så att det syns vad en borttagning
 * påverkar (de ritas då heldragna).
 */
export function lineTypeSection(style: StyleResources, uses: ReadonlyMap<string, number>): string {
  const builtIn = Object.values(LINE_TYPES)
    .map((t) => `<div class="linetype-row"><span class="linetype-name">${escapeHtml(t.name)}</span>${lineTypeSwatch(t.dash)}<span class="linetype-dash">${t.dash.length ? formatDash(t.dash) : '–'}</span><span aria-hidden="true"></span></div>`)
    .join('');
  const own = (style.lineTypes ?? [])
    .map((t) => {
      const n = uses.get(t.id) ?? 0;
      return `<div class="linetype-row">
      <input type="text" data-linetype="${escapeHtml(t.id)}:name" value="${escapeHtml(t.name)}" aria-label="Namn">
      ${lineTypeSwatch(t.dash)}
      <input type="text" data-linetype="${escapeHtml(t.id)}:dash" value="${formatDash(t.dash)}" aria-label="Mönster" inputmode="decimal" autocomplete="off">
      <button class="icon-btn rc-icon" data-action="linetype-remove" data-linetype-id="${escapeHtml(t.id)}" title="Ta bort. ${n ? `Används av ${n}; de ritas heldragna` : 'Används inte'}" aria-label="Ta bort">${icons.trash}</button>
    </div>`;
    })
    .join('');
  return `<section class="style-labels style-linetypes">
    <h3>Linjetyper</h3>
    <p class="note">Mönstret är streck och mellanrum på papper i mm, omväxlande, och börjar med ett streck; ett streck under 0,5 mm blir en punkt. Mönstret töjs lite så att varje sträcka börjar och slutar med ett helt streck. Egna linjetyper följer med stilboken.</p>
    ${builtIn}
    ${own}
    <button class="btn" data-action="linetype-add">Ny linjetyp</button>
  </section>`;
}

/** Ändra en egen linjetyp i `style` (en kopia) efter fältet; null om fältet inte hör hit. */
export function applyLineTypeField(style: StyleResources, input: HTMLInputElement | HTMLSelectElement): string | null {
  if (!input.dataset.linetype) return null;
  const i = input.dataset.linetype.lastIndexOf(':');
  const id = input.dataset.linetype.slice(0, i);
  const field = input.dataset.linetype.slice(i + 1);
  const t = style.lineTypes?.find((x) => x.id === id);
  if (!t) return null;
  if (field === 'name') {
    const name = input.value.trim();
    if (!name || name === t.name) return null;
    t.name = name;
    return 'Byt namn på linjetyp';
  }
  const dash = parseDash(input.value);
  // Ett mönster som inte går att läsa ändrar ingenting; fältet visar det gamla igen.
  if (!dash) return '';
  t.dash = dash;
  return 'Ändra linjetyp';
}

/** En ny egen linjetyp, streck och punkt. */
export function addLineType(style: StyleResources): void {
  const id = newLineTypeId(style);
  const n = (style.lineTypes?.length ?? 0) + 1;
  (style.lineTypes ??= []).push({ id, name: `Egen linjetyp ${n}`, dash: [4, 1, 1, 1] });
}

/** Ta bort en egen linjetyp; pennorna som hade den blir heldragna. False om den inte fanns. */
export function removeLineType(style: StyleBook, id: string): boolean {
  const i = style.lineTypes?.findIndex((t) => t.id === id) ?? -1;
  if (i < 0) return false;
  style.lineTypes!.splice(i, 1);
  if (!style.lineTypes!.length) delete style.lineTypes;
  // I alla kategoriers pennor (0.10.32).
  for (const c of style.categories) for (const pen of Object.values(c.style.pens ?? {})) if (pen.linetype === id) delete pen.linetype;
  return true;
}
