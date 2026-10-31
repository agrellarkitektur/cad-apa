import type { Element, Id } from '../core/model';
import { commonValue, DERIVED_FIELDS, ownFields, renameField, scheduleFields, scheduleKindOf, withField, type ScheduleKind } from '../core/openingSchedule';
import type { DocStore } from '../core/store';
import type { ProjectDoc } from '../core/model';
import { escapeHtml } from './labels';

/**
 * Uppställningens egna fält i egenskaperna (0.11.8.1, kommentar I): ett
 * fält per rad i fältmallen som fylls i per objekt (U-värde, brandklass,
 * låshus …). Flera markerade av samma sort får samma värde; skiljer de sig
 * står *Olika* i rutan. Nycklarna är `ofield:<fältets namn>`. Mallen ändras
 * under stilboken › Allmänt › Fönster och dörrar.
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
    <h3>Uppställningens fält</h3>
    <details class="sched-fields"${filled.length ? ' open' : ''}><summary>${filled.length ? `${filled.length} ${filled.length === 1 ? 'ifyllt' : 'ifyllda'} av ${names.length}` : `${names.length} fält, inga ifyllda`}</summary>
      <div class="fields">${rows}</div>
      <p class="note">Värdet hör till objektet${els.length > 1 ? ' (alla markerade)' : ''} och står i uppställningen (0.12). Fälten ändras under stilboken › Allmänt › Fönster och dörrar.</p>
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
// Fältmallen under stilboken › Allmänt › Fönster och dörrar

const KIND_LABEL: Record<ScheduleKind, string> = { Window: 'Fönster', Door: 'Dörrar' };

/** Mallen för fönster och dörrar: fälten i ordning, de som räknas fram märkta, *+ Nytt fält…*. */
export function scheduleTemplateMarkup(doc: ProjectDoc): string {
  const list = (kind: ScheduleKind) =>
    scheduleFields(doc, kind)
      .map((f, i, all) => {
        const derived = DERIVED_FIELDS.has(f);
        return `<div class="sched-row"><input type="text" data-gen="sfield:${kind}:${i}" value="${escapeHtml(f)}" aria-label="Fält ${i + 1}">${derived ? '<span class="gen-desc" title="Räknas fram eller kommer ur typen; inget eget fält på objekten">räknas</span>' : ''}
          <button type="button" class="btn btn-small" data-gen-action="sfield-up:${kind}:${i}"${i === 0 ? ' disabled' : ''} title="Flytta upp" aria-label="Flytta upp">↑</button><button type="button" class="btn btn-small" data-gen-action="sfield-down:${kind}:${i}"${i === all.length - 1 ? ' disabled' : ''} title="Flytta ned" aria-label="Flytta ned">↓</button><button type="button" class="btn btn-small" data-gen-action="sfield-del:${kind}:${i}" title="Ta bort ur mallen (värdena på objekten finns kvar)" aria-label="Ta bort">×</button></div>`;
      })
      .join('');
  return `<div class="sched-template">
    <h4>Uppställningens fält</h4>
    <p class="note">Fälten i fönster- och dörruppställningen, uppifrån. Ett nytt fält blir ett fält på alla objekt av sorten och fylls i under egenskaperna; värdet hör till objektet.</p>
    <div class="sched-cols">${(['Window', 'Door'] as const)
      .map((k) => `<details><summary>${KIND_LABEL[k]} (${scheduleFields(doc, k).length})</summary>${list(k)}<div class="row"><button type="button" class="btn btn-small" data-gen-action="sfield-add:${k}">+ Nytt fält…</button>${doc.project.openingSchedule?.fields?.[k] ? `<button type="button" class="btn btn-small btn-ghost" data-gen-action="sfield-reset:${k}">Förvalet</button>` : ''}</div></details>`)
      .join('')}</div>
  </div>`;
}

/** Spara en ny mall för en sort (null = förvalet), med namnbyten på objekten i samma ångra-steg. */
export function setScheduleFields(store: DocStore, kind: ScheduleKind, list: string[] | null, label: string, rename?: [string, string]): void {
  store.transact(label, (tx) => {
    const sched = { ...(tx.doc.project.openingSchedule ?? {}) };
    const fields = { ...(sched.fields ?? {}) };
    if (list) fields[kind] = list;
    else delete fields[kind];
    if (Object.keys(fields).length) sched.fields = fields;
    else delete sched.fields;
    const project = { ...tx.doc.project };
    if (Object.keys(sched).length) project.openingSchedule = sched;
    else delete project.openingSchedule;
    tx.setProject(project);
    if (rename)
      for (const el of Object.values(tx.doc.elements)) {
        if (el.type !== kind) continue;
        const next = renameField(el.params as Record<string, unknown>, rename[0], rename[1]);
        if (next) tx.putElement({ ...el, params: next });
      }
  });
}

/** Ett fälts namn har ändrats i mallen. */
export function scheduleFieldRenamed(store: DocStore, kind: ScheduleKind, i: number, raw: string): boolean {
  const list = scheduleFields(store.doc, kind);
  const to = raw.trim();
  const from = list[i];
  if (!to || from === undefined || to === from || list.includes(to)) return false;
  list[i] = to;
  setScheduleFields(store, kind, list, `Uppställningens fält: ${from} → ${to}`, [from, to]);
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
    setScheduleFields(store, kind, list, `Uppställningens fält: flytta ${list[i - 1]}`);
  } else if (op === 'sfield-down' && i < list.length - 1) {
    [list[i + 1], list[i]] = [list[i], list[i + 1]];
    setScheduleFields(store, kind, list, `Uppställningens fält: flytta ${list[i + 1]}`);
  } else if (op === 'sfield-del' && list[i] !== undefined) {
    const [gone] = list.splice(i, 1);
    setScheduleFields(store, kind, list, `Uppställningens fält: ta bort ${gone}`);
  } else if (op === 'sfield-add') {
    const name = (await ask(`Nytt fält, ${KIND_LABEL[kind].toLowerCase()}`))?.trim();
    if (!name || list.includes(name)) return true;
    // Före Anmärkning och Övrigt, som står sist.
    const at = list.findIndex((f) => f === 'Anmärkning' || f === 'Övrigt');
    list.splice(at < 0 ? list.length : at, 0, name);
    setScheduleFields(store, kind, list, `Uppställningens fält: nytt ${name}`);
  } else if (op === 'sfield-reset') setScheduleFields(store, kind, null, `Uppställningens fält: förvalet för ${KIND_LABEL[kind].toLowerCase()}`);
  return true;
}
