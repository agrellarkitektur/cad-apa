import type { Id } from '../../core/model';
import { createSchedule, duplicateSchedule, removeSchedule, scheduleOf, SOURCES, updateSchedule, type Schedule, type ScheduleColumn, type ScheduleSource } from '../../core/schedules';
import { exportVars, safeFileName } from '../../core/exportJobs';
import { cachedTable, scheduleCsv, type Cell, type ScheduleTable } from '../../repr/schedules';
import { askConfirm } from '../ask';
import { escapeHtml as esc } from '../labels';
import { scheduleFormMarkup } from '../scheduleFields';
import { isNarrow } from '../sheet';
import type { AppContext } from './context';
import { saveOne } from './exportTarget';
import { today } from '../../core/sheets';

/**
 * Förteckningarna i appen (0.12.2): raderna under Vyer i projektträdet,
 * tabellen som visas över ritytan, inställningarna i egenskaperna och
 * Spara som CSV. Tabellen räknas om när projektet ändras.
 */
export function installSchedules(app: AppContext, parts: { place: (sheetId: Id, view: Id, scale: number) => void }) {
  const overlay = document.createElement('div');
  overlay.className = 'schedule-view';
  overlay.hidden = true;
  app.pane2d.appendChild(overlay);
  let open: Id | null = null;

  function render(): void {
    const s = open ? scheduleOf(app.store.doc, open) : undefined;
    if (!s) {
      close();
      return;
    }
    overlay.hidden = false;
    overlay.innerHTML = tableMarkup(cachedTable(app.store.doc, s), s);
  }

  function show(id: Id): void {
    if (!scheduleOf(app.store.doc, id)) return;
    // Det som visades i ritytan står kvar under tabellen.
    if (app.ui.mode === '3d') void app.setMode('2d');
    app.smartMenu.hide();
    app.selection.clear();
    open = id;
    app.appEl.dataset.schedule = '1';
    render();
    app.panel.showTreeItem({ kind: 'schedule', id });
    if (isNarrow()) app.setNav(false);
    else if (!app.ui.panelOpen) app.setPanel(true, 'full');
    if (app.ui.navOpen) app.navigator.render();
  }

  function close(): void {
    if (!open && overlay.hidden) return;
    open = null;
    overlay.hidden = true;
    overlay.innerHTML = '';
    delete app.appEl.dataset.schedule;
    if (app.panel.treeItem?.kind === 'schedule') app.panel.showTreeItem(null);
  }

  app.openSchedule = show;
  app.closeSchedule = close;
  app.panel.scheduleMarkup = (id) => scheduleFormMarkup(app.store.doc, id);
  app.store.subscribe(() => {
    if (open) render();
  });

  // Projektträdet: en förteckning, eller en ny för en källa.
  app.navigator.el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const pick = t.closest<HTMLElement>('[data-schedule-pick]');
    if (pick) {
      show(pick.dataset.schedulePick!);
      return;
    }
    const add = t.closest<HTMLElement>('[data-schedule-new]');
    if (add && SOURCES.includes(add.dataset.scheduleNew as ScheduleSource)) {
      const id = createSchedule(app.store, add.dataset.scheduleNew as ScheduleSource);
      show(id);
      app.hint('En ny förteckning. Välj kolumner, ordning och gruppering i egenskaperna.', 4000);
    }
  });

  // Inställningarna i egenskaperna: varje ändring sparas direkt.
  const formOf = (t: EventTarget | null) => (t as HTMLElement | null)?.closest<HTMLFormElement>('[data-schedule-form]') ?? null;
  const edit = (form: HTMLFormElement, patch: Partial<Omit<Schedule, 'id' | 'source'>>, label?: string) => updateSchedule(app.store, form.dataset.scheduleForm!, patch, label);

  app.panel.el.addEventListener('submit', (e) => {
    if (formOf(e.target)) e.preventDefault();
  });
  app.panel.el.addEventListener('keydown', (e) => {
    const form = formOf(e.target);
    if (!form || e.key !== 'Enter' || (e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    if ((e.target as HTMLElement).matches('[data-sch-own]')) addOwn(form);
    else (e.target as HTMLInputElement).blur();
  });

  app.panel.el.addEventListener('change', (e) => {
    const form = formOf(e.target);
    if (!form) return;
    const s = scheduleOf(app.store.doc, form.dataset.scheduleForm!);
    if (!s) return;
    const el = e.target as HTMLInputElement & HTMLSelectElement;
    if (el.matches('[data-sch-add]')) {
      if (el.value === '*') {
        form.querySelector<HTMLElement>('.sch-own')!.hidden = false;
        form.querySelector<HTMLInputElement>('[data-sch-own]')!.focus();
        return;
      }
      if (el.value) edit(form, { columns: [...s.columns, { field: el.value }] }, `Ny kolumn ${el.value}`);
      return;
    }
    if (el.matches('[data-sch-storey]')) {
      const ids = [...form.querySelectorAll<HTMLInputElement>('[data-sch-storey]')];
      const on = ids.filter((x) => x.checked).map((x) => x.dataset.schStorey!);
      edit(form, { storeys: on.length === ids.length ? undefined : on }, 'Våningarna i förteckningen');
      return;
    }
    const key = el.dataset.sch;
    if (!key) return;
    const [k, n] = key.split(':');
    const i = Number(n);
    const cols = (f: (c: ScheduleColumn, j: number) => ScheduleColumn) => s.columns.map((c, j) => (j === i ? f(c, j) : c));
    switch (k) {
      case 'name':
        if (el.value.trim()) edit(form, { name: el.value.trim() }, 'Byt namn på förteckningen');
        break;
      case 'state':
        edit(form, { state: el.value }, 'Tillståndet i förteckningen');
        break;
      case 'labelSort':
        edit(form, { labelSort: el.value || undefined }, 'Sorten i förteckningen');
        break;
      case 'perLittera':
        edit(form, { perLittera: el.checked || undefined }, el.checked ? 'En rad per littera' : 'En rad per objekt');
        break;
      case 'title':
        edit(form, { columns: cols((c) => ({ field: c.field, ...(el.value.trim() ? { title: el.value.trim() } : {}), ...(c.sum ? { sum: true } : {}) })) }, 'Kolumnens rubrik');
        break;
      case 'sum':
        edit(form, { columns: cols((c) => ({ field: c.field, ...(c.title ? { title: c.title } : {}), ...(el.checked ? { sum: true } : {}) })) }, el.checked ? 'Summera kolumnen' : 'Summera inte kolumnen');
        break;
      case 'sort': {
        const sort = [...s.sort];
        if (el.value) sort[i] = { field: el.value, ...(sort[i]?.desc ? { desc: true } : {}) };
        else sort.splice(i);
        edit(form, { sort: sort.filter(Boolean) }, 'Sorteringen i förteckningen');
        break;
      }
      case 'desc':
        edit(form, { sort: s.sort.map((x, j) => (j === i ? { field: x.field, ...(el.value ? { desc: true } : {}) } : x)) }, 'Sorteringen i förteckningen');
        break;
      case 'group':
        edit(form, { group: el.value || undefined }, el.value ? `Gruppera efter ${el.value}` : 'Ingen gruppering');
        break;
      case 'total':
        edit(form, { noTotal: el.checked ? undefined : true }, el.checked ? 'Summarad' : 'Ingen summarad');
        break;
    }
  });

  function addOwn(form: HTMLFormElement): void {
    const s = scheduleOf(app.store.doc, form.dataset.scheduleForm!);
    const input = form.querySelector<HTMLInputElement>('[data-sch-own]');
    const name = input?.value.trim().replace(/^\{|\}$/g, '');
    if (!s || !name) return;
    edit(form, { columns: [...s.columns, { field: name }] }, `Ny kolumn ${name}`);
  }

  app.panel.el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sch-act]');
    const form = formOf(b);
    if (!b || !form) return;
    const s = scheduleOf(app.store.doc, form.dataset.scheduleForm!);
    if (!s) return;
    const [act, n] = b.dataset.schAct!.split(':');
    const i = Number(n);
    const move = (d: -1 | 1) => {
      const c = [...s.columns];
      [c[i], c[i + d]] = [c[i + d], c[i]];
      edit(form, { columns: c }, 'Flytta kolumnen');
    };
    switch (act) {
      case 'up':
        if (i > 0) move(-1);
        break;
      case 'down':
        if (i < s.columns.length - 1) move(1);
        break;
      case 'remove':
        if (s.columns.length > 1) edit(form, { columns: s.columns.filter((_, j) => j !== i) }, `Ta bort kolumnen ${s.columns[i].field}`);
        break;
      case 'own':
        addOwn(form);
        break;
      case 'place': {
        const sheet = form.querySelector<HTMLSelectElement>('[data-sch-sheet]')?.value;
        if (!sheet) return;
        close();
        parts.place(sheet, s.id, 1);
        break;
      }
      case 'duplicate': {
        const id = duplicateSchedule(app.store, s.id);
        if (id) show(id);
        break;
      }
      case 'csv':
        void saveCsv(s);
        break;
      case 'delete': {
        const on = app.store.doc.sheets.filter((sh) => sh.viewports.some((v) => v.view === s.id)).length;
        void askConfirm('Ta bort förteckningen?', `${s.name} tas bort${on ? ` och från ${on === 1 ? 'bladet' : `de ${on} bladen`} där den ligger` : ''}. Det går att ångra.`).then((ok) => {
          if (!ok) return;
          close();
          removeSchedule(app.store, s.id);
          app.navigator.render();
        });
        break;
      }
    }
  });

  /** Spara förteckningen som CSV med exportens filnamnsmall. */
  async function saveCsv(s: Schedule): Promise<void> {
    const doc = app.store.doc;
    const vars = exportVars(doc, `schedule:${s.id}`, today());
    const name = safeFileName(`${vars.projekt ? `${vars.projekt}_` : ''}${s.name}`);
    const r = await saveOne({ path: `${name}.csv`, data: new TextEncoder().encode(scheduleCsv(cachedTable(doc, s))) }, 'text/csv');
    if (r !== 'cancelled') app.hint(`${s.name} sparad som CSV.`);
  }

  return { show, close, isOpen: () => open };
}

/** Tabellen i ritytan, som HTML (samma rader som på bladet). */
function tableMarkup(t: ScheduleTable, s: Schedule): string {
  const td = (c: Cell, i: number, tag = 'td') => `<${tag}${t.columns[i].number ? ' class="num"' : ''}>${c.text ? esc(c.text) : tag === 'td' ? '-' : ''}</${tag}>`;
  const sum = (cells: Cell[], label: string, cls: string) => `<tr class="${cls}">${cells.map((c, i) => (i === 0 && !c.text ? `<th>${esc(label)}</th>` : td(c, i, 'th'))).join('')}</tr>`;
  const body = t.groups
    .map((g) => {
      const head = g.label !== undefined ? `<tr class="sch-group"><th colspan="${t.columns.length}">${esc(g.label)}</th></tr>` : '';
      const rows = g.rows.map((r) => `<tr>${r.map((c, i) => td(c, i)).join('')}</tr>`).join('');
      return head + rows + (g.sums ? sum(g.sums, `Summa ${g.label ?? ''}`.trim(), 'sch-sum') : '');
    })
    .join('');
  const empty = t.count ? '' : `<tr><td colspan="${t.columns.length}" class="sch-empty">Inga objekt i det här tillståndet${s.storeys?.length ? ' och på de valda våningarna' : ''}.</td></tr>`;
  return `<div class="schedule-sheet">
    <h2>${esc(t.name)}<small>${t.count} ${t.count === 1 ? 'rad' : 'rader'}</small></h2>
    <table class="schedule-table">
      <thead><tr>${t.columns.map((c) => `<th${c.number ? ' class="num"' : ''}>${esc(c.title)}</th>`).join('')}</tr></thead>
      <tbody>${body}${empty}</tbody>
      ${t.total ? `<tfoot>${sum(t.total, 'Summa', 'sch-total')}</tfoot>` : ''}
    </table>
    <p class="note">Räknas fram ur modellen. Ändra kolumner, ordning och gruppering i egenskaperna; lägg den på ett blad där eller under bladets vyer.</p>
  </div>`;
}
