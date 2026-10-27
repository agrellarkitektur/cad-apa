import { groundFieldsMarkup } from './groundFields';
import type { Element, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import { createContext } from '../repr/context';
import { allTypes, resolveParams, typeOf } from '../elements/registry';
import type { WallParams } from '../elements/wall';
import { dist } from '../geometry/vec';
import { isFixed, type FurnitureParams } from '../elements/furniture';
import { EXTERIOR_INSET, FRAME_DEFAULTS } from '../elements/opening';
import { numberingOf, roomNumbersFor, type SpaceParams } from '../elements/rooms';
import { faceChoices, faceOf, outsideSide } from '../elements/wallSides';
import { escapeHtml, PARAM_LABELS } from './labels';
import { refArc, type RoofParams } from '../elements/roof';
import { holeRing, type SlabParams } from '../elements/slab';
import { radiusOf } from '../geometry/arc';
import { drawingFields } from './drawingPanel';
import { fillFields } from './shapeFields';
import { typePenFields } from './ownPenFields';
import { annotationFields } from './annotationFields';
import { markerViewFields } from './markerFields';
import { numberField, textField } from './fieldMarkup';
import { levelOf } from '../repr/solids';

export { markerSection } from './markerFields';
export { numberField, textField } from './fieldMarkup';

/**
 * Fälten i egenskapspanelen (0.8.1, ur propertiesPanel.ts): det markerade
 * objektets egna mått, egna egenskaper, det som gäller hela typen eller
 * projektet, och typtabellen. Bara HTML; ändringarna görs i
 * selectionEdits.ts när fälten ändras. Markörernas fält står i
 * `markerFields.ts`, måttens, textens, skalstockens och stämpelns i
 * `annotationFields.ts` (granskningen efter 0.10.12).
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
      ${typePenFields(doc, def)}
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
      return `<div class="fields">${numberField('wall:length', arc ? 'Korda' : 'Längd', length, 'mm')}${numberField('param:height', 'Höjd', p.height, 'mm')}${numberField('level:level', 'Fot mot våningen', levelOf(p), 'mm')}${arc ? numberField('wall:radius', 'Radie', arc, 'mm') : ''}</div>
        <label class="check" title="Utan egen höjd följer väggen våningshöjden"><input type="checkbox" data-key="wall:storeyHeight"${typeof el.params.height === 'number' ? '' : ' checked'}> Våningshöjd</label>
        <label class="check"><input type="checkbox" data-key="param:toRoof"${p.toRoof ? ' checked' : ''}> Upp till taket (gavlar)</label>
        <div class="field-label">Referenslinje</div><div class="segmented wide" role="group">${just}</div>
        <p class="note">Fot mot våningen flyttar bara foten; toppen ligger kvar. Flytta i höjd (Modifiera) flyttar hela väggen.</p>`;
    }
    case 'Roof': {
      const p = resolveParams<RoofParams>(doc, el);
      const arc = refArc(p);
      // Positiv radie: taket stiger mot bågens centrum.
      const radius = arc ? Math.round(arc.radius) * (arc.sigma < 0 ? 1 : -1) : 0;
      return `<div class="fields">${numberField('param:height', 'Höjd', p.height, 'mm')}${numberField('param:slope', 'Lutning', p.slope, '°')}${numberField('param:thickness', 'Tjocklek', p.thickness, 'mm')}${numberField('roof:radius', 'Radie', radius, 'mm')}</div>
        <label class="field"><span>Höjden gäller</span><select data-key="roof:heightAt"><option value="under"${p.heightAt !== 'top' ? ' selected' : ''}>Undersidan</option><option value="top"${p.heightAt === 'top' ? ' selected' : ''}>Ovansidan</option></select></label>
        <div class="row"><button class="btn" data-action="roof-flip" title="Taket stiger åt andra hållet från referenslinjen">Vänd lutningen</button></div>
        <div class="fields">${numberField('roof:overhang', 'Språngets tjocklek', p.overhangThickness ?? p.thickness, 'mm')}${typeof p.eaveCut === 'number' ? numberField('roof:eaveAngle', 'Snittets vinkel', p.eaveCut, '°') : ''}</div>
        <label class="field"><span>Takfotens snitt</span><select data-key="roof:eaveCut">${(
          [
            ['perp', 'Vinkelrätt mot takytan'],
            ['plumb', 'Lodrätt'],
            ['angle', 'Med vinkel mot det vågräta'],
          ] as const
        )
          .map(([v, label]) => `<option value="${v}"${(typeof p.eaveCut === 'number' ? 'angle' : (p.eaveCut ?? 'perp')) === v ? ' selected' : ''}>${label}</option>`)
          .join('')}</select></label>
        <p class="note">Språnget är delen utanför ytterväggarnas utsida; ovansidan är densamma. Takfoten är kanterna som vetter nedåt i lutningen; nock, grat och gavel snittas lodrätt. En kant kan få ett eget snitt i Modifiera.${p.edgeCuts?.length ? ` ${p.edgeCuts.length === 1 ? 'En kant har' : `${p.edgeCuts.length} kanter har`} ett eget snitt.` : ''}</p>
        <p class="note">Höjden gäller vid referenslinjen, och taket stiger åt pilens håll. Dra i referenslinjens ändar för att flytta den; konturen ändras som en 2D-form. Radie gör referenslinjen till en båge och taket till en kon (0 = rak). Väggar under taket kapas; kryssa i Upp till taket på gavlarna.</p>`;
    }
    case 'Slab': {
      const p = resolveParams<SlabParams>(doc, el);
      const holes = (p.holes ?? [])
        .map((h, i) => {
          const ring = holeRing(h);
          const xs = ring.map((q) => q[0]);
          const ys = ring.map((q) => q[1]);
          const size = `${Math.round(Math.max(...xs) - Math.min(...xs)).toLocaleString('sv-SE')} × ${Math.round(Math.max(...ys) - Math.min(...ys)).toLocaleString('sv-SE')} mm`;
          return `<li><span>Hål ${i + 1} · ${size}</span><button class="icon-mini" data-action="slab-hole-remove" data-index="${i}" aria-label="Ta bort hål ${i + 1}">×</button></li>`;
        })
        .join('');
      return `<div class="fields">${numberField('level:level', 'Nivå mot våningen', levelOf(p), 'mm')}</div>
        <label class="check" title="Konturen följer ytterväggarnas insida och flyttas med dem"><input type="checkbox" data-key="slab:fromWalls"${p.fromWalls ? ' checked' : ''}> Ur väggarna</label>
        <div class="field-label">Håltagningar</div>
        ${holes ? `<ul class="slab-holes">${holes}</ul><p class="note">Klicka på ett håls hörn eller kant för att ändra det, som en 2D-form, eller dra i hörnen.</p>` : '<p class="note">Inga. Välj Håltagning i bjälklagsverktyget och dra upp ett hål.</p>'}
        <p class="note">${p.fromWalls ? 'Bjälklaget slutar vid ytterväggarnas insida; innerväggarna står på det. Bocka ur för att ändra konturen själv.' : 'Konturen ändras med hörnen och kanterna, som takets.'} Ovansidan ligger på nivån mot våningens golv (0 = golvet), tjockleken går nedåt.</p>`;
    }
    case 'Ground':
      return groundFieldsMarkup(doc, el, view);
    case 'North':
    case 'BasisFacade':
    case 'Section':
    case 'Elevation':
      return markerViewFields(doc, el, view);
    case 'Shape2D':
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
      const p = resolveParams<{ at: number; sill: number; sillFromWall?: boolean }>(doc, el);
      return `<div class="fields">${numberField('param:at', 'Läge längs vägg', p.at, 'mm')}${numberField('param:sill', 'Bröstning', p.sill, 'mm')}${textField('name', 'Nummer', el.name ?? '')}</div>
        <label class="check" title="Annars räknas bröstningen från våningens golv och fönstret ligger kvar när väggens fot flyttas"><input type="checkbox" data-key="param:sillFromWall"${p.sillFromWall ? ' checked' : ''}> Bröstningen från väggens fot</label>
        ${frameFields(doc, el, false)}`;
    }
    case 'Furniture': {
      const p = resolveParams<FurnitureParams>(doc, el);
      return `<div class="fields">${textField('name', 'Namn', el.name ?? '')}${numberField('level:level', 'Nivå mot våningen', levelOf(p), 'mm')}</div>
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
        <div class="row"><button class="btn" data-action="room-label-center"${p.labelAt ? '' : ' disabled'} title="Lägg tillbaka rumsstämpeln i rummets mitt">Stämpeln i mitten</button></div>
        <p class="note">Dra i rumsstämpeln för att flytta den. Utanför rummet får den en pil in i rummet.</p>
        ${fillFields('room-pattern-panel', { ...p, fillAngle: p.fillAngle ?? 45, fillSpacing: p.fillSpacing ?? 2 }, (k) => `data-key="d2:${k}"`, doc.graphics)}
`;
    }
    case 'Dimension':
    case 'Text':
    case 'ScaleBar':
    case 'Stamp':
      return annotationFields(doc, el);
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
