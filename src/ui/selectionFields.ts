import type { Element, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import { createContext } from '../repr/context';
import { allTypes, resolveParams, typeOf } from '../elements/registry';
import type { WallParams } from '../elements/wall';
import { dist } from '../geometry/vec';
import { isFixed, type FurnitureParams } from '../elements/furniture';
import { dimensionSegments, type DimensionParams } from '../elements/annotation';
import { EXTERIOR_INSET, FRAME_DEFAULTS } from '../elements/opening';
import { numberingOf, roomNumbersFor, type SpaceParams } from '../elements/rooms';
import { faceChoices, faceOf, outsideSide } from '../elements/wallSides';
import { escapeHtml, PARAM_LABELS } from './labels';
import { markerFrame, markerName, type MarkerParams, type NorthParams } from '../elements/markers';
import type { RoofParams } from '../elements/roof';
import { radiusOf } from '../geometry/arc';
import { drawingFields } from './drawingPanel';

/**
 * Fälten i egenskapspanelen (0.8.1, ur propertiesPanel.ts): det markerade
 * objektets egna mått, egna egenskaper, det som gäller hela typen eller
 * projektet, och typtabellen. Bara HTML; ändringarna görs i
 * selectionEdits.ts när fälten ändras.
 */

/** Egenskapsgruppen där egna egenskaper sparas. */
export const PROPS = 'Egenskaper';

/** Egna egenskaper: objektets egna värden, med typens värden som förslag. */
export function propsSection(doc: ProjectDoc, el: Element): string {
  const def = el.definition ? doc.definitions[el.definition] : undefined;
  const own = el.props[PROPS] ?? {};
  const shared = def?.props[PROPS] ?? {};
  const names = [...new Set([...Object.keys(shared), ...Object.keys(own)])];
  const rows = names
    .map(
      (n) => `<label class="field"><span>${escapeHtml(n)}</span><input data-key="prop:${escapeHtml(n)}" value="${escapeHtml(String(own[n] ?? ''))}" placeholder="${escapeHtml(String(shared[n] ?? ''))}"></label>`,
    )
    .join('');
  return `<section>
    <h3>Egenskaper</h3>
    ${rows ? `<div class="fields">${rows}</div>` : '<p class="note">Inga egna egenskaper än. Lägg till t.ex. brandklass eller ljudklass; de kan visas i litterat och i förteckningarna.</p>'}
    <div class="row"><input id="new-prop" placeholder="Ny egenskap, t.ex. Brandklass" aria-label="Ny egenskap"><button class="btn" data-action="add-prop">Lägg till</button></div>
    ${def ? '<p class="note">Ett tomt fält visar typens värde.</p>' : ''}
  </section>`;
}

/** Inställningar som gäller hela typen eller hela projektet. */
export function sharedSection(doc: ProjectDoc, els: Element[]): string | null {
  const parts: string[] = [];
  const t = typeOf(els[0].type);
  const sameDef = els.every((e) => e.definition && e.definition === els[0].definition) ? els[0].definition : undefined;
  if (sameDef && t?.typeParams?.length) {
    const def = doc.definitions[sameDef];
    const users = Object.values(doc.elements).filter((e) => e.definition === sameDef).length;
    const props = def.props[PROPS] ?? {};
    const propRows = Object.keys(props)
      .map((n) => `<label class="field"><span>${escapeHtml(n)}</span><input data-key="defprop:${escapeHtml(n)}" value="${escapeHtml(String(props[n] ?? ''))}"></label>`)
      .join('');
    parts.push(`<div class="shared-block">
      <div class="shared-head">Typen ${escapeHtml(def.name)} <span>gäller alla ${users} ${users === 1 ? t.label.toLowerCase() : t.labelPlural.toLowerCase()}</span></div>
      <div class="fields">${t.typeParams.map((k) => numberField(`def:${k}`, PARAM_LABELS[k] ?? k, Number(def.params[k] ?? 0), 'mm')).join('')}${propRows}</div>
      <div class="row"><input id="new-defprop" placeholder="Ny egenskap för typen" aria-label="Ny egenskap för typen"><button class="btn" data-action="add-defprop">Lägg till</button></div>
    </div>`);
  }
  if (els.length === 1 && els[0].type === 'Space') {
    const numbering = numberingOf(doc);
    parts.push(`<div class="shared-block">
      <div class="shared-head">Rumsnumrering <span>gäller hela projektet</span></div>
      <div class="row wrap">
        <label class="check"><input type="checkbox" data-key="numbering:locked"${numbering.locked ? ' checked' : ''}> Lås numreringen</label>
        <label class="check">Siffror <select data-key="numbering:digits"><option value="4"${numbering.digits === 4 ? ' selected' : ''}>4 (1101)</option><option value="3"${numbering.digits === 3 ? ' selected' : ''}>3 (101)</option></select></label>
        ${numbering.digits === 4 ? `<label class="check">Byggnad <input data-key="numbering:building" value="${escapeHtml(numbering.building)}" style="width:44px"></label>` : ''}
      </div>
      <p class="note">${numbering.locked ? 'Numren ligger fast. Nya rum får nästa lediga nummer.' : 'Numren räknas i vänstervarv från entrén, som när man följer vänster vägg, och ändras när rum tillkommer.'}</p>
    </div>`);
  }
  if (els.length === 1 && els[0].type === 'Door') {
    const locked = !!doc.project.doorNumbering?.locked;
    parts.push(`<div class="shared-block">
      <div class="shared-head">Dörrnumrering <span>gäller hela projektet</span></div>
      <label class="check"><input type="checkbox" data-key="doornumbering:locked"${locked ? ' checked' : ''}> Lås dörrnumren</label>
      <p class="note">Dörrarna får nummer som rummen, D + byggnad + plan + löpnummer (D1203), i den ordning man passerar dem i vänstervarvet. Ett eget nummer i fältet Nummer går före.</p>
    </div>`);
  }
  if (!parts.length) return null;
  return `<section class="shared"><h3>Påverkar fler objekt</h3>${parts.join('')}</section>`;
}

/** Objektets egna mått och val, efter elementtyp. */
export function instanceFields(doc: ProjectDoc, el: Element, view: ViewStates): string {
  switch (el.type) {
    case 'Wall': {
      const p = resolveParams<WallParams>(doc, el);
      const length = Math.round(dist(p.start, p.end));
      const current = faceOf(doc, el).face;
      const just = faceChoices(doc, el)
        .map((c) => `<button data-action="justify" data-value="${c.face}" aria-pressed="${c.face === current}">${c.label}</button>`)
        .join('');
      const arc = p.bulge && Math.abs(p.bulge) >= 0.5 ? radiusOf(p.start, p.end, p.bulge) : 0;
      return `<div class="fields">${numberField('wall:length', arc ? 'Korda' : 'Längd', length, 'mm')}${numberField('param:height', 'Höjd', p.height, 'mm')}${arc ? numberField('wall:radius', 'Radie', arc, 'mm') : ''}</div>
        <label class="check"><input type="checkbox" data-key="param:toRoof"${p.toRoof ? ' checked' : ''}> Upp till taket (gavlar)</label>
        <div class="field-label">Referenslinje</div><div class="segmented wide" role="group">${just}</div>`;
    }
    case 'Roof': {
      const p = resolveParams<RoofParams>(doc, el);
      return `<label class="field"><span>Taktyp</span><select data-key="roof:kind"><option value="gable"${p.kind === 'gable' ? ' selected' : ''}>Sadeltak</option><option value="shed"${p.kind === 'shed' ? ' selected' : ''}>Pulpettak</option></select></label>
        <div class="fields">${numberField('param:slope', 'Lutning', p.slope, '°')}${numberField('param:eave', 'Takfot', p.eave, 'mm')}${numberField('param:thickness', 'Tjocklek', p.thickness, 'mm')}${numberField('param:ridge', p.kind === 'shed' ? 'Takfotens riktning' : 'Nockriktning', p.ridge, '°')}</div>
        <p class="note">Takfoten är undersidans höjd vid takets kant. Väggar under taket kapas av det; kryssa i Upp till taket på gavlarna.</p>`;
    }
    case 'North': {
      const p = resolveParams<NorthParams>(doc, el);
      return `<div class="fields">${numberField('param:angle', 'Norr', p.angle, '°')}</div>
        <p class="note">Riktningen mot norr, moturs från planens x-axel: 90° är rakt upp. Fasaderna namnges efter närmaste väderstreck.</p>`;
    }
    case 'Section':
    case 'Elevation': {
      const p = resolveParams<MarkerParams>(doc, el);
      const label = el.type === 'Section' ? textField('text:label', 'Beteckning', p.label ?? 'A') : '';
      // En linje som följer byggnaden visar var den ligger just nu; ändras den placeras den för hand (0.8).
      const f = markerFrame(doc, el);
      const shown: MarkerParams = p.auto ? { ...p, start: [f.start[0], f.start[1]], end: [f.end[0], f.end[1]], side: 1 } : p;
      const canFollow = !p.auto && el.type === 'Elevation' && typeof p.facing === 'number';
      return `<label class="field"><span>Namn</span><input data-key="name:" value="${escapeHtml(el.name ?? '')}" placeholder="${escapeHtml(markerName(doc, { ...el, name: undefined }))}"></label>
        <div class="fields">${label}<label class="field"><span>Djup</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" data-key="marker:depth" value="${p.depth ?? ''}" placeholder="Allt"><i>mm</i></span></label></div>
        ${markerLineFields(shown)}
        <div class="row"><button class="btn btn-primary" data-action="open-marker">Öppna ${el.type === 'Section' ? 'sektionen' : 'fasaden'}</button><button class="btn" data-action="flip-side">Vänd blickriktningen</button>${canFollow ? '<button class="btn" data-action="follow-building" title="Lägg fasaden runt byggnaden igen, så att den följer med när byggnaden ändras">Följ byggnaden igen</button>' : ''}</div>`;
    }
    case 'Line2D':
    case 'Fill2D':
    case 'RoofSlope':
    case 'Underlay':
      return drawingFields(doc, el);
    case 'Door': {
      const p = resolveParams<{ at: number; glazed?: boolean; mainEntrance?: boolean }>(doc, el);
      return `<div class="fields">${numberField('param:at', 'Läge längs vägg', p.at, 'mm')}${textField('name', 'Nummer', el.name ?? '')}</div>
        ${frameFields(doc, el, true)}
        <label class="check"><input type="checkbox" data-key="param:glazed"${p.glazed ? ' checked' : ''}> Glasad dörr</label>
        <label class="check"><input type="checkbox" data-key="param:mainEntrance"${p.mainEntrance ? ' checked' : ''}> Huvudentré (rum och dörrar numreras härifrån)</label>`;
    }
    case 'Window': {
      const p = resolveParams<{ at: number; sill: number }>(doc, el);
      return `<div class="fields">${numberField('param:at', 'Läge längs vägg', p.at, 'mm')}${numberField('param:sill', 'Bröstning', p.sill, 'mm')}${textField('name', 'Nummer', el.name ?? '')}</div>
        ${frameFields(doc, el, false)}`;
    }
    case 'Furniture': {
      const p = resolveParams<FurnitureParams>(doc, el);
      return `<div class="fields">${textField('name', 'Namn', el.name ?? '')}</div>
        <label class="check"><input type="checkbox" data-key="param:fixed"${isFixed(p) ? ' checked' : ''}> Fast inredning (svart linje, annars utgråad)</label>`;
    }
    case 'Space': {
      const p = resolveParams<SpaceParams>(doc, el);
      const numbering = numberingOf(doc);
      const { ctx } = createContext(doc, el.storey, view, doc.graphics, () => true);
      const number = roomNumbersFor(ctx).get(el.id) ?? '';
      const numberField = numbering.locked
        ? `<label class="field" for="f-param-number"><span>Rumsnummer</span><input id="f-param-number" data-key="text:number" value="${escapeHtml(p.number ?? number)}"></label>`
        : `<label class="field"><span>Rumsnummer</span><input value="${escapeHtml(number)}" readonly title="Räknas automatiskt. Lås numreringen för att ändra själv."></label>`;
      return `<div class="fields">${textField('name', 'Namn', el.name ?? '')}${numberField}
          <label class="field" for="f-param-ceilingHeight"><span>Takhöjd (TH)</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" id="f-param-ceilingHeight" data-key="param:ceilingHeight" value="${p.ceilingHeight ?? ''}" placeholder="Visas inte"><i>mm</i></span></label></div>
`;
    }
    case 'Dimension': {
      const p = resolveParams<DimensionParams>(doc, el);
      const segs = dimensionSegments(doc, p);
      const linked = p.points.some((q) => !Array.isArray(q));
      return `<div class="fields">${segs.map((sg, k) => numberField(`dimseg:${k}`, segs.length > 1 ? `Mått ${k + 1}` : 'Mått', sg.value, 'mm')).join('')}</div>
        <p class="note">${linked ? 'Måttet följer väggar och öppningar. Skriv ett nytt värde så flyttas det som måttet pekar på.' : 'Fritt mått. Skriv ett nytt värde så flyttas måttpunkten.'}</p>`;
    }
    case 'Text': {
      const p = resolveParams<{ text: string; height: number; angle: number }>(doc, el);
      return `<label class="field" for="f-text-text"><span>Text</span><textarea id="f-text-text" data-key="text:text" rows="2">${escapeHtml(p.text)}</textarea></label>
        <div class="fields">${numberField('param:height', 'Texthöjd på papper', p.height, 'mm', 2)}${numberField('param:angle', 'Vridning', p.angle, '°')}</div>`;
    }
    default:
      return '';
  }
}

/** Karmens mått och indraget. Tomt indrag betyder automatiskt. */
function frameFields(doc: ProjectDoc, el: Element, isDoor: boolean): string {
  const p = resolveParams<{ frameWidth: number; frameDepth: number; inset: number | null }>(doc, el);
  const host = el.host ? doc.elements[el.host] : undefined;
  const exterior = host ? outsideSide(doc, host) !== null : false;
  const from = exterior ? 'från utsida' : isDoor ? 'från öppningssida' : '';
  const auto = exterior ? EXTERIOR_INSET : 0;
  const inset =
    exterior || isDoor
      ? `<label class="field" for="f-param-inset"><span>Indrag ${from}</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" id="f-param-inset" data-key="param:inset" value="${p.inset ?? ''}" placeholder="Auto ${auto}"><i>mm</i></span></label>`
      : '';
  return `<div class="fields">${numberField('param:frameWidth', 'Karmbredd', p.frameWidth ?? FRAME_DEFAULTS.frameWidth, 'mm')}${numberField('param:frameDepth', 'Karmdjup', p.frameDepth ?? FRAME_DEFAULTS.frameDepth, 'mm')}${inset}</div>`;
}

/** Längd och vinkel för en linje som placerats för hand, och knappen för att rikta den efter något. */
function markerLineFields(p: MarkerParams): string {
  const d = [p.end[0] - p.start[0], p.end[1] - p.start[1]];
  const len = Math.round(Math.hypot(d[0], d[1]));
  const a = (((Math.atan2(d[1], d[0]) * 180) / Math.PI) % 360 + 360) % 360;
  const deg = Math.round(a * 100) / 100;
  return `<div class="fields">${numberField('marker:length', 'Längd', len, 'mm')}${numberField('marker:angle', 'Vinkel', deg, '°', 2)}</div>
    <div class="row"><button class="btn" data-action="align-marker" title="Klicka sedan på en vägg eller linje i planen. Linjen blir parallell med den. Håll Shift för vinkelrät.">Rikta efter objekt</button></div>`;
}

/** Fliken Typer: varje elementtyp med littera och typens gemensamma mått. */
export function typesMarkup(doc: ProjectDoc): string {
  const groups = allTypes().filter((t) => t.typeParams?.length);
  return groups
    .map((t) => {
      const defs = Object.values(doc.definitions)
        .filter((d) => d.elementType === t.type)
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
      const rows = defs
        .map((d) => {
          const users = Object.values(doc.elements).filter((e) => e.definition === d.id).length;
          const params = t.typeParams!.map(
            (k) =>
              `<td><input type="text" data-expr inputmode="decimal" autocomplete="off" id="tp-${d.id}-${k}" data-def="${d.id}" data-param="${k}" value="${Number(d.params[k] ?? 0)}" aria-label="${PARAM_LABELS[k] ?? k} för ${escapeHtml(d.name)}"></td>`,
          );
          return `<tr>
            <td><input class="littera" id="tl-${d.id}" data-def="${d.id}" data-field="name" value="${escapeHtml(d.name)}" aria-label="Littera"></td>
            ${params.join('')}
            <td class="count">${users}</td>
            <td>${users === 0 ? `<button class="icon-mini" data-action="delete-def" data-def="${d.id}" aria-label="Ta bort ${escapeHtml(d.name)}">×</button>` : ''}</td>
          </tr>
          <tr class="desc-row"><td colspan="${t.typeParams!.length + 3}"><input id="td-${d.id}" data-def="${d.id}" data-field="description" value="${escapeHtml(d.description ?? '')}" placeholder="Beskrivning, t.ex. uppbyggnad" aria-label="Beskrivning för ${escapeHtml(d.name)}"></td></tr>`;
        })
        .join('');
      const head = t.typeParams!.map((k) => `<th>${PARAM_LABELS[k] ?? k}</th>`).join('');
      return `<section>
        <h3>${t.label}typer</h3>
        <table class="type-table"><thead><tr><th>Littera</th>${head}<th>Antal</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <button class="btn" data-action="add-def" data-type="${t.type}">Ny ${t.label.toLowerCase()}typ</button>
      </section>`;
    })
    .join('')
    .concat('<p class="note pad">Mått i mm. Ändras ett mått ändras alla objekt av typen.</p>');
}

/**
 * Sifferfält. Mått i modellen visas i hela mm; mått på papper för
 * annotering (texthöjder) med två decimaler, `decimals = 2`.
 */
export function numberField(key: string, label: string, value: number, unit: string, decimals = 0): string {
  const id = `f-${key.replace(':', '-')}`;
  const shown = decimals > 0 ? Number(value).toFixed(decimals) : String(Math.round(value));
  const exprUnit = unit === '°' ? 'deg' : unit === 'mm' ? 'mm' : '';
  const step = decimals > 0 ? (1 / 10 ** decimals).toFixed(decimals) : '1';
  return `<label class="field" for="${id}"><span>${label}</span><span class="input-unit"><input type="text" data-expr data-unit="${exprUnit}" data-step="${step}" inputmode="decimal" autocomplete="off" id="${id}" data-key="${key}" value="${shown}"><i>${unit}</i></span></label>`;
}

export function textField(key: string, label: string, value: string): string {
  return `<label class="field" for="f-${key}"><span>${label}</span><input id="f-${key}" data-key="${key}" value="${escapeHtml(value)}"></label>`;
}

/** Typerna i en blandad markering: "2 väggar, 1 dörr". */
export function summarizeTypes(els: Element[]): string {
  const counts = new Map<string, number>();
  for (const e of els) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, n]) => {
      const t = typeOf(type);
      return `${n} ${(n === 1 ? t?.label : t?.labelPlural)?.toLowerCase() ?? type}`;
    })
    .join(', ');
}
