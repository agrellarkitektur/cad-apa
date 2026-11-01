import { openingSettingsOf, type OpeningRule, type OpeningSettings } from '../../core/general';
import { glassByCompass, glassPanes, m2Text } from '../../elements/daylight';
import { defaultState } from '../../core/states';
import { renumberOpenings } from '../../elements/openingLittera';
import { scheduleFields, type ScheduleKind } from '../../core/openingSchedule';
import { scheduleFieldAction, scheduleFieldRenamed, scheduleTagsChanged } from '../openingScheduleFields';
import type { StyleBook } from '../../core/graphics';
import { DEFAULT_WEIGHTS, generalOf, OFFICE_TAGS, tagKey, weightList, type GeneralSettings, type LengthUnit, type OfficeInfo } from '../../core/general';
import type { ProjectDoc } from '../../core/model';
import { removeProjectField, setOfficeLogo, setProjectField, setProjectPhase } from '../../core/office';
import { BUILT_IN, isBuiltIn } from '../../core/sheetFields';
import { renameProject, SHEET_TEXT_HEIGHTS } from '../../core/sheets';
import type { DocStore } from '../../core/store';
import { imageAsset, IMAGE_ACCEPT, pickFiles } from '../app/imageFile';
import { askChecks, askChoice, askConfirm, askText } from '../ask';
import { icons } from '../icons';
import { escapeHtml as esc } from '../labels';

/**
 * Projektet › Allmänt i stilboken (0.10.39): kontorets uppgifter och de
 * allmänna inställningarna (stilboken, följer med den mellan projekt),
 * projektets uppgifter (projektet) och smarttextens taggar från båda.
 * Fälten har `data-gen`, knapparna `data-gen-action`.
 */

/** Projektets fält som har en egen rad under *Projektet* (resten står bland taggarna). */
const PROJECT_ROWS: readonly { key: string; label: string; tag: string }[] = [
  { key: 'uppdragsnummer', label: 'Projektnummer', tag: 'projektnummer' },
  { key: 'fastighet', label: 'Fastighet', tag: 'fastighet' },
];

const num = (n: number) => n.toLocaleString('sv-SE');

function text(key: string, label: string, value: string, opts: { ph?: string; tag?: string; title?: string } = {}): string {
  const tag = opts.tag ? `<code class="gen-tag">{${esc(opts.tag)}}</code>` : '';
  return `<label class="field"${opts.title ? ` title="${esc(opts.title)}"` : ''}><span>${esc(label)}${tag}</span><input data-gen="${esc(key)}" value="${esc(value)}"${opts.ph ? ` placeholder="${esc(opts.ph)}"` : ''} autocomplete="off"></label>`;
}

function select(key: string, label: string, value: string | number, options: readonly (readonly [string | number, string])[], title = ''): string {
  return `<label class="field"${title ? ` title="${esc(title)}"` : ''}><span>${esc(label)}</span><select data-gen="${esc(key)}">${options.map(([v, l]) => `<option value="${v}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}

const range = (lo: number, hi: number, fmt: (n: number) => string) => Array.from({ length: hi - lo + 1 }, (_, i) => [lo + i, fmt(lo + i)] as const);

function logoMarkup(doc: ProjectDoc): string {
  const logo = doc.graphics.office?.logo;
  const a = logo ? doc.assets[logo.asset] : undefined;
  const img = a ? `<img class="gen-logo-img" src="data:${esc(a.mime)};base64,${a.data}" alt="Logotypen">` : '<span class="gen-logo-none">Ingen logotyp</span>';
  return `<div class="field gen-logo"><span>Logotyp</span><div class="gen-logo-box">${img}
      <button type="button" class="btn" data-gen-action="logo">${logo ? 'Byt bild…' : 'Välj bild…'}</button>
      ${logo ? '<button type="button" class="btn btn-ghost" data-gen-action="logo-remove">Ta bort</button>' : ''}</div></div>`;
}

/** Smarttextens taggar: kontorets, projektets och de inbyggda, med värden. */
function tagTable(doc: ProjectDoc): string {
  const office = doc.graphics.office ?? {};
  const fields = doc.project.fields;
  const del = (kind: 'otag' | 'ptag', k: string) => `<button type="button" class="btn btn-ghost btn-icon" data-gen-action="${kind}-del:${esc(k)}" title="Ta bort taggen {${esc(k)}}" aria-label="Ta bort {${esc(k)}}">${icons.trash}</button>`;
  const row = (tag: string, value: string, where: string, extra = '') => `<tr class="gen-row"><th scope="row"><code>{${esc(tag)}}</code></th><td>${value}</td><td class="gen-where">${where}</td><td>${extra}</td></tr>`;
  const shown = (v: string | undefined) => (v ? esc(v) : '<i class="gen-empty">tom</i>');
  const officeRows = [
    ...OFFICE_TAGS.map((t) => row(t.tag, shown(office[t.key]), 'Kontoret')),
    ...Object.entries(office.tags ?? {}).map(([k, v]) => row(k, `<input data-gen="otag:${esc(k)}" value="${esc(v)}" autocomplete="off" aria-label="{${esc(k)}}">`, 'Kontoret', del('otag', k))),
  ];
  const own = Object.entries(fields).filter(([k]) => !PROJECT_ROWS.some((r) => r.key === k) && k !== 'skede');
  const projectRows = [
    row('projekt', shown(doc.project.name), 'Projektet'),
    ...PROJECT_ROWS.map((r) => row(r.tag, shown(fields[r.key]), 'Projektet')),
    row('skede', 'skede' in fields ? shown(fields.skede) : '<i class="gen-empty">per blad</i>', 'Projektet'),
    ...own.map(([k, v]) => {
      const ph = OFFICE_TAGS.find((t) => t.tag === k);
      const fallback = ph && office[ph.key] ? ` placeholder="${esc(office[ph.key]!)} (kontorets)"` : '';
      return row(k, `<input data-gen="pfield:${esc(k)}" value="${esc(v)}"${fallback} autocomplete="off" aria-label="{${esc(k)}}">`, 'Projektet', del('ptag', k));
    }),
  ];
  const built = BUILT_IN.filter(([k]) => k !== 'projekt' && k !== 'projektnummer').map(([k, d]) => row(k, `<span class="gen-desc">${esc(d)}</span>`, 'Inbyggt'));
  return `<section class="style-labels gen-tags">
      <h3>Smarttext</h3>
      <p class="note">Skriv taggen i en text på ett mallblad, ett blad eller en stämpel, t.ex. <code>{företag}</code>. Kontorets taggar följer med stilboken till andra projekt; projektets stannar i projektet. Ett projektfält med samma namn som en kontorstagg (t.ex. ansvarig) går före när det är ifyllt.</p>
      <table class="field-table gen-table"><thead><tr><th>Tagg</th><th>Värde</th><th>Var</th><th></th></tr></thead>
      <tbody>${officeRows.join('')}${projectRows.join('')}${built.join('')}</tbody></table>
      <div class="sb-toolbar"><button type="button" class="btn" data-gen-action="otag-add">Ny tagg i kontoret…</button><button type="button" class="btn" data-gen-action="ptag-add">Ny tagg i projektet…</button></div>
    </section>`;
}

export function generalMarkup(doc: ProjectDoc): string {
  const book = doc.graphics;
  const o: OfficeInfo = book.office ?? {};
  const g = generalOf(book, doc.site);
  const own = book.general ?? {};
  const f = doc.project.fields;
  const textSizes = SHEET_TEXT_HEIGHTS.includes(g.textSize) ? SHEET_TEXT_HEIGHTS : [...SHEET_TEXT_HEIGHTS, g.textSize].sort((a, b) => a - b);
  const weights = own.weights ? g.weights : DEFAULT_WEIGHTS;
  return `<section class="style-labels">
      <h3>Stilboken</h3>
      <div class="fields"><label class="field"><span>Stilbokens namn</span><input data-sb-name value="${esc(book.name)}"></label></div>
    </section>
    <section class="style-labels gen-office">
      <h3>Kontoret</h3>
      <p class="note">Följer med stilboken till andra projekt.</p>
      <div class="fields gen-grid">
        ${OFFICE_TAGS.map((t) => text(`office:${t.key}`, t.label, o[t.key] ?? '', { tag: t.tag })).join('')}
        ${logoMarkup(doc)}
      </div>
      <p class="note">Logotypen läggs på ett blad, ett mallblad eller en stämpel med högerklick, <i>Lägg in logotypen här</i>. Byts bilden här byts den överallt.</p>
    </section>
    <section class="style-labels gen-project">
      <h3>Projektet</h3>
      <p class="note">Hör till projektet och följer inte med stilboken.</p>
      <div class="fields gen-grid">
        ${text('project:name', 'Projektnamn', doc.project.name, { tag: 'projekt' })}
        ${PROJECT_ROWS.map((r) => text(`pfield:${r.key}`, r.label, f[r.key] ?? '', { tag: r.tag })).join('')}
        ${text('phase', 'Skede', 'skede' in f ? f.skede : '', { tag: 'skede', ph: 'per blad', title: 'Ifyllt gäller skedet alla blad; tomt har varje blad sitt eget (nya blad: BYGGLOVSHANDLING)' })}
      </div>
    </section>
    <section class="style-labels gen-settings">
      <h3>Text, höjder och enheter</h3>
      <div class="fields gen-grid">
        ${select('font', 'Typsnitt', 'osifont', [['osifont', 'osifont (ISO 3098)']], 'Ritningens enda typsnitt än så länge; fler kräver att PDF-exporten bäddar in dem')}
        ${select('general:textSize', 'Texthöjd för ny text', g.textSize, textSizes.map((h) => [h, `${num(h)} mm`] as const))}
        ${text('general:heightSystem', 'Höjdsystem', own.heightSystem ?? '', { tag: 'höjdsystem', ph: g.heightSystem })}
        ${select('general:levelDecimals', 'Decimaler i nivåmarkörer', g.levelDecimals, range(0, 3, (n) => `${n} (+${(62.4).toLocaleString('sv-SE', { minimumFractionDigits: n, maximumFractionDigits: n })})`))}
        ${select('general:groundDecimals', 'Decimaler i markhöjder', g.groundDecimals, range(0, 3, (n) => `${n} (+${(22.2).toLocaleString('sv-SE', { minimumFractionDigits: n, maximumFractionDigits: n })})`))}
        ${select('general:litteraDigits', 'Siffror i littera', g.litteraDigits, range(1, 4, (n) => `${n} (M${String(1).padStart(n, '0')})`))}
        ${select('general:lengthUnit', 'Måttens enhet', g.lengthUnit, [['mm', 'mm (3450)'], ['cm', 'cm (345)'], ['m', 'm (3,45)']])}
        ${select('general:areaDecimals', 'Decimaler i areor', g.areaDecimals, range(0, 2, (n) => `${n} (${(12.5).toLocaleString('sv-SE', { minimumFractionDigits: n, maximumFractionDigits: n })} m²)`))}
      </div>
    </section>
    ${openingsSection(doc)}
    <section class="style-labels gen-weights">
      <h3>Tjocklekar</h3>
      <p class="note">Tjocklekarna som listorna visar, i mm (alltid också <i>Ingen linje</i>). Skriv dem med mellanslag mellan; en tjocklek som redan används i ritningen visas ändå där den används.</p>
      <div class="fields"><label class="field"><span>Tjocklekstabellen</span><input data-gen="weights" value="${esc(weights.map(num).join('  '))}" autocomplete="off"></label></div>
      <div class="gen-weight-row">${weights.map((w) => `<span class="gen-w" title="${num(w)} mm"><i style="height:${Math.max(1, Math.round(w * 4))}px"></i>${num(w)}</span>`).join('')}
      ${own.weights ? '<button type="button" class="btn btn-ghost" data-gen-action="weights-reset">Återställ</button>' : ''}</div>
    </section>
    ${tagTable(doc)}`;
}

/**
 * Öppningarna (0.11.8, tavla 6): litteraregeln, formlerna, överkant karm,
 * drevmånen och hängningen sedd från; *Numrera om*.
 */
function openingsSection(doc: ProjectDoc): string {
  const o = openingSettingsOf(doc.graphics);
  const rule = (v: OpeningRule, label: string, desc: string) =>
    `<label class="check" title="${esc(desc)}"><input type="radio" name="gen-opening-rule" data-gen="opening:rule" value="${v}"${o.rule === v ? ' checked' : ''}> ${esc(label)} <span class="gen-desc">${esc(desc)}</span></label>`;
  return `<section class="style-labels gen-openings">
      <h3>Fönster och dörrar</h3>
      <p class="note">Litteran hör till objektet och följer regeln; alla objekt räknas om när den byts, utom de låsta. Formeln som för annan littera, t.ex. <code>YD{nr:2}</code>.</p>
      <div class="gen-rules">
        ${rule('module', 'Bara bokstav och modulmått', 'F 12×13 · skiss, tidigt bygglov')}
        ${rule('type', 'Typ och mått', 'F01, F02 … · förval')}
        ${rule('hinge', 'Typ, mått och hängning', 'V och H var för sig · bygghandling')}
      </div>
      <div class="fields gen-grid">
        ${text('opening:Window', 'Formel, fönster', o.formulas.Window, { ph: 'F{nr:2}' })}
        ${text('opening:Door', 'Formel, dörrar', o.formulas.Door, { ph: 'D{nr:2}' })}
        ${text('opening:WallHole', 'Formel, vägghål', o.formulas.WallHole, { ph: 'VG{nr:2}' })}
        ${text('opening:head', 'Överkant karm', String(o.head), { title: 'Förvalet för nya fönster, mm över golvet, så att dörrar och fönster linjerar' })}
        ${text('opening:holeAdd', 'Hålmått: modulmåttet +', String(o.holeAdd), { title: 'mm på båda ledder; praxis 10 (10 × 21 → 1 010 × 2 110)' })}
        ${text('opening:frameLess', 'Karmyttermått: modulmåttet −', String(o.frameLess), { title: 'mm på båda ledder; tillverkarens, ofta 10–20. En typ kan ha sitt eget (editorn).' })}
        ${text('opening:swingAngle', 'Fönstrens slag i planen', String(o.swingAngle), { title: 'Grader; sidohängda bågar ritas så mycket öppna, med slagbågen kring gångjärnet' })}
        ${select('opening:hingeFrom', 'Hängning sedd från', o.hingeFrom, [['outside', 'Utsidan'], ['inside', 'Insidan']])}
        ${select('opening:accessCircle', 'Tillgänglighetscirkel', String(o.accessCircle), [['1300', 'Ø 1 300 (manuell rullstol)'], ['1500', 'Ø 1 500 (eldriven, utomhus)'], ...(o.accessCircle !== 1300 && o.accessCircle !== 1500 ? ([[String(o.accessCircle), `Ø ${o.accessCircle}`]] as [string, string][]) : [])])}
      </div>
      ${glassTable(doc)}
      <p class="note">Uppställningens fält: stilboken › Typer › Uppställningens fält.</p>
      <div class="row"><button type="button" class="btn" data-gen-action="renumber-openings"${o.rule === 'module' ? ' disabled title="Regeln Bara bokstav och modulmått har inga nummer"' : ''}>Numrera om…</button></div>
    </section>`;
}

/**
 * Glasarean per väderstreck (0.11.8.3, dagsljuset): dörrar och fönster i
 * ytterväggarna i förslaget, som underlag för energiberäkningen.
 */
function glassTable(doc: ProjectDoc): string {
  const rows = glassByCompass(doc, glassPanes(doc, defaultState(doc)));
  if (!rows.length) return '<p class="note">Glasarea per väderstreck: inget glas i ytterväggarna än.</p>';
  const total = rows.reduce((a, r) => a + r.area, 0);
  return `<table class="gen-glass"><caption>Glasarea per väderstreck</caption>
    <tbody>${rows.map((r) => `<tr><th>${esc(r.name[0].toUpperCase() + r.name.slice(1))}</th><td>${m2Text(r.area)}</td><td>${r.count} st</td></tr>`).join('')}</tbody>
    <tfoot><tr><th>Totalt</th><td>${m2Text(total)}</td><td>${rows.reduce((a, r) => a + r.count, 0)} st</td></tr></tfoot></table>
    <p class="note">Glaset i dörrar och fönster i ytterväggarna, innanför bågarna, efter det väderstreck de vetter mot. Underlag för energiberäkningen; rummens andel står i rummets egenskaper och som <code>{dagsljus}</code> i rumsstämpeln.</p>`;
}

/** Stilboken med ändrade allmänna inställningar (en tom tas bort). */
function withGeneral(book: StyleBook, fn: (g: GeneralSettings) => void): StyleBook {
  const g = { ...(book.general ?? {}) };
  fn(g);
  const next = { ...book };
  if (Object.keys(g).length) next.general = g;
  else delete next.general;
  return next;
}

/** Stilboken med ändrade kontorsuppgifter (en tom tas bort). */
function withOffice(book: StyleBook, fn: (o: OfficeInfo) => void): StyleBook {
  const o: OfficeInfo = { ...(book.office ?? {}), ...(book.office?.tags ? { tags: { ...book.office.tags } } : {}) };
  fn(o);
  if (o.tags && !Object.keys(o.tags).length) delete o.tags;
  const next = { ...book };
  if (Object.keys(o).length) next.office = o;
  else delete next.office;
  return next;
}

type SetBook = (book: StyleBook, label: string) => void;

/** Ett fält under Allmänt har ändrats. Svarar sant om det var ett av dem. */
export function generalChange(store: DocStore, input: HTMLInputElement | HTMLSelectElement, setBook: SetBook): boolean {
  const key = input.dataset.gen;
  if (!key) return false;
  const v = input.value.trim();
  const book = store.doc.graphics;
  const [kind, name] = [key.slice(0, key.indexOf(':') < 0 ? key.length : key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  if (kind === 'office') {
    const k = name as (typeof OFFICE_TAGS)[number]['key'];
    if ((book.office?.[k] ?? '') !== v)
      setBook(
        withOffice(book, (o) => {
          if (v) o[k] = v;
          else delete o[k];
        }),
        `Kontoret: ${OFFICE_TAGS.find((t) => t.key === k)?.label ?? k}`,
      );
  } else if (kind === 'otag') {
    if ((book.office?.tags?.[name] ?? '') !== input.value) setBook(withOffice(book, (o) => (o.tags = { ...(o.tags ?? {}), [name]: input.value })), `Kontorets tagg {${name}}`);
  } else if (kind === 'project') {
    if (v) renameProject(store, v);
    else input.value = store.doc.project.name;
  } else if (kind === 'sfield') {
    const [k, i] = name.split(':');
    if (!scheduleFieldRenamed(store, k as ScheduleKind, Number(i), input.value)) input.value = scheduleFields(store.doc, k as ScheduleKind)[Number(i)] ?? '';
  } else if (kind === 'stags') {
    const [k, i] = name.split(':');
    scheduleTagsChanged(store, k as ScheduleKind, Number(i), input.value);
  } else if (kind === 'pfield') setProjectField(store, name, v);
  else if (kind === 'phase') setProjectPhase(store, v);
  else if (kind === 'weights') {
    const list = weightList(v.split(/[\s;]+/));
    if (!list.length) {
      input.value = generalOf(book).weights.map(num).join('  ');
      return true;
    }
    setBook(
      withGeneral(book, (g) => {
        if (list.join() === DEFAULT_WEIGHTS.join()) delete g.weights;
        else g.weights = list;
      }),
      'Tjocklekstabellen',
    );
  } else if (kind === 'opening') {
    setBook(
      withGeneral(book, (g) => {
        const o: OpeningSettings = { ...(g.openings ?? {}), ...(g.openings?.formulas ? { formulas: { ...g.openings.formulas } } : {}) };
        if (name === 'rule') o.rule = v as OpeningRule;
        else if (name === 'hingeFrom') o.hingeFrom = v === 'inside' ? 'inside' : 'outside';
        else if (name === 'head' || name === 'holeAdd' || name === 'frameLess' || name === 'swingAngle' || name === 'accessCircle') {
          const n = Math.round(Number(v.replace(',', '.')));
          if (Number.isFinite(n) && n >= 0) o[name] = name === 'swingAngle' ? Math.min(90, n) : n;
        } else if (name === 'Window' || name === 'Door' || name === 'WallHole') {
          o.formulas = { ...(o.formulas ?? {}) };
          if (v) o.formulas[name] = v;
          else delete o.formulas[name];
        }
        g.openings = o;
      }),
      `Allmänt: ${input.closest('label')?.querySelector('span')?.firstChild?.textContent?.trim() || 'litteraregeln'}`,
    );
  } else if (kind === 'general') {
    const k = name as keyof GeneralSettings;
    setBook(
      withGeneral(book, (g) => {
        if (k === 'heightSystem') {
          if (v) g.heightSystem = v;
          else delete g.heightSystem;
        } else if (k === 'lengthUnit') g.lengthUnit = v as LengthUnit;
        else if (k === 'textSize' || k === 'levelDecimals' || k === 'groundDecimals' || k === 'litteraDigits' || k === 'areaDecimals') g[k] = Number(v);
      }),
      `Allmänt: ${input.closest('label')?.querySelector('span')?.firstChild?.textContent ?? k}`,
    );
  }
  return true;
}

/** En knapp under Allmänt. Svarar sant om det var en av dem. */
export async function generalClick(store: DocStore, target: HTMLElement, setBook: SetBook): Promise<boolean> {
  const action = target.closest<HTMLElement>('[data-gen-action]')?.dataset.genAction;
  if (!action) return false;
  const book = store.doc.graphics;
  if (action === 'logo') {
    const [file] = await pickFiles(IMAGE_ACCEPT);
    if (!file) return true;
    try {
      const { asset, width, height } = await imageAsset(file, 1024, 'logo');
      setOfficeLogo(store, { asset, width, height });
    } catch (e) {
      await askChoice('Logotypen', `Bilden gick inte att använda: ${(e as Error).message}`, [{ value: 'ok', label: 'Ok' }]);
    }
  } else if (action === 'logo-remove') {
    if (await askConfirm('Ta bort logotypen?', 'Logotyperna som ligger på bladen har kvar bilden.', 'Ta bort')) setOfficeLogo(store, null);
  } else if (action === 'renumber-openings') await renumberDialog(store);
  else if (action.startsWith('sfield-')) await scheduleFieldAction(store, action, (t) => askText(t, '', 'Lägg till'));
  else if (action === 'weights-reset') setBook(withGeneral(book, (g) => delete g.weights), 'Återställ tjocklekstabellen');
  else if (action === 'otag-add' || action === 'ptag-add') {
    const raw = await askText(action === 'otag-add' ? 'Ny tagg i kontoret' : 'Ny tagg i projektet', '', 'Lägg till');
    const k = raw ? tagKey(raw.replace(/[{}]/g, '')) : '';
    if (!k) return true;
    const taken = isBuiltIn(k) || OFFICE_TAGS.some((t) => t.tag === k) || k in (book.office?.tags ?? {}) || k in store.doc.project.fields;
    if (taken && !(action === 'ptag-add' && OFFICE_TAGS.some((t) => t.tag === k) && !(k in store.doc.project.fields))) {
      await askChoice('Taggen finns redan', `{${k}} finns redan.`, [{ value: 'ok', label: 'Ok' }]);
      return true;
    }
    if (action === 'otag-add') setBook(withOffice(book, (o) => (o.tags = { ...(o.tags ?? {}), [k]: '' })), `Ny tagg {${k}}`);
    else setProjectField(store, k, '');
  } else if (action.startsWith('otag-del:')) {
    const k = action.slice('otag-del:'.length);
    setBook(withOffice(book, (o) => delete o.tags?.[k]), `Ta bort taggen {${k}}`);
  } else if (action.startsWith('ptag-del:')) removeProjectField(store, action.slice('ptag-del:'.length));
  return true;
}

/** *Numrera om* (0.11.8): sorterna, förhandsvisningen och numreringen. */
async function renumberDialog(store: DocStore): Promise<void> {
  const checks = await askChecks(
    'Numrera om',
    'Sorteras efter våning, sedan fasad (N · Ö · S · V) och vänster till höger sett utifrån. Samma kombination får samma nummer; låsta hoppas över.',
    [
      { key: 'Window', label: 'Fönster', checked: true },
      { key: 'Door', label: 'Dörrar', checked: true },
      { key: 'WallHole', label: 'Vägghål', checked: false },
    ],
    'Numrera om',
  );
  if (!checks) return;
  const types = Object.keys(checks).filter((k) => checks[k]);
  const { numbers, changes } = renumberOpenings(store.doc, types);
  store.transact(`Numrera om (${changes.length} ändras)`, (tx) => tx.setProject({ ...tx.doc.project, openingNumbers: numbers }));
}
