import { isLineMode, type GroundMode } from '../tools/groundTool';
import type { RoofMode } from '../tools/roofTool';
import type { SlabShape } from '../tools/slabTool';
import { fillTypeList } from '../../core/fillTypes';
import { dividePath } from '../tools/measureTool';
import type { WallFace } from '../../elements/wallSides';
import { BACKGROUND_COLOR, FILL_BACKGROUND, hasBackground, SHAPE_LABELS, type ShapeKind } from '../../elements/drawing2d';
import { lineTypeOptions } from '../lineTypePick';
import { patternPicker, patternValue } from '../patternPick';
import { weightPicker } from '../weightPick';
import { icons } from '../icons';
import { escapeHtml, labelOf } from '../labels';
import { evaluate } from '../expr';
import type { AppContext } from './context';
import { defaultWallType, nf } from './helpers';
import { SHEET_TEXT_HEIGHTS } from '../../core/sheets';

/** Verktygsraden under ritytan: inställningar för det verktyg som är valt, och måttbandets värden. */
export function installToolOptions(app: AppContext) {
  function renderToolOptions(): void {
    app.toolOptions.classList.remove('modify-detail');
    if (app.ui.tool === 'wall') {
      const doc = app.store.doc;
      if (app.wallTool.options.definition && !doc.definitions[app.wallTool.options.definition]) app.wallTool.options.definition = defaultWallType(doc);
      const defs = Object.values(doc.definitions)
        .filter((d) => d.elementType === 'Wall')
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
      const opts = defs
        .map((d) => `<option value="${d.id}"${d.id === app.wallTool.options.definition ? ' selected' : ''}>${escapeHtml(d.name)} · ${nf.format(Number(d.params.thickness))}</option>`)
        .join('');
      const face = app.wallTool.options.face;
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Typ</span><select id="wall-def" aria-label="Väggtyp">${opts}</select></label>
        <div class="opt"><span>Referens</span><div class="segmented" role="group" aria-label="Referenslinje">
          <button data-just="outside" aria-pressed="${face === 'outside'}" title="Linjen i väggens utsida">Ute</button>
          <button data-just="center" aria-pressed="${face === 'center'}" title="Linjen mitt i väggen">Mitt</button>
          <button data-just="inside" aria-pressed="${face === 'inside'}" title="Linjen i väggens insida">Inne</button>
        </div></div>
        <label class="opt"><span>Längd</span><span class="input-unit"><input id="wall-length" type="text" data-expr inputmode="decimal" autocomplete="off" placeholder="Längd" ${app.wallTool.drawing ? '' : 'disabled'}><i>mm</i></span></label>
        <label class="opt"><span>Vinkel</span><span class="input-unit"><input id="wall-angle" type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" placeholder="Vinkel" value="${app.wallTool.lockAngle ?? ''}" ${app.wallTool.drawing ? '' : 'disabled'}><i>°</i></span></label>
        <button class="btn btn-primary" data-action="wall-done" ${app.wallTool.drawing ? '' : 'disabled'}>Klar</button>
        <span class="opt-hint">${app.wallTool.drawing ? 'Klicka nästa punkt, eller skriv en längd och tryck Enter.' : 'Klicka eller tryck där väggen ska börja.'}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'door' || app.ui.tool === 'window') {
      const t = app.ui.tool === 'door' ? app.doorTool : app.windowTool;
      const type = app.ui.tool === 'door' ? 'Door' : 'Window';
      const defs = Object.values(app.store.doc.definitions)
        .filter((d) => d.elementType === type)
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
      if (t.options.definition && !app.store.doc.definitions[t.options.definition]) t.options.definition = defs[0]?.id ?? null;
      const opts = defs
        .map((d) => `<option value="${d.id}"${d.id === t.options.definition ? ' selected' : ''}>${escapeHtml(d.name)} · ${nf.format(Number(d.params.width))}×${nf.format(Number(d.params.height))}</option>`)
        .join('');
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Typ</span><select id="opening-def" aria-label="Typ">${opts}</select></label>
        <span class="opt-hint">${app.ui.tool === 'door' ? 'Peka på en vägg och klicka. Sidan du pekar på blir öppningssidan, gångjärnen hamnar närmast markören.' : 'Peka på en vägg och klicka där fönstret ska sitta.'}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'room') {
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Namn</span><input id="room-name" value="${escapeHtml(app.roomTool.name)}" aria-label="Rumsnamn" style="width:140px"></label>
        <span class="opt-hint">Klicka i ett utrymme som väggarna omsluter. Rummet följer väggarna och numreras automatiskt.</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'dimension') {
      const n = app.dimensionTool.count;
      app.toolOptions.innerHTML = `
        <button class="btn btn-primary" data-action="dim-done" ${n >= 2 && !app.dimensionTool.isPlacing ? '' : 'disabled'}>Klar med punkterna</button>
        <span class="opt-hint">${app.dimensionTool.isPlacing ? 'Klicka där måttlinjen ska ligga.' : n === 0 ? 'Klicka på första punkten som ska måttsättas.' : 'Klicka nästa punkt. Dubbelklicka eller tryck Klar när kedjan är färdig.'}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'roof') {
      const o = app.roofTool.options;
      const mode = (m: string, label: string, title: string) => `<button data-roof-mode="${m}" aria-pressed="${o.mode === m}" title="${title}">${label}</button>`;
      const num = (id: string, label: string, value: number, unit: string, title: string, deg = false) =>
        `<label class="opt"><span>${label}</span><span class="input-unit"><input id="${id}" type="text" data-expr${deg ? ' data-unit="deg"' : ''} inputmode="decimal" autocomplete="off" value="${value}" title="${title}"><i>${unit}</i></span></label>`;
      const quick = o.mode !== 'face';
      app.toolOptions.innerHTML = `
        <div class="opt"><span>Rita</span><div class="segmented" role="group" aria-label="Rita">
          ${mode('face', 'Takfall', 'Ett takfall: konturen, sedan referenslinjen och sidan där taket stiger')}${mode('shed', 'Pulpet', 'Ett takfall över en rektangel')}${mode('gable', 'Sadel', 'Två takfall över en rektangel, nocken längs den längre sidan')}${mode('hip', 'Valm', 'Fyra takfall över en rektangel')}
        </div></div>
        ${num('roof-slope', 'Lutning', o.slope, '°', 'Taklutning', true)}
        ${num('roof-height', quick ? 'Höjd vid ytterliv' : 'Höjd', o.height, 'mm', 'Höjden vid referenslinjen, över golvet')}
        <label class="opt"><span>Gäller</span><select id="roof-height-at"><option value="under"${o.heightAt === 'under' ? ' selected' : ''}>Undersidan</option><option value="top"${o.heightAt === 'top' ? ' selected' : ''}>Ovansidan</option></select></label>
        ${quick ? num('roof-eave', 'Takfotssprång', o.eave, 'mm', 'Utanför ytterlivet vid takfoten') : ''}
        ${quick && o.mode !== 'hip' ? num('roof-gable', 'Gavelsprång', o.gable, 'mm', 'Utanför ytterlivet vid gaveln') : ''}
        ${!quick && app.roofTool.step === 'contour' ? `<button class="btn" data-action="roof-arc" aria-pressed="${app.roofTool.arc}" title="Nästa kant i konturen blir en båge: klicka var den slutar och sedan en punkt på den (G)">Båge</button>` : ''}
        ${quick ? '<button class="btn" data-action="roof-house" title="Snabbvalet över ytterväggarna på våningen, med höjden där väggarna slutar">Över hela huset</button>' : app.roofTool.canClose ? '<button class="btn btn-primary" data-action="roof-close">Klar med konturen</button>' : ''}
        <span class="opt-hint">${app.roofTool.hintText()}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'slab') {
      const t = app.slabTool;
      const doc = app.store.doc;
      const defs = Object.values(doc.definitions)
        .filter((d) => d.elementType === 'Slab')
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
      if (!t.options.definition || !doc.definitions[t.options.definition]) t.options.definition = defs[0]?.id ?? null;
      const opts = defs.map((d) => `<option value="${d.id}"${d.id === t.options.definition ? ' selected' : ''}>${escapeHtml(d.name)} · ${nf.format(Number(d.params.thickness))}</option>`).join('');
      const hole = t.options.mode === 'hole';
      app.toolOptions.innerHTML = `
        <div class="opt"><span>Rita</span><div class="segmented" role="group" aria-label="Rita">
          <button data-slab-mode="slab" aria-pressed="${!hole}">Bjälklag</button>
          <button data-slab-mode="hole" aria-pressed="${hole}">Håltagning</button>
        </div></div>
        <div class="opt"><span>Form</span><div class="segmented" role="group" aria-label="Form">
          <button data-slab-shape="rect" aria-pressed="${t.shape === 'rect'}" title="Två motsatta hörn">Rektangel</button>
          <button data-slab-shape="polygon" aria-pressed="${t.shape === 'polygon'}" title="Hörn för hörn, med bågar">Polygon</button>
          ${hole ? `<button data-slab-shape="circle" aria-pressed="${t.shape === 'circle'}" title="Centrum och en punkt på cirkeln">Cirkel</button>` : ''}
        </div></div>
        ${t.shape === 'polygon' ? `<button class="btn" data-action="slab-arc" aria-pressed="${t.arc}" title="Nästa kant blir en båge: klicka var den slutar och sedan en punkt på den (G)">Båge</button>` : ''}
        ${t.canClose ? '<button class="btn btn-primary" data-action="slab-close">Klar med konturen</button>' : ''}
        ${hole ? '' : `<label class="opt"><span>Typ</span><select id="slab-def" aria-label="Bjälklagstyp">${opts}</select></label>
        <button class="btn" data-action="slab-walls" title="Ett bjälklag innanför ytterväggarna, som följer dem när de flyttas">Ur väggarna</button>`}
        <span class="opt-hint">${t.hintText()}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'ground') {
      // Mark (0.10.4): markyta, under ett bjälklag, eller markytan runt huset.
      // Längs en linje (0.10.5): ramp/väg, brytlinje, stödmur; och höjdpunkten.
      const m = app.groundTool.options.mode;
      const b = (mode: string, label: string, title = '') => `<button data-ground-mode="${mode}" aria-pressed="${m === mode}"${title ? ` title="${title}"` : ''}>${label}</button>`;
      app.toolOptions.innerHTML = `
        <div class="opt"><span>Yta</span><div class="segmented" role="group" aria-label="Yta">
          ${b('area', 'Markyta', 'Schakt där marken ligger högre, fyll där den ligger lägre')}${b('slab', 'Under bjälklag', 'Klicka i ett bjälklag: urgrävningen följer det')}
        </div></div>
        <button class="btn" data-action="ground-around" title="En markyta som följer husets kontur, med fall från fasaden">Runt huset</button>
        ${m === 'area' ? `<div class="opt"><span>Form</span><div class="segmented" role="group" aria-label="Form">
          <button data-ground-shape="rect" aria-pressed="${app.groundTool.options.shape === 'rect'}" title="Två motsatta hörn">Rektangel</button>
          <button data-ground-shape="polygon" aria-pressed="${app.groundTool.options.shape === 'polygon'}" title="Hörn för hörn, med bågar">Polygon</button>
        </div></div>` : ''}
        <div class="opt"><span>Linje</span><div class="segmented" role="group" aria-label="Linje">
          ${b('path', 'Ramp/väg')}${b('breakline', 'Brytlinje', 'Låser marken längs linjen och tonar den runt omkring')}${b('wall', 'Stödmur')}${b('point', 'Höjdpunkt', 'Låser marken i en punkt och tonar den runt omkring')}
        </div></div>
        <div class="opt"><span>Beteckning</span><div class="segmented" role="group" aria-label="Beteckning">
          ${b('level', 'Markhöjd', 'Befintlig höjd understruken, ny höjd utan och den som utgår inom parentes; ändrar inte marken')}${b('drain', 'Låglinje', 'Dagvattnets väg som pilar; ändrar inte marken')}
        </div></div>
        ${isLineMode(m) || app.groundTool.polygon ? `<button class="btn" data-action="ground-arc" aria-pressed="${app.groundTool.arc}" title="Nästa kant blir en båge: klicka var den slutar och sedan en punkt på den (G)">Båge</button>` : ''}
        ${(app.groundTool.started && isLineMode(m)) || app.groundTool.canClose ? `<button class="btn${app.groundTool.canClose ? ' btn-primary' : ''}" data-action="ground-done">${app.groundTool.polygon ? 'Klar med konturen' : 'Klar'}</button>` : ''}
        <span class="opt-hint">${app.groundTool.hintText()}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'section' || app.ui.tool === 'elevation') {
      const t = app.ui.tool === 'section' ? app.sectionTool : app.elevationTool;
      // Fasadverktyget ritar också linjen Beräkningsgrundande fasad (0.10.8b).
      const choice =
        app.ui.tool === 'elevation'
          ? `<div class="opt"><span>Linje</span><div class="segmented" role="group" aria-label="Linje"><button data-elev-basis="0" aria-pressed="${!t.basis}">Fasadmarkör</button><button data-elev-basis="1" aria-pressed="${t.basis}" title="Linjen längs fasadlivet som byggnadshöjden mäts mot; det finns bara en">Beräkningsgrundande fasad</button></div></div>`
          : '';
      app.toolOptions.innerHTML = `${choice}<span class="opt-hint">${t.hintText()}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'measure') {
      const cell = (key: string, label: string) =>
        `<span class="opt measure-val"><span>${label}</span><b data-measure="${key}">–</b><button class="icon-btn" data-copy="${key}" title="Kopiera ${label.toLowerCase()}" aria-label="Kopiera ${label.toLowerCase()}">${icons.copy}</button></span>`;
      // Flytta med måttbandet (0.8.4): fältet för avståndet ersätter tipset.
      const moving = app.measureTool.moving;
      const sp = app.measureTool.span;
      const el = moving ? app.store.doc.elements[moving] : undefined;
      const move =
        el && sp
          ? `<label class="opt measure-move"><span>Flytta ${escapeHtml(labelOf(app.store.doc, el))} till</span><span class="input-unit"><input id="measure-move" type="text" data-expr inputmode="decimal" autocomplete="off" value="${Math.round(Math.hypot(sp[1][0] - sp[0][0], sp[1][1] - sp[0][1]))}" aria-label="Avstånd"><i>mm</i></span></label>
        <span class="opt-hint">Enter flyttar, Tab byter objekt, Esc avbryter.</span>`
          : `<span class="opt-hint">Klicka punkter att mäta mellan. Ett tal och Enter delar mätningen i lika delar. Tab och ett avstånd flyttar objektet vid sista punkten. Dubbelklick eller Enter börjar om.</span>`;
      // Dela i segment (0.8.18): ett tal och Enter lägger segmentpunkter.
      const divide = el
        ? ''
        : `<label class="opt measure-divide"><span>Dela i</span><input id="measure-divide" type="text" inputmode="numeric" autocomplete="off" placeholder="–" aria-label="Dela mätningen i så många delar" title="Skriv ett tal och tryck Enter: tillfälliga snäppunkter delar mätningen i lika delar" style="width:48px"></label>`;
      const clear = app.segmentPoints.count ? `<button class="btn" data-action="clear-segment-points">Rensa segmentpunkter</button>` : '';
      app.toolOptions.innerHTML = `<span class="measure-grid">${cell('last', 'Sträcka')}${cell('total', 'Totalt')}${cell('angle', 'Riktning')}${cell('turn', 'Mellan')}${cell('area', 'Yta')}</span>
        <button class="btn" data-action="measure-reset">Börja om</button>
        ${divide}${clear}
        ${move}`;
      app.toolOptions.hidden = false;
      updateMeasureOptions();
    } else if (app.ui.tool === 'draw2d') {
      const t = app.draw2dTool;
      const o = t.options;
      // 2D-formen (0.8.19): sättet att rita, pennan (eller ingen linje) och fyllningen.
      // Enkellinjen ritas inte längre (0.8.22): Linje är polylinjen.
      const kinds = (Object.entries(SHAPE_LABELS) as [ShapeKind, string][]);
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Rita</span><select id="d2-kind" aria-label="Rita som">${kinds.map(([k, l]) => `<option value="${k}"${k === o.kind ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="opt"><span>Penna</span>${weightPicker('d2-weight', o.weight, '')}</div>
        ${o.weight ? `<label class="opt"><span>Linje</span><select id="d2-linetype" aria-label="Linjetyp">${lineTypeOptions(app.store.doc.graphics, o.linetype)}</select></label>` : ''}
        <div class="opt"><span>Fyllning</span>${patternPicker('d2-pattern', o.fill ?? 'none', '', { types: fillTypeList(app.store.doc.graphics), type: o.fillType })}</div>
        ${hasBackground(o.fill) ? `<label class="opt opt-check"><input type="checkbox" id="d2-background"${o.fillBackground ? ' checked' : ''}><span>Bakgrund</span></label>${o.fillBackground ? `<select id="d2-background-kind" aria-label="Bakgrund"><option value="mask"${o.fillBackground === 'paper' ? ' selected' : ''}>Mask</option><option value="color"${o.fillBackground !== 'paper' ? ' selected' : ''}>Egen färg</option></select>${o.fillBackground !== 'paper' ? `<input type="color" id="d2-background-color" value="${o.fillBackground}" aria-label="Bakgrundens färg">` : ''}` : ''}` : ''}
        ${t.open ? `<button class="btn btn-primary" data-action="d2-done" ${t.count >= 2 ? '' : 'disabled'}>Klar</button>` : ''}
        <span class="opt-hint">${t.hintText()}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'text') {
      // Höjden på papperet (0.8.7) och fet stil (0.8.8).
      const t = app.textTool;
      const heights = SHEET_TEXT_HEIGHTS.includes(t.height) ? SHEET_TEXT_HEIGHTS : [...SHEET_TEXT_HEIGHTS, t.height].sort((a, b) => a - b);
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Text</span><input id="text-value" value="${escapeHtml(t.text)}" aria-label="Text" style="width:180px"></label>
        <label class="opt"><span>Höjd</span><select id="text-height" aria-label="Texthöjd på papperet">${heights.map((h) => `<option value="${h}"${h === t.height ? ' selected' : ''}>${String(h).replace('.', ',')} mm</option>`).join('')}</select></label>
        <label class="opt opt-check"><input type="checkbox" id="text-bold"${t.bold ? ' checked' : ''}><span>Fet</span></label>
        <span class="opt-hint">${app.ui.layout ? 'Klicka på bladet där texten ska stå.' : 'Klicka där texten ska stå.'}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'label') {
      // Det generella littrat (0.10.20.2): texten med fält och sorten.
      const t = app.labelTool;
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Text</span><input id="label-text" value="${escapeHtml(t.text)}" aria-label="Litterans text" style="width:180px" title="Fält inom klammer hämtas ur det ledarna pekar på: {typ}, {id}, {nummer}, {area}, {bredd}, {höjd}, {löpnummer} och egna egenskaper, t.ex. {brandklass}"></label>
        <label class="opt"><span>Sort</span><input id="label-sort" value="${escapeHtml(t.sort)}" aria-label="Sort" placeholder="Ingen" style="width:110px" title="Litteror av samma sort numreras i följd ({löpnummer}) och kan släckas under Visa"></label>
        <div class="opt"><span>Vridning</span><div class="segmented" role="group" aria-label="Textens vridning">
          <button data-label-angle="" aria-pressed="${t.angle === null}" title="Stilbokens förval">Förval</button>
          <button data-label-angle="0" aria-pressed="${t.angle === 0}" title="Vågrät text">Horisontell</button>
          <button data-label-angle="90" aria-pressed="${t.angle === 90}" title="Lodrät text, läses nedifrån">Vertikal</button>
        </div></div>
        <label class="opt"><span>Grader</span><span class="input-unit"><input id="label-angle" type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" value="${t.angle ?? ''}" placeholder="${app.store.doc.graphics.labels.leaders.Label.angle ?? 0}" style="width:56px" aria-label="Egen vridning i grader"><i>°</i></span></label>
        ${t.count > 1 ? `<span class="opt-hint">${t.count} ledare</span>` : ''}
        <span class="opt-hint">${t.hintText()}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'select' && !app.uiSettings.smartMenu && app.modifier.busy) {
      // Utan smartmeny visas Modifiera-valets värde och tips här (0.8.5).
      app.toolOptions.innerHTML = app.modifier.detailMarkup();
      app.toolOptions.classList.add('modify-detail');
      app.toolOptions.hidden = false;
      app.modifier.focusValue(app.toolOptions);
    } else {
      app.toolOptions.innerHTML = '';
      app.toolOptions.hidden = true;
    }
    app.appEl.dataset.tool = app.ui.tool;
    // Avbryt ligger ovanför verktygsraden när ett ritverktyg är aktivt.
    const bar = app.$<HTMLElement>('.cmd-bar');
    bar.hidden = app.ui.tool === 'select' || app.ui.tool === 'pan';
    requestAnimationFrame(placeCmdBar);
    app.commandLine?.refresh();
  }

  function placeCmdBar(): void {
    // Avbryt ligger ovanför verktygsraden, eller ovanför 2D/3D-växlaren när raden är tom.
    const bar = app.$<HTMLElement>('.cmd-bar');
    const canvas = app.toolOptions.parentElement!;
    const above = app.toolOptions.hidden ? app.$<HTMLElement>('.view-modes') : app.toolOptions;
    bar.style.bottom = `${Math.max(0, canvas.clientHeight - above.offsetTop) + 8}px`;
  }

  /** Måttbandets värden i verktygsraden, utan att bygga om den. */
  /** Dela mätningen i lika delar med segmentpunkter (0.8.18). */
  function divideMeasurement(text: string): void {
    const n = Number(text.trim().replace(',', '.'));
    const pts = app.measureTool.points;
    if (pts.length < 2) return app.hint('Mät först en sträcka, skriv sedan hur många delar den ska delas i.', 3500);
    if (!Number.isInteger(n) || n < 2 || n > 1000) return app.hint('Skriv ett heltal från 2 till 1 000.', 3500);
    const added = dividePath(pts, n);
    app.segmentPoints.add(added);
    const each = app.measureTool.measurement().total / n;
    app.hint(`${added.length} segmentpunkter, ${Math.round(each).toLocaleString('sv-SE')} mm mellan. De finns kvar tills du väljer Rensa segmentpunkter.`, 4000);
    renderToolOptions();
  }

  function clearSegmentPoints(): void {
    app.segmentPoints.clear();
    app.hint('Segmentpunkterna är borta.');
    if (app.ui.tool === 'measure') renderToolOptions();
  }

  function measureValues(): Record<string, string> {
    const m = app.measureTool.measurement();
    const n1 = (v: number, d = 0) => v.toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
    return {
      last: m.points >= 2 ? `${n1(m.last)} mm` : '–',
      total: m.points >= 3 ? `${n1(m.total)} mm` : m.points >= 2 ? `${n1(m.total)} mm` : '–',
      angle: m.points >= 2 ? `${n1(m.angle, 2)}°` : '–',
      turn: m.turn !== null ? `${n1(m.turn, 2)}°` : '–',
      area: m.area !== null ? `${n1(m.area, 2)} m²` : '–',
    };
  }
  function updateMeasureOptions(): void {
    if (app.ui.tool !== 'measure') return;
    const v = measureValues();
    const h = app.toolOptions.offsetHeight;
    app.toolOptions.querySelectorAll<HTMLElement>('[data-measure]').forEach((el) => (el.textContent = v[el.dataset.measure!]));
    if (app.toolOptions.offsetHeight !== h) placeCmdBar();
  }

  app.toolOptions.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    const num = Number(t.value);
    if (t.id === 'roof-slope' && Number.isFinite(num)) app.roofTool.options.slope = Math.max(0, Math.min(75, num));
    if (t.id === 'roof-height' && Number.isFinite(num)) app.roofTool.options.height = Math.round(num);
    if (t.id === 'roof-height-at') app.roofTool.options.heightAt = t.value === 'top' ? 'top' : 'under';
    if (t.id === 'roof-eave' && Number.isFinite(num)) app.roofTool.options.eave = Math.max(0, Math.round(num));
    if (t.id === 'roof-gable' && Number.isFinite(num)) app.roofTool.options.gable = Math.max(0, Math.round(num));
    if (t.id === 'wall-def') app.wallTool.options.definition = t.value;
    if (t.id === 'slab-def') app.slabTool.options.definition = t.value;
    if (t.id === 'opening-def') (app.ui.tool === 'door' ? app.doorTool : app.windowTool).options.definition = t.value;
    if (t.id === 'd2-kind') app.draw2dTool.setKind(t.value as ShapeKind);
    if ((t as unknown as HTMLInputElement).name === 'd2-weight' && num >= 0) {
      app.draw2dTool.options.weight = num;
      // Tabellen fälls ihop och visar det nya valet.
      renderToolOptions();
    }
    if (t.id === 'd2-linetype') app.draw2dTool.options.linetype = t.value;
    if ((t as unknown as HTMLInputElement).name === 'd2-pattern') {
      const pick = patternValue(t.value);
      app.draw2dTool.options.fill = pick.fill;
      app.draw2dTool.options.fillType = pick.fillType;
      renderToolOptions();
      app.view.requestRender();
    }
    // Skrafferingens bakgrund (0.8.29).
    if (t.id === 'd2-background') {
      app.draw2dTool.options.fillBackground = (t as unknown as HTMLInputElement).checked ? FILL_BACKGROUND : undefined;
      renderToolOptions();
      app.view.requestRender();
    }
    // Masken eller en egen färg (0.8.30).
    if (t.id === 'd2-background-kind') {
      app.draw2dTool.options.fillBackground = t.value === 'mask' ? FILL_BACKGROUND : BACKGROUND_COLOR;
      renderToolOptions();
      app.view.requestRender();
    }
    if (t.id === 'd2-background-color') app.draw2dTool.options.fillBackground = t.value;
    if (t.id === 'text-height' && num > 0) app.textTool.height = num;
    if (t.id === 'text-bold') app.textTool.bold = (t as unknown as HTMLInputElement).checked;
  });
  app.toolOptions.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'room-name') app.roomTool.name = t.value || 'Rum';
    if (t.id === 'text-value') app.textTool.text = t.value;
    if (t.id === 'label-text') app.labelTool.text = t.value;
    if (t.id === 'label-sort') app.labelTool.sort = t.value;
    if (t.id === 'label-angle') {
      const v = parseFloat(t.value.replace(',', '.'));
      app.labelTool.angle = Number.isFinite(v) ? ((v % 360) + 360) % 360 : null;
    }
    if (t.id === 'measure-move') app.measureTool.setPreview(evaluate(t.value, null, 'mm'));
    if (t.id === 'wall-angle') {
      const v = parseFloat(t.value.replace(',', '.'));
      app.wallTool.lockAngle = Number.isFinite(v) ? v : null;
      app.view.requestRender();
    }
  });
  app.toolOptions.addEventListener('keydown', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'measure-move') {
      // Enter flyttar, Tab byter objekt, Esc avbryter (0.8.4).
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = Number(t.value);
        const msg = Number.isFinite(v) && t.value.trim() !== '' ? app.measureTool.applyMove(v) : 'Skriv ett avstånd i mm.';
        if (msg) app.hint(msg, 3500);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        app.measureTool.beginMove(e.shiftKey);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        app.measureTool.endMove();
      }
      return;
    }
    if (t.id === 'measure-divide') {
      if (e.key === 'Enter') {
        e.preventDefault();
        divideMeasurement(t.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        t.value = '';
        t.blur();
      }
      return;
    }
    if (t.id === 'wall-angle' && e.key === 'Enter') {
      e.preventDefault();
      (app.$<HTMLInputElement>('#wall-length') as HTMLInputElement | null)?.focus();
      return;
    }
    if (t.id === 'wall-length' && e.key === 'Enter') {
      e.preventDefault();
      if (t.value === '') app.wallTool.finish();
      else if (!app.wallTool.placeLength(Number(t.value))) app.hint('Peka först åt det håll väggen ska gå.');
      t.value = '';
      app.view.requestRender();
    }
    if (e.key === 'Escape') {
      app.wallTool.finish();
      t.blur();
    }
  });
  app.toolOptions.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.just) {
      app.wallTool.options.face = b.dataset.just as WallFace;
      renderToolOptions();
    }
    // Litterans vridning (0.10.22): förvalet, vågrät eller lodrät.
    if (b.dataset.labelAngle !== undefined) {
      app.labelTool.angle = b.dataset.labelAngle === '' ? null : Number(b.dataset.labelAngle);
      renderToolOptions();
    }
    if (b.dataset.action === 'wall-done') app.wallTool.finish();
    if (b.dataset.action === 'measure-reset') app.measureTool.reset();
    if (b.dataset.action === 'clear-segment-points') clearSegmentPoints();
    if (b.dataset.copy) {
      // Bara talet, med decimalkomma, så att det går att klistra in i ett kalkylark.
      const text = measureValues()[b.dataset.copy].replace(/\s*\(.*\)$/, '').replace(/[^\d,−-]/g, '');
      void window.navigator.clipboard?.writeText(text).then(
        () => app.hint(`Kopierade ${text}`),
        () => app.hint('Det gick inte att kopiera här.'),
      );
    }
    if (b.dataset.roofMode) {
      app.roofTool.options.mode = b.dataset.roofMode as RoofMode;
      app.roofTool.reset();
      renderToolOptions();
    }
    if (b.dataset.action === 'roof-house') app.roofOverHouse();
    if (b.dataset.action === 'roof-close') app.roofTool.closeContour();
    if (b.dataset.action === 'roof-arc') {
      app.roofTool.setArc(!app.roofTool.arc);
      renderToolOptions();
    }
    if (b.dataset.slabMode) {
      app.slabTool.options.mode = b.dataset.slabMode as 'slab' | 'hole';
      app.slabTool.reset();
    }
    if (b.dataset.action === 'slab-walls') app.slabFromWalls();
    if (b.dataset.slabShape) {
      app.slabTool.options.shape = b.dataset.slabShape as SlabShape;
      app.slabTool.reset();
    }
    if (b.dataset.action === 'slab-arc') {
      app.slabTool.setArc(!app.slabTool.arc);
      renderToolOptions();
    }
    if (b.dataset.action === 'slab-close') app.slabTool.closePolygon();
    if (b.dataset.groundMode) {
      app.groundTool.options.mode = b.dataset.groundMode as GroundMode;
      app.groundTool.reset();
    }
    if (b.dataset.action === 'ground-around') app.groundTool.aroundHouse();
    if (b.dataset.groundShape) {
      app.groundTool.options.shape = b.dataset.groundShape as 'rect' | 'polygon';
      app.groundTool.reset();
    }
    if (b.dataset.elevBasis) {
      app.elevationTool.basis = b.dataset.elevBasis === '1';
      app.elevationTool.reset();
      renderToolOptions();
    }
    if (b.dataset.action === 'ground-done') app.groundTool.finish();
    if (b.dataset.action === 'ground-arc') {
      app.groundTool.setArc(!app.groundTool.arc);
      renderToolOptions();
    }
    if (b.dataset.action === 'dim-done') app.dimensionTool.donePoints();
    if (b.dataset.action === 'd2-done') app.draw2dTool.finish(false);
  });
  app.modifier.bindValue(app.toolOptions);
  app.modifier.subscribe(() => {
    if (app.ui.tool === 'select') renderToolOptions();
  });

  return { renderToolOptions, updateMeasureOptions, clearSegmentPoints };
}
