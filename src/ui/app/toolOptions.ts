import type { WallFace } from '../../elements/wallSides';
import { LINE_TYPES, PATTERN_LABELS, PEN_WEIGHTS, SHAPE_LABELS, type FillPattern, type LineType } from '../../elements/drawing2d';
import type { Draw2DKind } from '../tools/draw2dTool';
import { icons } from '../icons';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';
import { defaultWallType, nf } from './helpers';

/** Verktygsraden under ritytan: inställningar för det verktyg som är valt, och måttbandets värden. */
export function installToolOptions(app: AppContext) {
  function renderToolOptions(): void {
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
      app.toolOptions.innerHTML = `
        <div class="opt"><span>Typ</span><div class="segmented" role="group" aria-label="Taktyp">
          <button data-roof-kind="gable" aria-pressed="${o.kind === 'gable'}">Sadeltak</button>
          <button data-roof-kind="shed" aria-pressed="${o.kind === 'shed'}">Pulpettak</button>
        </div></div>
        <label class="opt"><span>Lutning</span><span class="input-unit"><input id="roof-slope" type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" value="${o.slope}"><i>°</i></span></label>
        <label class="opt"><span>Takfot</span><span class="input-unit"><input id="roof-eave" type="text" data-expr inputmode="decimal" autocomplete="off" value="${o.eave}" title="Takets undersida vid takfoten, över golvet"><i>mm</i></span></label>
        <button class="btn" data-action="roof-house" title="Ett tak över alla väggar med 500 mm utsprång, som möter väggarnas överkant">Över hela huset</button>
        <span class="opt-hint">${app.roofTool.started ? 'Klicka det motsatta hörnet.' : 'Klicka ett hörn av taket, med utsprånget.'}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'section' || app.ui.tool === 'elevation') {
      const t = app.ui.tool === 'section' ? app.sectionTool : app.elevationTool;
      const what = app.ui.tool === 'section' ? 'sektionslinjen' : 'fasadlinjen';
      app.toolOptions.innerHTML = `<span class="opt-hint">${
        t.step === 0 ? `Klicka där ${what} börjar.` : t.step === 1 ? `Klicka där ${what} slutar.` : 'Klicka på den sida som ska synas.'
      }</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'measure') {
      const cell = (key: string, label: string) =>
        `<span class="opt measure-val"><span>${label}</span><b data-measure="${key}">–</b><button class="icon-btn" data-copy="${key}" title="Kopiera ${label.toLowerCase()}" aria-label="Kopiera ${label.toLowerCase()}">${icons.copy}</button></span>`;
      app.toolOptions.innerHTML = `<span class="measure-grid">${cell('last', 'Sträcka')}${cell('total', 'Totalt')}${cell('angle', 'Riktning')}${cell('turn', 'Mellan')}${cell('area', 'Yta')}</span>
        <button class="btn" data-action="measure-reset">Börja om</button>
        <span class="opt-hint">Klicka punkter att mäta mellan. Dubbelklick eller Enter börjar om.</span>`;
      app.toolOptions.hidden = false;
      updateMeasureOptions();
    } else if (app.ui.tool === 'draw2d') {
      const t = app.draw2dTool;
      const o = t.options;
      const kinds: [Draw2DKind, string][] = [...(Object.entries(SHAPE_LABELS) as [Draw2DKind, string][]), ['fill', 'Fyllning']];
      const comma = (n: number) => n.toLocaleString('sv-SE');
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Form</span><select id="d2-kind" aria-label="Form">${kinds.map(([k, l]) => `<option value="${k}"${k === o.kind ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        ${
          o.kind === 'fill'
            ? `<label class="opt"><span>Mönster</span><select id="d2-pattern" aria-label="Mönster">${(Object.entries(PATTERN_LABELS) as [FillPattern, string][]).map(([k, l]) => `<option value="${k}"${k === o.pattern ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`
            : `<label class="opt"><span>Penna</span><select id="d2-weight" aria-label="Linjetjocklek">${PEN_WEIGHTS.map((w) => `<option value="${w}"${w === o.weight ? ' selected' : ''}>${comma(w)}</option>`).join('')}</select></label>
        <label class="opt"><span>Linje</span><select id="d2-linetype" aria-label="Linjetyp">${(Object.entries(LINE_TYPES) as [LineType, { label: string }][]).map(([k, v]) => `<option value="${k}"${k === o.linetype ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label>`
        }
        ${t.open ? `<button class="btn btn-primary" data-action="d2-done" ${t.count >= (o.kind === 'fill' ? 3 : 2) ? '' : 'disabled'}>Klar</button>` : ''}
        <span class="opt-hint">${t.hintText()}</span>`;
      app.toolOptions.hidden = false;
    } else if (app.ui.tool === 'text') {
      app.toolOptions.innerHTML = `
        <label class="opt"><span>Text</span><input id="text-value" value="${escapeHtml(app.textTool.text)}" aria-label="Text" style="width:180px"></label>
        <span class="opt-hint">Klicka där texten ska stå.</span>`;
      app.toolOptions.hidden = false;
    } else {
      app.toolOptions.innerHTML = '';
      app.toolOptions.hidden = true;
    }
    app.appEl.dataset.tool = app.ui.tool;
    // Avbryt ligger ovanför verktygsraden när ett ritverktyg är aktivt.
    const bar = app.$<HTMLElement>('.cmd-bar');
    bar.hidden = app.ui.tool === 'select' || app.ui.tool === 'pan';
    requestAnimationFrame(placeCmdBar);
  }

  function placeCmdBar(): void {
    // Avbryt ligger ovanför verktygsraden, eller ovanför 2D/3D-växlaren när raden är tom.
    const bar = app.$<HTMLElement>('.cmd-bar');
    const canvas = app.toolOptions.parentElement!;
    const above = app.toolOptions.hidden ? app.$<HTMLElement>('.view-modes') : app.toolOptions;
    bar.style.bottom = `${Math.max(0, canvas.clientHeight - above.offsetTop) + 8}px`;
  }

  /** Måttbandets värden i verktygsraden, utan att bygga om den. */
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
    if (t.id === 'roof-eave' && Number.isFinite(num)) app.roofTool.options.eave = Math.round(num);
    if (t.id === 'wall-def') app.wallTool.options.definition = t.value;
    if (t.id === 'opening-def') (app.ui.tool === 'door' ? app.doorTool : app.windowTool).options.definition = t.value;
    if (t.id === 'd2-kind') app.draw2dTool.setKind(t.value as Draw2DKind);
    if (t.id === 'd2-weight' && num > 0) app.draw2dTool.options.weight = num;
    if (t.id === 'd2-linetype') app.draw2dTool.options.linetype = t.value as LineType;
    if (t.id === 'd2-pattern') app.draw2dTool.options.pattern = t.value as FillPattern;
  });
  app.toolOptions.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'room-name') app.roomTool.name = t.value || 'Rum';
    if (t.id === 'text-value') app.textTool.text = t.value;
    if (t.id === 'wall-angle') {
      const v = parseFloat(t.value.replace(',', '.'));
      app.wallTool.lockAngle = Number.isFinite(v) ? v : null;
      app.view.requestRender();
    }
  });
  app.toolOptions.addEventListener('keydown', (e) => {
    const t = e.target as HTMLInputElement;
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
    if (b.dataset.action === 'wall-done') app.wallTool.finish();
    if (b.dataset.action === 'measure-reset') app.measureTool.reset();
    if (b.dataset.copy) {
      // Bara talet, med decimalkomma, så att det går att klistra in i ett kalkylark.
      const text = measureValues()[b.dataset.copy].replace(/\s*\(.*\)$/, '').replace(/[^\d,−-]/g, '');
      void window.navigator.clipboard?.writeText(text).then(
        () => app.hint(`Kopierade ${text}`),
        () => app.hint('Det gick inte att kopiera här.'),
      );
    }
    if (b.dataset.roofKind) {
      app.roofTool.options.kind = b.dataset.roofKind as 'gable' | 'shed';
      renderToolOptions();
    }
    if (b.dataset.action === 'roof-house') app.roofOverHouse();
    if (b.dataset.action === 'dim-done') app.dimensionTool.donePoints();
    if (b.dataset.action === 'd2-done') app.draw2dTool.finish(false);
  });
  return { renderToolOptions, updateMeasureOptions };
}
