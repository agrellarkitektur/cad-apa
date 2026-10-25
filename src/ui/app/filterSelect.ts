import { combine, emptyCriteria, filterScope, matches, propertyNames, type FilterCriteria } from '../../core/filterSelect';
import type { Element, Id } from '../../core/model';
import type { Action, ViewStates } from '../../core/states';
import { typeOf } from '../../elements/registry';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';

/**
 * Filtrera och markera (0.8.35): en dialog där villkoren väljs (sort, typ,
 * tillstånd, åtgärd, egen penna, egen egenskap och våning), med antalet som
 * stämmer, och knapparna Ersätt markeringen, Lägg till och Dra ifrån.
 * Villkoren finns kvar till nästa gång dialogen öppnas i samma session.
 */

const ACTIONS: { id: Action; label: string }[] = [
  { id: 'existing', label: 'Befintligt' },
  { id: 'demolished', label: 'Rivs' },
  { id: 'new', label: 'Nytt' },
];

export function installFilterSelect(app: AppContext) {
  const el = document.createElement('div');
  el.className = 'dialog-backdrop';
  el.hidden = true;
  app.root.appendChild(el);
  let c: FilterCriteria = emptyCriteria();

  const place = (): Id => app.ui.layout ?? app.ui.marker ?? app.ui.worksheet ?? app.ui.storey;
  const view = (): ViewStates => app.viewStates();
  const onStorey = () => app.store.doc.storeys.some((s) => s.id === place());

  /** Det som stämmer just nu. */
  function found(): Element[] {
    const doc = app.store.doc;
    return filterScope(doc, view(), place(), c.allStoreys && onStorey()).filter((e) => matches(doc, view(), e, c));
  }

  const box = (key: string, value: string, label: string, on: boolean, count?: number) =>
    `<label class="check"><input type="checkbox" data-f="${key}" value="${escapeHtml(value)}"${on ? ' checked' : ''}> ${escapeHtml(label)}${count !== undefined ? ` <small>${count}</small>` : ''}</label>`;
  const row = (label: string, inner: string) => (inner ? `<div class="quick-row"><b>${label}</b><div>${inner}</div></div>` : '');

  function render(): void {
    const doc = app.store.doc;
    const vs = view();
    const scope = filterScope(doc, vs, place(), c.allStoreys && onStorey());
    const count = (pred: (e: Element) => boolean) => scope.filter(pred).length;
    // Sorterna och typerna som finns, med antal; typerna bara för de valda sorterna.
    const types = [...new Set(scope.map((e) => e.type))].sort((a, b) => (typeOf(a)?.labelPlural ?? a).localeCompare(typeOf(b)?.labelPlural ?? b, 'sv'));
    const defs = [...new Set(scope.filter((e) => e.definition && (!c.types.length || c.types.includes(e.type))).map((e) => e.definition!))]
      .map((id) => doc.definitions[id])
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
    const props = propertyNames(doc, scope);
    const storeys = onStorey() && doc.storeys.length > 1 ? box('all', '1', 'Alla våningar', c.allStoreys) : '';
    el.innerHTML = `<div class="dialog filter-select" role="dialog" aria-modal="true" aria-labelledby="filter-title">
      <header><h2 id="filter-title">Filtrera och markera</h2>
        <button class="icon-mini" data-action="filter-close" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        <p class="note">Alla villkor ska stämma; det som inte är ikryssat gäller allt. Bara det som syns i tillståndet som visas räknas.</p>
        ${row('Sort', types.map((t) => box('type', t, typeOf(t)?.labelPlural ?? t, c.types.includes(t), count((e) => e.type === t))).join(''))}
        ${row('Typ', defs.map((d) => box('def', d.id, d.name, c.definitions.includes(d.id), count((e) => e.definition === d.id))).join(''))}
        ${row('Finns i', doc.states.map((s) => box('state', s.id, s.name, c.states.includes(s.id))).join(''))}
        ${vs.compareTo ? row('Åtgärd', ACTIONS.map((a) => box('action', a.id, a.label, c.actions.includes(a.id))).join('')) : ''}
        ${row('Egen penna', `<select data-f="pen" aria-label="Egen penna">
            <option value="any"${c.ownPen === 'any' ? ' selected' : ''}>Med eller utan</option>
            <option value="with"${c.ownPen === 'with' ? ' selected' : ''}>Med egen (objektets eller typens)</option>
            <option value="without"${c.ownPen === 'without' ? ' selected' : ''}>Utan egen</option></select>`)}
        ${row('Egenskap', `<select data-f="prop" aria-label="Egenskap"><option value="">Ingen</option>${props.map((p) => `<option value="${escapeHtml(p)}"${c.prop?.key === p ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('')}</select>
            ${c.prop?.key ? `<input type="text" data-f="value" placeholder="Innehåller (tomt = har ett värde)" value="${escapeHtml(c.prop.value)}" aria-label="Värde">` : props.length ? '' : '<span class="note">Inga egna egenskaper här.</span>'}`)}
        ${storeys ? row('Våning', storeys) : ''}
      </div>
      <footer>
        <span class="filter-count" data-out="filter-count"></span><span class="spacer"></span>
        <button class="btn btn-ghost" data-action="filter-reset">Rensa villkoren</button>
        <button class="btn" data-action="filter-apply" data-how="subtract">Dra ifrån</button>
        <button class="btn" data-action="filter-apply" data-how="add">Lägg till</button>
        <button class="btn btn-primary" data-action="filter-apply" data-how="replace">Ersätt markeringen</button>
      </footer>
    </div>`;
    showCount();
  }

  function showCount(): void {
    const n = found().length;
    const out = el.querySelector<HTMLElement>('[data-out="filter-count"]');
    if (out) out.textContent = n === 1 ? '1 objekt' : `${n} objekt`;
  }

  const toggle = (list: string[], v: string, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

  el.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    const on = (t as HTMLInputElement).checked;
    switch (t.dataset.f) {
      case 'type':
        c = { ...c, types: toggle(c.types, t.value, on) };
        // Typer som inte hör till de valda sorterna släpps.
        if (c.types.length) c.definitions = c.definitions.filter((d) => c.types.includes(app.store.doc.definitions[d]?.elementType ?? ''));
        break;
      case 'def':
        c = { ...c, definitions: toggle(c.definitions, t.value, on) };
        break;
      case 'state':
        c = { ...c, states: toggle(c.states, t.value, on) };
        break;
      case 'action':
        c = { ...c, actions: toggle(c.actions, t.value, on) as Action[] };
        break;
      case 'pen':
        c = { ...c, ownPen: t.value as FilterCriteria['ownPen'] };
        break;
      case 'prop':
        c = { ...c, prop: t.value ? { key: t.value, value: '' } : null };
        break;
      case 'all':
        c = { ...c, allStoreys: on };
        break;
      default:
        return;
    }
    render();
  });
  // Värdet räknas medan man skriver, utan att fältet ritas om.
  el.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.f !== 'value' || !c.prop) return;
    c = { ...c, prop: { ...c.prop, value: t.value } };
    showCount();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter' && (e.target as HTMLElement).dataset.f === 'value') apply('replace');
    e.stopPropagation();
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === el || t.closest('[data-action="filter-close"]')) close();
    else if (t.closest('[data-action="filter-reset"]')) {
      c = emptyCriteria();
      render();
    } else {
      const b = t.closest<HTMLElement>('[data-action="filter-apply"]');
      if (b) apply(b.dataset.how as 'replace' | 'add' | 'subtract');
    }
  });

  function apply(how: 'replace' | 'add' | 'subtract'): void {
    const ids = combine(app.selection.list(), found().map((e) => e.id), how);
    app.selection.set(ids);
    close();
    if (ids.length) {
      app.setPanel(true, 'full');
      app.panel.showTab('selection');
    }
    app.hint(ids.length === 1 ? '1 objekt markerat.' : `${ids.length} objekt markerade.`);
  }

  function open(): void {
    app.smartMenu.hide();
    el.hidden = false;
    render();
    el.querySelector<HTMLElement>('.dialog input, .dialog select')?.focus();
  }

  function close(): void {
    el.hidden = true;
  }

  return { open, close, get isOpen() { return !el.hidden; }, criteria: () => c, setCriteria: (next: FilterCriteria) => ((c = next), !el.hidden && render()) };
}
