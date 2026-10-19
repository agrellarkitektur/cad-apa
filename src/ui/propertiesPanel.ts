import {
  moveElements,
  copyElements,
  flipWalls,
  mirrorElements,
  rotateElements,
  createDefinition,
  deleteDefinition,
  deleteElements,
  moveWallEnd,
  renameElement,
  setDefinition,
  setInState,
  updateDefinition,
  updateParams,
} from '../core/commands';
import type { Element, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { actionOf } from '../core/states';
import type { DocStore } from '../core/store';
import { allTypes, resolveParams, typeOf } from '../elements/registry';
import type { WallParams } from '../elements/wall';
import { add, dist, norm, scale, sub } from '../geometry/vec';
import { existingState } from '../core/states';
import { isFixed, rotateFurniture, type FurnitureParams } from '../elements/furniture';
import { dimensionSegments, type DimensionParams } from '../elements/annotation';
import { EXTERIOR_INSET, FRAME_DEFAULTS } from '../elements/opening';
import { doorNumbersFor, numberingOf, roomNumbersFor, type SpaceParams } from '../elements/rooms';
import { createContext } from '../repr/context';
import { faceChoices, faceOf, justificationFor, outsideSide, type WallFace } from '../elements/wallSides';
import { QUICK_ACTIONS, type QuickId } from './uiSettings';
import { icons } from './icons';
import { escapeHtml, labelOf, nextLittera, PARAM_LABELS } from './labels';
import type { Selection } from './selection';
import { markerFrame, markerName, type MarkerParams, type NorthParams } from '../elements/markers';
import type { RoofParams } from '../elements/roof';
import { skewOf, skewText } from '../elements/angleCheck';
import { reshapeWall } from '../core/wallEdit';
import { bulgeForRadius, radiusOf } from '../geometry/arc';

type Tab = 'selection' | 'types';

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
  'open-marker': 'Öppna fasaden eller sektionen',
  delete: 'Ta bort helt, ur alla tillstånd (Delete)',
  'palette-more': 'Visa alla inställningar här i menyn',
  'palette-less': 'Visa bara snabbknapparna',
  deselect: 'Avmarkera (Esc)',
};

/** Egenskapsgruppen där egna egenskaper sparas. */
const PROPS = 'Egenskaper';

const ACTION_LABEL: Record<Action, string> = {
  plain: 'Visas',
  existing: 'Befintligt',
  demolished: 'Rivs',
  new: 'Planerat',
  absent: 'Finns inte',
};

/**
 * Sidopanelen: egenskaper för det som är markerat, och typerna (littera) med
 * deras gemensamma mått. På mobilen ligger den som ett blad nederst.
 */
export class PropertiesPanel {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private tab: Tab = 'selection';
  private store: DocStore;
  private selection: Selection;
  private getView: () => ViewStates;
  private quick: HTMLElement;
  /** Vilka snabbknappar som visas för en sorts objekt ("mixed" när de är olika). */
  quickFor: (type: string) => QuickId[] = () => ['demolish', 'delete'];
  /** Anropas när något kopierats, så att kopian kan flyttas. */
  onCopied?: (ids: string[], center: [number, number]) => void;

  /** Öppna en fasad eller sektion (knappen i panelen). */
  onOpenMarker?: (id: string) => void;
  /** Gränsen för varningen om nästan raka vinklar, grader (0 = av). */
  angleWarn: () => number = () => 5;
  /** Rikta en sektions- eller fasadlinje efter något man klickar på i planen. */
  onAlignMarker?: (id: string) => void;

  constructor(store: DocStore, selection: Selection, getView: () => ViewStates) {
    this.store = store;
    this.selection = selection;
    this.getView = getView;
    this.el = document.createElement('aside');
    this.el.className = 'panel';
    this.el.setAttribute('aria-label', 'Egenskaper');
    this.el.innerHTML = `
      <div class="sheet-grip" role="button" tabindex="0" aria-label="Dra upp för alla egenskaper, ned för att stänga"><span></span></div>
      <div class="pane-title"><h2>Egenskaper</h2>
        <button class="icon-mini pane-min" data-action="min-panel" aria-label="Minimera egenskaperna" title="Minimera"></button>
        <button class="icon-mini pane-x" data-action="close-panel" aria-label="Stäng egenskaperna" title="Stäng (P)"></button>
      </div>
      <div class="panel-head">
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="selection" aria-selected="true">Markerat</button>
          <button role="tab" data-tab="types" aria-selected="false">Typer</button>
        </div>
        <button class="icon-btn panel-close" data-action="toggle-panel" aria-label="Stäng panelen"></button>
      </div>
      <div class="quick-bar" hidden></div>
      <div class="panel-body"></div>`;
    this.body = this.el.querySelector('.panel-body')!;
    this.quick = this.el.querySelector('.quick-bar')!;
    this.quick.addEventListener('click', (e) => this.onClick(e));

    this.el.querySelector('.tabs')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (b) this.showTab(b.dataset.tab as Tab);
    });
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.body.addEventListener('change', (e) => this.onChange(e));
  }

  get currentTab(): Tab {
    return this.tab;
  }

  showTab(tab: Tab): void {
    this.tab = tab;
    this.el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    this.render();
  }

  render(): void {
    const scroll = this.body.scrollTop;
    this.body.innerHTML = this.tab === 'types' ? this.renderTypes(this.store.doc) : this.renderSelection(this.store.doc);
    this.body.scrollTop = scroll;
    this.renderQuick();
  }

  /**
   * Snabbraden: vad som är markerat och de vanligaste åtgärderna för just
   * det, så att man inte behöver öppna hela panelen. På mobilen är det den
   * som syns när bladet är nere.
   */
  private renderQuick(): void {
    const html = this.tab === 'selection' ? this.quickMarkup() : null;
    this.quick.hidden = !html;
    if (html) this.quick.innerHTML = html;
  }

  /**
   * Snabbradens innehåll för det som är markerat, eller null om inget är det.
   * Används både i panelen och i snabbmenyn vid markören. Med `more` får
   * raden en knapp som öppnar hela panelen.
   */
  quickMarkup(more: boolean | 'less' = false): string | null {
    const doc = this.store.doc;
    const els = this.selection
      .list()
      .map((id) => doc.elements[id])
      .filter(Boolean);
    if (els.length === 0) return null;

    const btn = (action: string, icon: string, label: string, extra = '') =>
      `<button class="qb-btn${extra}" data-action="${action}" title="${escapeHtml(QUICK_TITLES[action] ?? label)}">${icon}<span>${escapeHtml(label)}</span></button>`;
    const sameType = els.every((e) => e.type === els[0].type);
    const kind = sameType ? els[0].type : 'mixed';
    const allowed = (id: QuickId, k: string) => {
      const a = QUICK_ACTIONS.find((q) => q.id === id);
      return !!a && (a.types === 'all' || a.types.includes(k));
    };
    const buttons: string[] = [];
    for (const id of this.quickFor(kind)) {
      switch (id) {
        case 'flip-swing':
          if (kind === 'Door') buttons.push(btn('flip-swing', icons.flipSwing, 'Vänd slag'));
          break;
        case 'flip-hinge':
          if (kind === 'Door') buttons.push(btn('flip-hinge', icons.flipHinge, 'Hängning'));
          break;
        case 'toggle-glazed':
          if (kind === 'Door') {
            const on = els.every((e) => resolveParams<{ glazed?: boolean }>(doc, e).glazed);
            buttons.push(btn('toggle-glazed', icons.glazed, 'Glasad', on ? ' on' : ''));
          }
          break;
        case 'cycle-ref':
          if (kind === 'Wall') {
            const faces = new Set(els.map((e) => faceOf(doc, e).label));
            buttons.push(btn('cycle-ref', icons.refLine, faces.size === 1 ? [...faces][0] : 'Referens'));
          }
          break;
        case 'rotate-90':
          if (allowed(id, kind)) buttons.push(btn('rotate-90', icons.rotate, 'Vrid 90°'));
          break;
        case 'mirror':
          if (allowed(id, kind)) buttons.push(btn('mirror', icons.mirror, 'Spegla'));
          break;
        case 'copy':
          if (allowed(id, kind)) buttons.push(btn('copy', icons.copy, 'Kopiera'));
          break;
        case 'flip-wall':
          if (kind === 'Wall') buttons.push(btn('flip-wall', icons.flipWall, 'Vänd väggen'));
          break;
        case 'demolish': {
          // Riva eller behålla: bara för sådant som finns i Befintligt, när man tittar på ett förslag.
          const view = this.getView();
          const ex = existingState(doc);
          if (ex && ex.id !== view.state && els.every((e) => e.states.includes(ex.id) && typeOf(e.type)?.compares)) {
            if (els.every((e) => e.states.includes(view.state))) buttons.push(btn('demolish', icons.demolish, 'Riv'));
            else if (els.every((e) => !e.states.includes(view.state))) buttons.push(btn('restore', icons.restore, 'Behåll'));
          }
          break;
        }
        case 'zoom-selection':
          buttons.push(btn('zoom-selection', icons.zoomIn, 'Zooma till'));
          break;
        case 'open-marker':
          if (els.length === 1 && allowed(id, kind)) buttons.push(btn('open-marker', icons.elevation, 'Öppna'));
          break;
        case 'delete':
          buttons.push(btn('delete', icons.trash, 'Ta bort', ' danger'));
          break;
      }
    }
    if (more === true) buttons.push(btn('palette-more', icons.more, 'Mer'));
    if (more === 'less') buttons.push(btn('palette-less', icons.collapse, 'Mindre'));
    buttons.push(btn('deselect', icons.close, 'Avmarkera'));

    const title = els.length === 0 ? 'Inget markerat' : els.length === 1 ? labelOf(doc, els[0]) : `${els.length} objekt`;
    const sub = els.length === 0 ? 'Tryck på det som ska markeras' : els.length === 1 ? typeOf(els[0].type)?.label ?? '' : summarizeTypes(els);
    return `<div class="qb-title"><b>${escapeHtml(title)}</b><small>${escapeHtml(sub)}</small></div><div class="qb-actions">${buttons.join('')}</div>`;
  }

  // ---------- Markerat ----------

  private renderSelection(doc: ProjectDoc): string {
    const els = this.selection
      .list()
      .map((id) => doc.elements[id])
      .filter(Boolean);
    if (els.length === 0) {
      return `<div class="empty">
        <p><b>Inget är markerat.</b></p>
        <p>Klicka på en vägg, dörr eller möbel i planen. Håll Shift för att markera flera, eller dra en ruta: åt höger tar det som ligger helt innanför, åt vänster allt som berörs.</p>
        <p>På mobilen lägger varje tryck till i markeringen, och ett tryck i tomma delar av planen avmarkerar.</p>
      </div>`;
    }

    const view = this.getView();
    const sameType = els.every((e) => e.type === els[0].type);
    const t = typeOf(els[0].type);
    const title = els.length === 1 ? labelOf(doc, els[0]) : `${els.length} objekt`;
    const sub = els.length === 1 ? '' : summarizeTypes(els);

    const sections: string[] = [];
    sections.push(`<header class="sel-head"><h2>${escapeHtml(title)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</header>`);
    // Nästan rak vinkel: en rad med en knapp som rätar upp.
    const skew = els.length === 1 ? skewOf(doc, els[0], this.angleWarn()) : null;
    if (skew) sections.push(`<p class="skew-note" role="note"><b>!</b> ${escapeHtml(skewText(skew))} <button class="btn" data-action="straighten-angle">Räta upp till ${skew.nearest}°</button></p>`);

    // Finns i: en ruta per tillstånd. Delvis ifylld när markeringen är blandad.
    const chips = doc.states
      .map((s) => {
        const n = els.filter((e) => e.states.includes(s.id)).length;
        const state = n === 0 ? 'off' : n === els.length ? 'on' : 'mixed';
        return `<button class="state-chip ${state}${s.id === view.state ? ' is-viewed' : ''}" data-action="toggle-state" data-state="${s.id}" aria-pressed="${state === 'on' ? 'true' : state === 'mixed' ? 'mixed' : 'false'}"><span class="box"></span>${escapeHtml(s.name)}</button>`;
      })
      .join('');
    const counts = new Map<Action, number>();
    for (const e of els) {
      const a = typeOf(e.type)?.compares ? actionOf(e, view) : e.states.includes(view.state) ? 'plain' : 'absent';
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    const viewed = doc.states.find((s) => s.id === view.state)?.name ?? '';
    const compared = view.compareTo ? doc.states.find((s) => s.id === view.compareTo)?.name : undefined;
    const result = [...counts.entries()]
      .map(([a, n]) => `<span class="tag tag-${a}">${els.length > 1 ? `${n} ` : ''}${ACTION_LABEL[a].toLowerCase()}</span>`)
      .join(' ');
    // Norrpil, fasader och sektioner finns i alla tillstånd.
    if (!els.every((e) => typeOf(e.type)?.global)) sections.push(`<section>
      <h3>Finns i</h3>
      <div class="state-chips">${chips}</div>
      <p class="note">I ${escapeHtml(viewed)}${compared ? ` jämfört med ${escapeHtml(compared)}` : ''}: ${result}</p>
    </section>`);

    // Typ (littera).
    if (sameType && t?.typeParams?.length) {
      const defs = Object.values(doc.definitions).filter((d) => d.elementType === t.type);
      const current = els.every((e) => e.definition === els[0].definition) ? els[0].definition : undefined;
      const options = defs
        .map((d) => `<option value="${d.id}"${d.id === current ? ' selected' : ''}>${escapeHtml(d.name)}${d.description ? ` – ${escapeHtml(d.description)}` : ''}</option>`)
        .join('');
      const mixedOpt = current ? '' : `<option value="" selected disabled>${els.some((e) => e.definition) ? 'Blandade typer' : 'Ingen typ'}</option>`;
      sections.push(`<section>
        <h3>Typ</h3>
        <div class="row"><select id="sel-def" data-action="set-def">${mixedOpt}${options}</select>
        <button class="btn" data-action="new-def">Ny typ</button></div>
      </section>`);
    }

    // Egna mått för ett enskilt element.
    if (els.length === 1) {
      const instance = this.instanceFields(doc, els[0]);
      if (instance) sections.push(`<section><h3>${escapeHtml(t?.label ?? '')}</h3>${instance}</section>`);
    }

    // Egna egenskaper, t.ex. brandklass och ljudklass, för littera och förteckningar.
    if (els.length === 1 && ['Door', 'Window', 'Wall', 'Space', 'Furniture'].includes(els[0].type)) {
      sections.push(this.propsSection(doc, els[0]));
    }

    // Sådant som påverkar fler objekt än de markerade samlas längst ned.
    const shared = this.sharedSection(doc, els);
    if (shared) sections.push(shared);

    // Ta bort, riv, vänd m.m. ligger i snabbraden överst.
    return sections.join('');
  }

  /** Egna egenskaper: objektets egna värden, med typens värden som förslag. */
  private propsSection(doc: ProjectDoc, el: Element): string {
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
  private sharedSection(doc: ProjectDoc, els: Element[]): string | null {
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

  private instanceFields(doc: ProjectDoc, el: Element): string {
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
        return `<label class="field"><span>Namn</span><input data-key="name:" value="${escapeHtml(el.name ?? '')}" placeholder="${escapeHtml(markerName(doc, { ...el, name: undefined }))}"></label>
          <div class="fields">${label}<label class="field"><span>Djup</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" data-key="marker:depth" value="${p.depth ?? ''}" placeholder="Allt"><i>mm</i></span></label></div>
          <label class="check"><input type="checkbox" data-key="marker:auto"${p.auto ? ' checked' : ''}> Placeras automatiskt</label>
          ${p.auto ? '' : this.markerLineFields(p)}
          <div class="row"><button class="btn btn-primary" data-action="open-marker">Öppna ${el.type === 'Section' ? 'sektionen' : 'fasaden'}</button><button class="btn" data-action="flip-side"${p.auto ? ' disabled' : ''}>Vänd blickriktningen</button></div>`;
      }
      case 'Door': {
        const p = resolveParams<{ at: number; glazed?: boolean; mainEntrance?: boolean }>(doc, el);
        return `<div class="fields">${numberField('param:at', 'Läge längs vägg', p.at, 'mm')}${textField('name', 'Nummer', el.name ?? '')}</div>
          ${this.frameFields(doc, el, true)}
          <label class="check"><input type="checkbox" data-key="param:glazed"${p.glazed ? ' checked' : ''}> Glasad dörr</label>
          <label class="check"><input type="checkbox" data-key="param:mainEntrance"${p.mainEntrance ? ' checked' : ''}> Huvudentré (rum och dörrar numreras härifrån)</label>`;
      }
      case 'Window': {
        const p = resolveParams<{ at: number; sill: number }>(doc, el);
        return `<div class="fields">${numberField('param:at', 'Läge längs vägg', p.at, 'mm')}${numberField('param:sill', 'Bröstning', p.sill, 'mm')}${textField('name', 'Nummer', el.name ?? '')}</div>
          ${this.frameFields(doc, el, false)}`;
      }
      case 'Furniture': {
        const p = resolveParams<FurnitureParams>(doc, el);
        return `<div class="fields">${textField('name', 'Namn', el.name ?? '')}</div>
          <label class="check"><input type="checkbox" data-key="param:fixed"${isFixed(p) ? ' checked' : ''}> Fast inredning (svart linje, annars utgråad)</label>`;
      }
      case 'Space': {
        const p = resolveParams<SpaceParams>(doc, el);
        const numbering = numberingOf(doc);
        const { ctx } = createContext(doc, el.storey, this.getView(), doc.graphics, () => true);
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
  private frameFields(doc: ProjectDoc, el: Element, isDoor: boolean): string {
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

  // ---------- Typer ----------

  private renderTypes(doc: ProjectDoc): string {
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

  // ---------- Händelser ----------

  /** Knapparna i snabbraden, var den än visas. */
  handleClick(e: Event): void {
    this.onClick(e);
  }

  /** Fälten i den utfällda snabbmenyn. */
  handleChange(e: Event): void {
    this.onChange(e);
  }

  /**
   * Alla inställningar för det markerade, utan rubriken, för den utfällda
   * snabbmenyn. Null när inget är markerat.
   */
  selectionMarkup(): string | null {
    if (this.selection.size === 0) return null;
    return this.renderSelection(this.store.doc).replace(/<header class="sel-head">[\s\S]*?<\/header>/, '');
  }

  /** Längd och vinkel för en linje som placerats för hand, och knappen för att rikta den efter något. */
  private markerLineFields(p: MarkerParams): string {
    const d = [p.end[0] - p.start[0], p.end[1] - p.start[1]];
    const len = Math.round(Math.hypot(d[0], d[1]));
    const a = (((Math.atan2(d[1], d[0]) * 180) / Math.PI) % 360 + 360) % 360;
    const deg = Math.round(a * 100) / 100;
    return `<div class="fields">${numberField('marker:length', 'Längd', len, 'mm')}${numberField('marker:angle', 'Vinkel', deg, '°', 2)}</div>
      <div class="row"><button class="btn" data-action="align-marker" title="Klicka sedan på en vägg eller linje i planen. Fasader blir parallella med den, sektioner vinkelräta. Håll Shift för det omvända.">Rikta efter objekt</button></div>`;
  }

  private onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    const doc = this.store.doc;
    const ids = this.selection.list();
    switch (b.dataset.action) {
      case 'open-marker':
        if (ids[0]) this.onOpenMarker?.(ids[0]);
        return;
      case 'straighten-angle': {
        const el = doc.elements[ids[0]];
        const w = el && skewOf(doc, el, this.angleWarn());
        if (el && w) straighten(this.store, el, w.nearest);
        return;
      }
      case 'align-marker':
        if (ids[0]) this.onAlignMarker?.(ids[0]);
        return;
      case 'flip-side': {
        const el = doc.elements[ids[0]];
        if (el) updateParams(this.store, [el.id], { side: -Number(el.params.side ?? 1) }, 'Vänd blickriktningen');
        return;
      }
      case 'toggle-state': {
        const s = b.dataset.state!;
        const allIn = ids.every((id) => doc.elements[id]?.states.includes(s));
        setInState(this.store, ids, s, !allIn);
        break;
      }
      case 'new-def': {
        const el = doc.elements[ids[0]];
        const t = typeOf(el.type)!;
        const p = resolveParams<Record<string, number>>(doc, el);
        const params = Object.fromEntries(t.typeParams!.map((k) => [k, Number(p[k] ?? 0)]));
        createDefinition(this.store, el.type, nextLittera(doc, el.type, t.litteraPrefix ?? 'T'), params, ids);
        break;
      }
      case 'add-def': {
        const t = typeOf(b.dataset.type!)!;
        createDefinition(this.store, t.type, nextLittera(doc, t.type, t.litteraPrefix ?? 'T'), pick(t.defaults() as Record<string, number>, t.typeParams!));
        break;
      }
      case 'delete-def':
        deleteDefinition(this.store, b.dataset.def!);
        break;
      case 'delete':
        deleteElements(this.store, ids);
        this.selection.clear();
        break;
      case 'justify': {
        const face = b.dataset.value as WallFace;
        this.patchEach(ids, 'Byt referenslinje', (_p, el) => ({ justification: justificationFor(doc, el, face) }));
        break;
      }
      case 'cycle-ref': {
        // Utsida → Center → Insida → Utsida (innerväggar: vänster → center → höger).
        this.patchEach(ids, 'Byt referenslinje', (_p, el) => {
          const choices = faceChoices(doc, el);
          const i = choices.findIndex((c) => c.face === faceOf(doc, el).face);
          return { justification: justificationFor(doc, el, choices[(i + 1) % choices.length].face) };
        });
        break;
      }
      case 'toggle-glazed': {
        const on = ids.every((id) => resolveParams<{ glazed?: boolean }>(doc, doc.elements[id]).glazed);
        this.patchEach(ids, on ? 'Ej glasad' : 'Glasad', () => ({ glazed: !on }));
        break;
      }
      case 'flip-swing':
        this.patchEach(ids, 'Vänd slag', (p) => ({ swing: -((p.swing as number | undefined) ?? 1) }));
        break;
      case 'flip-hinge':
        this.patchEach(ids, 'Byt hängning', (p) => ({ hinge: p.hinge === 'end' ? 'start' : 'end' }));
        break;
      case 'rotate-90':
        if (ids.length === 1 && doc.elements[ids[0]]?.type === 'Furniture') {
          this.patchEach(ids, 'Vrid 90°', (_p, el) => rotateFurniture(resolveParams<FurnitureParams>(doc, el), 90));
        } else rotateElements(this.store, ids, selectionCenter(doc, ids));
        break;
      case 'mirror':
        mirrorElements(this.store, ids, selectionCenter(doc, ids));
        break;
      case 'flip-wall':
        flipWalls(this.store, ids);
        break;
      case 'copy': {
        const copies = copyElements(this.store, ids);
        this.selection.set(copies);
        this.onCopied?.(copies, selectionCenter(this.store.doc, copies));
        break;
      }
      case 'demolish':
        setInState(this.store, ids, this.getView().state, false);
        break;
      case 'restore':
        setInState(this.store, ids, this.getView().state, true);
        break;
      case 'deselect':
        this.selection.clear();
        break;
      case 'add-prop':
      case 'add-defprop': {
        // Fältet bredvid knappen, i panelen eller i den utfällda snabbmenyn.
        const input =
          b.parentElement?.querySelector<HTMLInputElement>('input') ??
          this.body.querySelector<HTMLInputElement>(b.dataset.action === 'add-prop' ? '#new-prop' : '#new-defprop');
        const name = input?.value.trim();
        if (!name) break;
        const el = doc.elements[ids[0]];
        if (b.dataset.action === 'add-prop') {
          this.store.transact(`Ny egenskap: ${name}`, (tx) => tx.putElement({ ...el, props: { ...el.props, [PROPS]: { ...(el.props[PROPS] ?? {}), [name]: '' } } }));
        } else if (el.definition) {
          const def = doc.definitions[el.definition];
          this.store.transact(`Ny egenskap för ${def.name}: ${name}`, (tx) =>
            tx.putDefinition({ ...def, props: { ...def.props, [PROPS]: { ...(def.props[PROPS] ?? {}), [name]: '' } } }),
          );
        }
        break;
      }
    }
  }

  /**
   * Nytt värde för en sträcka i en måttkedja: det måttet pekar på i sträckans
   * bortre ände flyttas (en vägg vinkelrätt, en dörr längs sin vägg). Är den
   * änden fri flyttas punkten själv.
   */
  private setDimension(id: string, k: number, value: number): void {
    const doc = this.store.doc;
    const el = doc.elements[id];
    if (!el || !(value > 0)) return;
    const p = resolveParams<DimensionParams>(doc, el);
    const seg = dimensionSegments(doc, p)[k];
    if (!seg) return;
    const delta = value - seg.value;
    if (Math.abs(delta) < 0.5) return;
    const r = (p.angle * Math.PI) / 180;
    const dir: [number, number] = [Math.cos(r), Math.sin(r)];
    const pick = (i: number) => {
      const q = p.points[i];
      return !Array.isArray(q) ? q.refs.find((ref) => doc.elements[ref.id]) : undefined;
    };
    const toRef = pick(seg.to);
    const fromRef = pick(seg.from);
    if (toRef) moveElements(this.store, [toRef.id], [Math.round(dir[0] * delta), Math.round(dir[1] * delta)], 'Ändra mått');
    else if (fromRef) moveElements(this.store, [fromRef.id], [Math.round(-dir[0] * delta), Math.round(-dir[1] * delta)], 'Ändra mått');
    else {
      const points = p.points.map((q, i) => (i === seg.to && Array.isArray(q) ? ([Math.round(q[0] + dir[0] * delta), Math.round(q[1] + dir[1] * delta)] as [number, number]) : q));
      updateParams(this.store, [id], { points }, 'Ändra mått');
    }
  }

  /** Lås dörrnumren: numren som de är nu sparas i dörrarna. */
  private lockDoorNumbers(locked: boolean): void {
    const doc = this.store.doc;
    this.store.transact(locked ? 'Lås dörrnumren' : 'Lås upp dörrnumren', (tx) => {
      if (locked) {
        for (const storey of doc.storeys) {
          const { ctx } = createContext(doc, storey.id, this.getView(), doc.graphics, () => true);
          for (const [id, number] of doorNumbersFor(ctx)) {
            const el = tx.doc.elements[id];
            if (el) tx.putElement({ ...el, params: { ...el.params, number } });
          }
        }
      }
      tx.setProject({ ...tx.doc.project, doorNumbering: { locked } });
    });
  }

  /**
   * Ändra rumsnumreringen. Låses den sparas de nummer rummen har just nu, så
   * att de ligger kvar när rum läggs till eller flyttas.
   */
  private setNumbering(name: string, input: HTMLInputElement | HTMLSelectElement): void {
    const doc = this.store.doc;
    const current = numberingOf(doc);
    const next = { ...current };
    if (name === 'locked') next.locked = (input as HTMLInputElement).checked;
    if (name === 'digits') next.digits = input.value === '3' ? 3 : 4;
    if (name === 'building') next.building = input.value.trim() || '1';
    this.store.transact(next.locked && !current.locked ? 'Lås rumsnumrering' : 'Ändra rumsnumrering', (tx) => {
      if (next.locked && !current.locked) {
        // Spara numren som de ser ut nu, plan för plan.
        for (const storey of doc.storeys) {
          const { ctx } = createContext(doc, storey.id, this.getView(), doc.graphics, () => true);
          for (const [id, number] of roomNumbersFor(ctx)) {
            const el = tx.doc.elements[id];
            if (el) tx.putElement({ ...el, params: { ...el.params, number } });
          }
        }
      }
      tx.setProject({ ...tx.doc.project, roomNumbering: next });
    });
  }

  /** Ändra varje markerat element utifrån dess egna värden, i en ångra-bar ändring. */
  private patchEach(ids: string[], label: string, patch: (p: Record<string, unknown>, el: Element) => Record<string, unknown>): void {
    // Värdena räknas ut före ändringen, så att alla utgår från samma läge.
    const doc = this.store.doc;
    const patches = ids.filter((id) => doc.elements[id]).map((id) => [id, patch(doc.elements[id].params, doc.elements[id])] as const);
    this.store.transact(label, (tx) => {
      for (const [id, p] of patches) {
        const el = tx.doc.elements[id];
        if (el) tx.putElement({ ...el, params: { ...el.params, ...p } });
      }
    });
  }

  private onChange(e: Event): void {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    const doc = this.store.doc;
    const ids = this.selection.list();

    if (input.id === 'sel-def') {
      setDefinition(this.store, ids, input.value);
      return;
    }
    // Typtabellen.
    if (input.dataset.def) {
      const defId = input.dataset.def;
      if (input.dataset.param) {
        const v = Number(input.value);
        if (v > 0) updateDefinition(this.store, defId, { params: { [input.dataset.param]: v } });
        else this.render();
      } else if (input.dataset.field === 'name') updateDefinition(this.store, defId, { name: input.value });
      else if (input.dataset.field === 'description') updateDefinition(this.store, defId, { description: input.value });
      return;
    }

    const key = input.dataset.key;
    if (!key) return;
    const [scope, name] = key.split(':');
    if (scope === 'name') {
      renameElement(this.store, ids[0], input.value);
      return;
    }
    if (scope === 'roof') {
      updateParams(this.store, ids, { kind: input.value }, 'Ändra taktyp');
      return;
    }
    if (scope === 'marker') {
      const el = doc.elements[ids[0]];
      if (!el) return;
      if (name === 'length' || name === 'angle') {
        const p = el.params as unknown as MarkerParams;
        const v = Number(input.value.replace(',', '.'));
        const d = [p.end[0] - p.start[0], p.end[1] - p.start[1]];
        const len = name === 'length' ? v : Math.hypot(d[0], d[1]);
        const ang = name === 'angle' ? (v * Math.PI) / 180 : Math.atan2(d[1], d[0]);
        if (!Number.isFinite(v) || len < 300) return this.render();
        // Början ligger still; slutet flyttas.
        const end: [number, number] = [Math.round(p.start[0] + Math.cos(ang) * len), Math.round(p.start[1] + Math.sin(ang) * len)];
        updateParams(this.store, [el.id], { end }, name === 'length' ? 'Ändra längd' : 'Ändra vinkel');
      } else if (name === 'depth') {
        const v = Number(input.value);
        updateParams(this.store, [el.id], { depth: input.value === '' || !(v > 0) ? null : Math.round(v) }, 'Ändra djup');
      } else if (name === 'auto') {
        const on = (input as HTMLInputElement).checked;
        if (on) updateParams(this.store, [el.id], { auto: true }, 'Placera automatiskt');
        else {
          const f = markerFrame(doc, el);
          updateParams(this.store, [el.id], { auto: false, start: [Math.round(f.start[0]), Math.round(f.start[1])], end: [Math.round(f.end[0]), Math.round(f.end[1])], side: 1 }, 'Placera själv');
        }
      }
      return;
    }
    if (scope === 'wall' && name === 'radius') {
      const el = doc.elements[ids[0]];
      const p = el?.params as unknown as WallParams;
      const v = Number(input.value);
      if (!el || !(v > 0)) return this.render();
      reshapeWall(this.store, el.id, p.start, p.end, bulgeForRadius(p.start, p.end, v, (p.bulge ?? 1) >= 0 ? 1 : -1), 'Ändra radie');
      return;
    }
    if (scope === 'text') {
      updateParams(this.store, ids, { [name]: input.value }, name === 'number' ? 'Ändra rumsnummer' : 'Ändra text');
      return;
    }
    if (scope === 'prop' || scope === 'defprop') {
      const prop = key.slice(scope.length + 1);
      if (scope === 'prop') {
        const el = doc.elements[ids[0]];
        const set = { ...(el.props[PROPS] ?? {}) };
        if (input.value === '') delete set[prop];
        else set[prop] = input.value;
        this.store.transact(`Ändra ${prop.toLowerCase()}`, (tx) => tx.putElement({ ...el, props: { ...el.props, [PROPS]: set } }));
      } else {
        const def = doc.definitions[doc.elements[ids[0]].definition!];
        this.store.transact(`Ändra ${prop.toLowerCase()} för ${def.name}`, (tx) =>
          tx.putDefinition({ ...def, props: { ...def.props, [PROPS]: { ...(def.props[PROPS] ?? {}), [prop]: input.value } } }),
        );
      }
      return;
    }
    if (scope === 'dimseg') {
      this.setDimension(ids[0], Number(name), Number(input.value));
      return;
    }
    if (scope === 'doornumbering') {
      this.lockDoorNumbers((input as HTMLInputElement).checked);
      return;
    }
    if (scope === 'numbering') {
      this.setNumbering(name, input);
      return;
    }
    if (scope === 'param' && name === 'ceilingHeight' && input.value === '') {
      updateParams(this.store, ids, { ceilingHeight: undefined }, 'Ta bort takhöjd');
      return;
    }
    if (scope === 'param' && (input as HTMLInputElement).type === 'checkbox') {
      const on = (input as HTMLInputElement).checked;
      const label =
        name === 'glazed' ? (on ? 'Glasad' : 'Ej glasad') : name === 'fixed' ? (on ? 'Fast inredning' : 'Lös möblering') : name === 'toRoof' ? (on ? 'Upp till taket' : 'Egen höjd') : 'Ändra';
      updateParams(this.store, ids, { [name]: on }, label);
      return;
    }
    if (scope === 'param' && name === 'inset' && input.value === '') {
      updateParams(this.store, ids, { inset: null }, 'Automatiskt indrag');
      return;
    }
    const v = Number(input.value);
    if (!(v >= 0)) {
      this.render();
      return;
    }
    if (scope === 'def') {
      const el = doc.elements[ids[0]];
      if (el?.definition && v > 0) updateDefinition(this.store, el.definition, { params: { [name]: v } });
    } else if (scope === 'param') {
      updateParams(this.store, ids, { [name]: v }, `Ändra ${(PARAM_LABELS[name] ?? name).toLowerCase()}`);
    } else if (scope === 'wall' && name === 'length' && v > 0) {
      // Ny längd: slutpunkten flyttas längs väggen och anslutna väggar följer med.
      const el = doc.elements[ids[0]];
      const p = el.params as unknown as WallParams;
      const end = add(p.start, scale(norm(sub(p.end, p.start)), v));
      moveWallEnd(this.store, el.id, 'end', [Math.round(end[0]), Math.round(end[1])], { label: 'Ändra längd' });
    }
  }
}

/**
 * Sifferfält. Mått i modellen visas i hela mm; mått på papper för
 * annotering (texthöjder) med två decimaler, `decimals = 2`.
 */
/** Räta upp ett element till en rak vinkel. Början (eller mitten för tak och inredning) ligger still. */
function straighten(store: DocStore, el: Element, nearest: number): void {
  const doc = store.doc;
  const p = el.params as Record<string, any>;
  const snapAngle = (a: number) => {
    // Den av nearest och nearest + 180 som ligger närmast a.
    const options = [nearest, nearest + 180, nearest - 180, nearest + 360];
    return options.reduce((b, o) => (Math.abs(o - a) < Math.abs(b - a) ? o : b));
  };
  if (el.type === 'Wall' || el.type === 'Section' || el.type === 'Elevation') {
    const d = sub(p.end, p.start);
    const len = Math.hypot(d[0], d[1]);
    const a = (snapAngle((Math.atan2(d[1], d[0]) * 180) / Math.PI) * Math.PI) / 180;
    const end: [number, number] = [Math.round(p.start[0] + Math.cos(a) * len), Math.round(p.start[1] + Math.sin(a) * len)];
    if (el.type === 'Wall') moveWallEnd(store, el.id, 'end', end, { label: 'Räta upp', connected: true });
    else updateParams(store, [el.id], { end }, 'Räta upp');
  } else if (el.type === 'Furniture') {
    const fp = resolveParams<FurnitureParams>(doc, el);
    const target = snapAngle(((fp.rotation % 180) + 180) % 180) + (fp.rotation - (((fp.rotation % 180) + 180) % 180));
    updateParams(store, [el.id], rotateFurniture(fp, target - fp.rotation), 'Räta upp');
  } else if (el.type === 'Roof') {
    const rp = resolveParams<RoofParams>(doc, el);
    updateParams(store, [el.id], { ridge: Math.round(rp.ridge / 45) * 45 }, 'Räta upp');
  }
}

function numberField(key: string, label: string, value: number, unit: string, decimals = 0): string {
  const id = `f-${key.replace(':', '-')}`;
  const shown = decimals > 0 ? Number(value).toFixed(decimals) : String(Math.round(value));
  const exprUnit = unit === '°' ? 'deg' : unit === 'mm' ? 'mm' : '';
  const step = decimals > 0 ? (1 / 10 ** decimals).toFixed(decimals) : '1';
  return `<label class="field" for="${id}"><span>${label}</span><span class="input-unit"><input type="text" data-expr data-unit="${exprUnit}" data-step="${step}" inputmode="decimal" autocomplete="off" id="${id}" data-key="${key}" value="${shown}"><i>${unit}</i></span></label>`;
}

function textField(key: string, label: string, value: string): string {
  return `<label class="field" for="f-${key}"><span>${label}</span><input id="f-${key}" data-key="${key}" value="${escapeHtml(value)}"></label>`;
}

/** Mittpunkten för det markerade, för att vrida och spegla kring. */
export function selectionCenter(doc: ProjectDoc, ids: string[]): [number, number] {
  const pts: [number, number][] = [];
  for (const id of ids) {
    const p = doc.elements[id]?.params as Record<string, any> | undefined;
    if (!p) continue;
    if (p.start && p.end) pts.push(p.start, p.end);
    if (p.origin && typeof p.width === 'number') {
      const r = ((p.rotation ?? 0) * Math.PI) / 180;
      const c = (x: number, y: number): [number, number] => [p.origin[0] + x * Math.cos(r) - y * Math.sin(r), p.origin[1] + x * Math.sin(r) + y * Math.cos(r)];
      pts.push(c(0, 0), c(p.width, p.depth));
    }
    if (Array.isArray(p.outline)) pts.push(...p.outline);
    if (Array.isArray(p.points)) pts.push(...p.points.map((q: any) => (Array.isArray(q) ? q : q.at)));
    if (p.pos) pts.push(p.pos);
  }
  if (!pts.length) return [0, 0];
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)];
}

function summarizeTypes(els: Element[]): string {
  const counts = new Map<string, number>();
  for (const e of els) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, n]) => {
      const t = typeOf(type);
      return `${n} ${(n === 1 ? t?.label : t?.labelPlural)?.toLowerCase() ?? type}`;
    })
    .join(', ');
}

function pick(o: Record<string, number>, keys: string[]): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, o[k]]));
}

