import { defaultSheet } from '../core/viewCategories';
import type { Element, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import { createContext } from '../repr/context';
import { resolveParams } from '../elements/registry';
import { markerFrame, markerName, type MarkerHeights, type MarkerParams, type NorthParams } from '../elements/markers';
import { markerHeights } from '../repr/sectionLevels';
import { buildingHeight } from '../repr/buildingHeight';
import { defaultMarkerPen } from '../repr/markerPens';
import { escapeHtml } from './labels';
import { weightPicker } from './weightPick';
import { lineTypeOptions } from './lineTypePick';
import { toHex } from './style/colors';
import { numberField, textField } from './fieldMarkup';

/**
 * Egenskaperna för markörerna (granskningen efter 0.10.12, förut i
 * `selectionFields.ts`): norrpilen, linjen *Beräkningsgrundande fasad* och
 * sektionens och fasadens vy (namn, djup, höjder) och markör (läge och
 * stil). Bara HTML; ändringarna görs i `selectionEdits.ts`.
 */

/** Vyns fält för en sektion eller fasad, och norrpilens och den beräkningsgrundande fasadens. */
export function markerViewFields(doc: ProjectDoc, el: Element, view: ViewStates): string {
  switch (el.type) {
    case 'North': {
      const p = resolveParams<NorthParams>(doc, el);
      return `<div class="fields">${numberField('param:angle', 'Norr', p.angle, '°')}</div>
        <p class="note">Riktningen mot norr, moturs från planens x-axel: 90° är rakt upp. Fasaderna namnges efter närmaste väderstreck.</p>`;
    }
    case 'BasisFacade':
      return `<p class="note">Byggnadshöjden mäts mot fasaden som linjen ligger på (inom 1,5 m och 15°). Dra ändarna för att flytta den. Det finns bara en i projektet; rita en ny med Fasad, Beräkningsgrundande fasad.</p>`;
    case 'Section':
    case 'Elevation': {
      // Vyn: namn, djup, höjder. Markörens läge och stil står i en egen del, *Markör* (0.10.12).
      const p = resolveParams<MarkerParams>(doc, el);
      const canFollow = !p.auto && el.type === 'Elevation' && typeof p.facing === 'number';
      return `<label class="field"><span>Namn</span><input data-key="name:" value="${escapeHtml(el.name ?? '')}" placeholder="${escapeHtml(markerName(doc, { ...el, name: undefined }))}"></label>
        <div class="fields"><label class="field"><span>Djup</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" data-key="marker:depth" value="${p.depth ?? ''}" placeholder="Allt"><i>mm</i></span></label><label class="field" title="Det som ligger längre bort från linjen än så ritas med tunn grå linje"><span>Tonat från</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" data-key="marker:toneDepth" value="${p.toneDepth ?? ''}" placeholder="Inget"><i>mm</i></span></label></div>
        ${markerHeightFields(doc, el, view)}
        <div class="row"><button class="btn btn-primary" data-action="open-marker">Öppna ${el.type === 'Section' ? 'sektionen' : 'fasaden'}</button>${canFollow ? '<button class="btn" data-action="follow-building" title="Lägg fasaden runt byggnaden igen, så att den följer med när byggnaden ändras">Följ byggnaden igen</button>' : ''}</div>`;
    }
    default:
      return '';
  }
}

/**
 * Markören (0.10.12): beteckningen, läget och stilen, för sig från vyn.
 * Pennan är stilbokens för den sortens markör och gäller alla i projektet.
 */
export function markerSection(doc: ProjectDoc, el: Element, lock: string): string {
  if (el.type !== 'Section' && el.type !== 'Elevation') return '';
  const p = resolveParams<MarkerParams>(doc, el);
  // En linje som följer byggnaden visar var den ligger just nu; ändras den placeras den för hand (0.8).
  const f = markerFrame(doc, el);
  const shown: MarkerParams = p.auto ? { ...p, start: [f.start[0], f.start[1]], end: [f.end[0], f.end[1]], side: 1 } : p;
  const isSection = el.type === 'Section';
  const key = isSection ? 'sectionLine' : 'elevationLine';
  const own = defaultSheet(doc.graphics).pens?.[key];
  const weight = own?.weight ?? defaultMarkerPen(key).weight;
  return `<section><h3>Markör</h3>
    ${isSection ? `<div class="fields">${textField('text:label', 'Beteckning', p.label ?? 'A')}</div>` : ''}
    ${markerLineFields(shown)}
    <div class="fields marker-pen">
      <div class="field pen-weight"><span>Tjocklek</span>${weightPicker(`mpen-${el.id}`, weight, `data-pen="${key}:weight"`, ' mm')}</div>
      <label class="field"><span>Färg</span><input type="color" data-pen="${key}:color" value="${toHex(own?.color ?? 'ink')}"></label>
      <label class="field"><span>Linjetyp</span><select data-pen="${key}:linetype">${lineTypeOptions(doc.graphics, own?.linetype)}</select></label>
    </div>
    <p class="note">Pennan gäller alla ${isSection ? 'sektionsmarkörer' : 'fasadmarkörer'} i projektet (stilbokens pennor, i alla kategorier).</p>
    ${lock}
  </section>`;
}

/** Längd och vinkel för en linje som placerats för hand, och knappen för att rikta den efter något. */
function markerLineFields(p: MarkerParams): string {
  const d = [p.end[0] - p.start[0], p.end[1] - p.start[1]];
  const len = Math.round(Math.hypot(d[0], d[1]));
  const a = (((Math.atan2(d[1], d[0]) * 180) / Math.PI) % 360 + 360) % 360;
  const deg = Math.round(a * 100) / 100;
  return `<div class="fields">${numberField('marker:length', 'Längd', len, 'mm')}${numberField('marker:angle', 'Vinkel', deg, '°', 2)}</div>
    <div class="row"><button class="btn" data-action="align-marker" title="Klicka sedan på en vägg eller linje i planen. Linjen blir parallell med den. Håll Shift för vinkelrät.">Rikta efter objekt</button><button class="btn" data-action="flip-side">Vänd blickriktningen</button></div>`;
}

/**
 * Höjderna som fasaden eller sektionen visar (0.10.8b): kryssrutor med
 * förvalet ikryssat (byggnadshöjden i fasaden mot den beräkningsgrundande).
 */
function markerHeightFields(doc: ProjectDoc, el: Element, view: ViewStates): string {
  const { ctx } = createContext(doc, doc.storeys[0].id, view, defaultSheet(doc.graphics), () => true);
  const bh = buildingHeight(ctx);
  const h = markerHeights(el, markerFrame(doc, el).view, bh);
  const box = (k: keyof MarkerHeights, label: string, title: string) =>
    `<label class="check" title="${escapeHtml(title)}"><input type="checkbox" data-key="marker:heights.${k}"${h[k] ? ' checked' : ''}> ${label}</label>`;
  return `<div>
      ${box('bh', 'Byggnadshöjd (BH)', 'Nivåmarkör och mått från medelmarknivån till byggnadshöjden mot den beräkningsgrundande fasaden')}
      ${box('nh', 'Nockhöjd (NH)', 'Mått från medelmarknivån till takets högsta punkt')}
      ${box('th', 'Totalhöjd (TH)', 'Mått från medelmarknivån till husets högsta punkt')}
      ${box('mmnOld', 'Medelmarknivå, befintlig mark', 'Nivåmarkör för den befintliga markens medelmarknivå bredvid den nya')}
    </div>${bh ? '<p class="note">Måtten dras i sidled i fasaden eller sektionen, i rutan i överänden.</p>' : '<p class="note">Höjderna visas när huset har tak.</p>'}`;
}
