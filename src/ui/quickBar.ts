import type { Element, ProjectDoc } from '../core/model';
import { moveOnly } from '../core/sheets';
import { existingState, type ViewStates } from '../core/states';
import { isClosed, type Shape2DParams } from '../elements/drawing2d';
import { resolveParams, typeOf } from '../elements/registry';
import { faceOf } from '../elements/wallSides';
import { icons } from './icons';
import { escapeHtml } from './labels';
import { QUICK_ACTIONS, type QuickId } from './uiSettings';

/**
 * Snabbradens knappar (Vänd slag, Vrid 90°, Riv, Ta bort …) för det som är
 * markerat, i panelen och i smartmenyn. Utbrutet ur propertiesPanel.ts i
 * 0.8.27; vad knapparna gör står kvar där (`onClick`).
 */

/** Längre förklaringar till snabbknapparna, som visas vid hovring. */
const QUICK_TITLES: Record<string, string> = {
  'flip-swing': 'Vänd slag: dörren öppnas åt andra sidan väggen',
  'flip-hinge': 'Byt hängning: gångjärnen flyttas till andra sidan dörren',
  'toggle-glazed': 'Glasad dörr av eller på',
  'cycle-ref': 'Referenslinje: byt mellan utsida, center och insida',
  'flip-wall': 'Vänd väggen: insidan byter sida, väggen ligger kvar',
  'rotate-90': 'Vrid 90° moturs kring mitten',
  mirror: 'Spegla i en lodrät linje genom mitten',
  copy: 'Kopiera på samma ställe; flytta sedan kopian',
  demolish: 'Riv i det här förslaget (finns kvar i Befintligt)',
  restore: 'Behåll: ångra rivningen i det här förslaget',
  'zoom-selection': 'Zooma till det markerade',
  'continue-line': 'Fortsätt: rita vidare från en ände av linjen',
  'open-marker': 'Öppna fasaden eller sektionen',
  delete: 'Ta bort helt, ur alla tillstånd (Delete)',
  'smart-more': 'Visa alla inställningar här i smartmenyn',
  'smart-less': 'Visa bara snabbknapparna',
  deselect: 'Avmarkera (Esc)',
};

/** En knapp i snabbraden. */
export function quickButton(action: string, icon: string, label: string, extra = ''): string {
  return `<button class="qb-btn${extra}" data-action="${action}" title="${escapeHtml(QUICK_TITLES[action] ?? label)}">${icon}<span>${escapeHtml(label)}</span></button>`;
}

/**
 * Knapparna för de markerade elementen, i den ordning `quickFor` ger för
 * sorten ("mixed" när de är olika). `viewports` är sant när vyer på ett blad
 * är markerade.
 */
export function quickButtons(doc: ProjectDoc, els: Element[], viewports: boolean, view: ViewStates, quickFor: (type: string) => QuickId[]): string[] {
  const sameType = els.length > 0 && els.every((e) => e.type === els[0].type);
  const kind = sameType && !viewports ? els[0].type : 'mixed';
  // Vyer på ett blad (0.8.9) går att flytta och ta bort, inte vrida, spegla eller kopiera; skalstockar och stämplar likaså (0.8.12).
  const fixedShape = els.some((e) => moveOnly(doc, e.id));
  const allowed = (id: QuickId, k: string) => {
    const a = QUICK_ACTIONS.find((q) => q.id === id);
    return !viewports && !fixedShape && !!a && (a.types === 'all' || a.types.includes(k));
  };
  const buttons: string[] = [];
  // Rita vidare (0.8.28): en ensam öppen linje eller spline.
  if (kind === 'Shape2D' && els.length === 1 && !fixedShape) {
    const q = resolveParams<Shape2DParams>(doc, els[0]);
    if ((q.shape === 'polyline' || q.shape === 'spline') && q.points.length >= 2 && !isClosed(q)) buttons.push(quickButton('continue-line', icons.draw2d, 'Fortsätt'));
  }
  for (const id of quickFor(kind)) {
    switch (id) {
      case 'flip-swing':
        if (kind === 'Door') buttons.push(quickButton('flip-swing', icons.flipSwing, 'Vänd slag'));
        break;
      case 'flip-hinge':
        if (kind === 'Door') buttons.push(quickButton('flip-hinge', icons.flipHinge, 'Hängning'));
        break;
      case 'toggle-glazed':
        if (kind === 'Door') {
          const on = els.every((e) => resolveParams<{ glazed?: boolean }>(doc, e).glazed);
          buttons.push(quickButton('toggle-glazed', icons.glazed, 'Glasad', on ? ' on' : ''));
        }
        break;
      case 'cycle-ref':
        if (kind === 'Wall') {
          const faces = new Set(els.map((e) => faceOf(doc, e).label));
          buttons.push(quickButton('cycle-ref', icons.refLine, faces.size === 1 ? [...faces][0] : 'Referens'));
        }
        break;
      case 'rotate-90':
        if (allowed(id, kind)) buttons.push(quickButton('rotate-90', icons.rotate, 'Vrid 90°'));
        break;
      case 'mirror':
        if (allowed(id, kind)) buttons.push(quickButton('mirror', icons.mirror, 'Spegla'));
        break;
      case 'copy':
        if (allowed(id, kind)) buttons.push(quickButton('copy', icons.copy, 'Kopiera'));
        break;
      case 'flip-wall':
        if (kind === 'Wall') buttons.push(quickButton('flip-wall', icons.flipWall, 'Vänd väggen'));
        break;
      case 'demolish': {
        // Riva eller behålla: bara för sådant som finns i Befintligt, när man tittar på ett förslag.
          const ex = existingState(doc);
        if (!viewports && ex && ex.id !== view.state && els.every((e) => e.states.includes(ex.id) && typeOf(e.type)?.compares)) {
          if (els.every((e) => e.states.includes(view.state))) buttons.push(quickButton('demolish', icons.demolish, 'Riv'));
          else if (els.every((e) => !e.states.includes(view.state))) buttons.push(quickButton('restore', icons.restore, 'Behåll'));
        }
        break;
      }
      case 'zoom-selection':
        buttons.push(quickButton('zoom-selection', icons.zoomIn, 'Zooma till'));
        break;
      case 'open-marker':
        if (els.length === 1 && allowed(id, kind)) buttons.push(quickButton('open-marker', icons.elevation, 'Öppna'));
        break;
      case 'delete':
        buttons.push(quickButton('delete', icons.trash, 'Ta bort', ' danger'));
        break;
    }
  }
  return buttons;
}
