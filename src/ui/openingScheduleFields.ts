import type { Element, Id } from '../core/model';
import { commonValue, DEFAULT_FIELD_TAGS, DERIVED_FIELDS, fieldTag, fieldTags, isOriginalField, ownFields, ownFieldTags, renameField, scheduleChanged, scheduleFields, scheduleKindOf, withField, type ScheduleKind } from '../core/openingSchedule';
import type { DocStore } from '../core/store';
import type { ProjectDoc } from '../core/model';
import { escapeHtml } from './labels';

/**
 * Förteckningens egna fält i egenskaperna (0.11.8.1, kommentar I): ett
 * fält per rad i fältmallen som fylls i per objekt (U-värde, brandklass,
 * låshus …). Flera markerade av samma sort får samma värde; skiljer de sig
 * står *Olika* i rutan. Nycklarna är `ofield:<fältets namn>`. Mallen ändras
 * under stilboken › Typer › Förteckningens fält.
 */
export function scheduleFieldsSection(doc: ProjectDoc, els: readonly Element[]): string | null {
  const kind = scheduleKindOf(els[0]?.type ?? '');
  if (!kind || els.some((e) => e.type !== kind)) return null;
  const names = ownFields(doc, kind);
  if (!names.length) return null;
  const filled = names.filter((n) => commonValue(els, n) !== '');
  const rows = names
    .map((n) => {
      const v = commonValue(els, n);
      return `<label class="field"><span>${escapeHtml(n)}</span><input data-key="ofield:${escapeHtml(n)}" value="${escapeHtml(v ?? '')}"${v === null ? ' placeholder="Olika"' : ''}></label>`;
    })
    .join('');
  return `<section>
    <h3>Förteckningens fält</h3>
    <details class="sched-fields"${filled.length ? ' open' : ''}><summary>${filled.length ? `${filled.length} ${filled.length === 1 ? 'ifyllt' : 'ifyllda'} av ${names.length}` : `${names.length} fält, inga ifyllda`}</summary>
      <div class="fields">${rows}</div>
      <p class="note">Värdet hör till objektet${els.length > 1 ? ' (alla markerade)' : ''} och står i dörr- eller fönsterförteckningen, där det också går att skriva per littera. Fälten ändras under stilboken › Typer › Förteckningens fält.</p>
    </details>
  </section>`;
}

/** Ett ändrat fält: värdet på alla markerade objekt (tomt tar bort det). */
export function applyScheduleField(store: DocStore, ids: readonly Id[], name: string, value: string): boolean {
  store.transact(`${name}: ${value.trim() || 'tomt'}`, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (el) tx.putElement({ ...el, params: withField(el.params as Record<string, unknown>, name, value) });
    }
  });
  return true;
}

// ---------------------------------------------------------------------------
// Fältmallen under stilboken › Typer › Förteckningens fält (0.11.8.2)

const KIND_LABEL: Record<ScheduleKind, string> = { Window: 'Fönster', Door: 'Dörrar' };

/** Sökningen och filtret i fältmallen; ligger kvar medan stilboken är öppen. */
export const scheduleView = { query: '', own: false };

/** Texten en rad söks på: namnet, sorten, märkningen, taggarna och smarttexten. */
function searchText(doc: ProjectDoc, kind: ScheduleKind, f: string): string {
  const mark = DERIVED_FIELDS.has(f) ? 'räknas' : isOriginalField(kind, f) ? 'cad-apa' : 'eget';
  return `${f} ${KIND_LABEL[kind]} ${mark} ${fieldTags(doc, f).join(' ')} ${fieldTag(f)}`.toLowerCase();
}

/**
 * Fältmallen (0.11.8.2, Carl August: en egen plats i stilboken, sökbar med
 * taggar som pennorna, med smarttexten): fönstrens och dörrarnas fält i
 * ordning, märkta *räknas* (ur typen eller läget), *cad-apa* (förteckningens)
 * eller *eget*. Taggarna skrivs med komma; *Bara egna* visar fälten som inte
 * är förteckningarnas, så att de går att ta bort. Mallen bor i stilboken och
 * följer med dess export; värdena bor på objekten.
 */
export function scheduleBookMarkup(doc: ProjectDoc): string {
  const q = scheduleView.query.trim().toLowerCase();
  const list = (kind: ScheduleKind) =>
    scheduleFields(doc, kind)
      .map((f, i, all) => {
        const derived = DERIVED_FIELDS.has(f);
        const original = isOriginalField(kind, f);
        const hidden = (scheduleView.own && original) || (!!q && !searchText(doc, kind, f).includes(q));
        const builtIn = DEFAULT_FIELD_TAGS[f] ?? [];
        return `<div class="sched-row"${hidden ? ' hidden' : ''} data-sf-row="${escapeHtml(searchText(doc, kind, f))}"><input type="text" data-gen="sfield:${kind}:${i}" value="${escapeHtml(f)}" aria-label="Fält ${i + 1}">
          <span class="gen-desc sched-mark" title="${derived ? 'Räknas fram eller kommer ur typen; inget eget fält på objekten' : original ? 'Ett av förteckningens fält' : 'Ett eget fält'}">${derived ? 'räknas' : original ? 'cad-apa' : 'eget'}</span>
          ${derived ? '<span></span>' : `<code class="sched-tag" title="Smarttext i litteramallarna">${escapeHtml(fieldTag(f))}</code>`}
          <input type="text" class="sched-tags" data-gen="stags:${kind}:${i}" value="${escapeHtml(ownFieldTags(doc, f).join(', '))}" placeholder="${escapeHtml(builtIn.join(', ') || 'taggar')}" title="Egna taggar, med komma${builtIn.length ? `; inbyggda: ${builtIn.join(', ')}` : ''}" aria-label="Taggar för ${escapeHtml(f)}">
          <button type="button" class="btn btn-small" data-gen-action="sfield-up:${kind}:${i}"${i === 0 ? ' disabled' : ''} title="Flytta upp" aria-label="Flytta upp">↑</button><button type="button" class="btn btn-small" data-gen-action="sfield-down:${kind}:${i}"${i === all.length - 1 ? ' disabled' : ''} title="Flytta ned" aria-label="Flytta ned">↓</button><button type="button" class="btn btn-small" data-gen-action="sfield-del:${kind}:${i}" title="Ta bort ur mallen (värdena på objekten finns kvar)" aria-label="Ta bort">×</button></div>`;
      })
      .join('');
  const own = (k: ScheduleKind) => scheduleFields(doc, k).filter((f) => !isOriginalField(k, f)).length;
  return `<section class="style-labels sched-template">
    <h3>Förteckningens fält</h3>
    <p class="note">Fälten i fönster- och dörrförteckningen, uppifrån. Ett nytt fält blir ett fält på alla objekt av sorten och fylls i under egenskaperna; värdet hör till objektet. Fälten är smarttext i litteramallarna (Stil › Text och littera), t.ex. <code>{U-värde}</code>. Mallen hör till stilboken och följer med <i>Exportera…</i> och <i>Mall för nya projekt…</i>.</p>
    <div class="sb-toolbar"><label class="field rt-search"><span>Sök</span><input type="search" data-sf-search value="${escapeHtml(scheduleView.query)}" placeholder="fält, tagg, eget …" autocomplete="off"></label>
      <label class="check" title="Fälten som inte är förteckningens (cad-apas), så att de går att ta bort"><input type="checkbox" data-sf-own${scheduleView.own ? ' checked' : ''}> Bara egna (${own('Window') + own('Door')})</label></div>
    <div class="sched-cols">${(['Window', 'Door'] as const)
      .map((k) => `<details open><summary>${KIND_LABEL[k]} (${scheduleFields(doc, k).length})</summary>${list(k)}<div class="row"><button type="button" class="btn btn-small" data-gen-action="sfield-add:${k}">+ Nytt fält…</button>${scheduleChanged(doc, k) ? `<button type="button" class="btn btn-small btn-ghost" data-gen-action="sfield-reset:${k}" title="Förteckningens fält; egna fält och ändrade namn försvinner ur mallen (värdena finns kvar på objekten)">Förvalet</button>` : ''}</div></details>`)
      .join('')}</div>
  </section>`;
}

/** Sökningen utan omritning. */
export function scheduleSearch(root: HTMLElement, q: string): void {
  scheduleView.query = q;
  const s = q.trim().toLowerCase();
  root.querySelectorAll<HTMLElement>('[data-sf-row]').forEach((r) => {
    const own = !r.querySelector('.sched-mark')?.textContent?.includes('cad-apa') && !r.querySelector('.sched-mark')?.textContent?.includes('räknas');
    r.hidden = (scheduleView.own && !own) || (!!s && !(r.dataset.sfRow ?? '').includes(s));
  });
}

/** Mallen i stilboken (0.11.8.2): listan för en sort (null = förvalet), och ett äldre projekts mall flyttas hit. */
function withSchedule(doc: ProjectDoc, fn: (sf: NonNullable<ProjectDoc['graphics']['scheduleFields']>) => void): ProjectDoc['graphics'] {
  const sf = structuredClone(doc.graphics.scheduleFields ?? {});
  const old = doc.project.openingSchedule?.fields;
  for (const k of ['Window', 'Door'] as const) if (!sf[k] && Array.isArray(old?.[k])) sf[k] = [...old[k]!];
  fn(sf);
  const g = { ...doc.graphics };
  if (Object.keys(sf).length) g.scheduleFields = sf;
  else delete g.scheduleFields;
  return g;
}

/** Ta bort ett äldre projekts mall (den står i stilboken nu). */
function dropProjectFields(tx: Parameters<Parameters<DocStore['transact']>[1]>[0]): void {
  if (!tx.doc.project.openingSchedule?.fields) return;
  const sched = { ...tx.doc.project.openingSchedule };
  delete sched.fields;
  const project = { ...tx.doc.project };
  if (Object.keys(sched).length) project.openingSchedule = sched;
  else delete project.openingSchedule;
  tx.setProject(project);
}

/** Spara en ny mall för en sort (null = förvalet), med namnbyten på objekten i samma ångra-steg. */
export function setScheduleFields(store: DocStore, kind: ScheduleKind, list: string[] | null, label: string, rename?: [string, string]): void {
  store.transact(label, (tx) => {
    tx.setGraphics(
      withSchedule(tx.doc, (sf) => {
        if (list) sf[kind] = list;
        else delete sf[kind];
        if (rename && sf.tags?.[rename[0]]) {
          sf.tags[rename[1]] = sf.tags[rename[0]];
          delete sf.tags[rename[0]];
        }
      }),
    );
    dropProjectFields(tx);
    if (rename)
      for (const el of Object.values(tx.doc.elements)) {
        if (el.type !== kind) continue;
        const next = renameField(el.params as Record<string, unknown>, rename[0], rename[1]);
        if (next) tx.putElement({ ...el, params: next });
      }
  });
}

/** Ett fälts egna taggar (med komma). */
export function scheduleTagsChanged(store: DocStore, kind: ScheduleKind, i: number, raw: string): boolean {
  const name = scheduleFields(store.doc, kind)[i];
  if (!name) return false;
  const tags = [...new Set(raw.split(/[,;]/).map((t) => t.trim()).filter(Boolean))];
  if (tags.join() === ownFieldTags(store.doc, name).join()) return true;
  store.transact(`Taggar för ${name}`, (tx) => {
    tx.setGraphics(
      withSchedule(tx.doc, (sf) => {
        const all = { ...(sf.tags ?? {}) };
        if (tags.length) all[name] = tags;
        else delete all[name];
        if (Object.keys(all).length) sf.tags = all;
        else delete sf.tags;
      }),
    );
    dropProjectFields(tx);
  });
  return true;
}

/** Ett fälts namn har ändrats i mallen. */
export function scheduleFieldRenamed(store: DocStore, kind: ScheduleKind, i: number, raw: string): boolean {
  const list = scheduleFields(store.doc, kind);
  const to = raw.trim();
  const from = list[i];
  if (!to || from === undefined || to === from || list.includes(to)) return false;
  list[i] = to;
  setScheduleFields(store, kind, list, `Förteckningens fält: ${from} → ${to}`, [from, to]);
  return true;
}

/** Knapparna i mallen: upp, ned, ta bort, nytt (namnet frågas), förvalet. */
export async function scheduleFieldAction(store: DocStore, action: string, ask: (title: string) => Promise<string | null>): Promise<boolean> {
  const [op, kind, idx] = action.split(':') as [string, ScheduleKind, string?];
  if (!op.startsWith('sfield-') || (kind !== 'Window' && kind !== 'Door')) return false;
  const list = scheduleFields(store.doc, kind);
  const i = Number(idx);
  if (op === 'sfield-up' && i > 0) {
    [list[i - 1], list[i]] = [list[i], list[i - 1]];
    setScheduleFields(store, kind, list, `Förteckningens fält: flytta ${list[i - 1]}`);
  } else if (op === 'sfield-down' && i < list.length - 1) {
    [list[i + 1], list[i]] = [list[i], list[i + 1]];
    setScheduleFields(store, kind, list, `Förteckningens fält: flytta ${list[i + 1]}`);
  } else if (op === 'sfield-del' && list[i] !== undefined) {
    const [gone] = list.splice(i, 1);
    setScheduleFields(store, kind, list, `Förteckningens fält: ta bort ${gone}`);
  } else if (op === 'sfield-add') {
    const name = (await ask(`Nytt fält, ${KIND_LABEL[kind].toLowerCase()}`))?.trim().replace(/[{}]/g, '');
    if (!name || list.includes(name)) return true;
    // Före Anmärkning och Övrigt, som står sist.
    const at = list.findIndex((f) => f === 'Anmärkning' || f === 'Övrigt');
    list.splice(at < 0 ? list.length : at, 0, name);
    setScheduleFields(store, kind, list, `Förteckningens fält: nytt ${name}`);
  } else if (op === 'sfield-reset') setScheduleFields(store, kind, null, `Förteckningens fält: förvalet för ${KIND_LABEL[kind].toLowerCase()}`);
  return true;
}
