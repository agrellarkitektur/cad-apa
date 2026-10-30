/**
 * Sortering per rubrik i alla tabeller (0.10.36): ett klick på en rubrik
 * sorterar raderna efter kolumnen, ett klick till vänder ordningen.
 * Gäller varje tabell med `thead` i programmet. Sorteringen kommer ihåg
 * sig per tabell (`data-table`, annars klassen) och läggs på igen när
 * tabellen ritas om. En cell kan ha `data-sort` med värdet att sortera
 * efter; annars texten, med tal som tal (decimalkomma går bra).
 */

type SortState = { col: number; dir: 1 | -1 };
const saved = new Map<string, SortState>();

const keyOf = (t: HTMLTableElement) => t.dataset.table ?? t.className ?? '';

/** Värdet i en cell: `data-sort`, annars texten. */
function cellValue(row: HTMLTableRowElement, col: number): string {
  const cell = row.cells[col];
  if (!cell) return '';
  return cell.dataset.sort ?? cell.textContent?.trim() ?? '';
}

const asNumber = (s: string) => {
  const m = /^[−-]?\d+(?:[  ]\d{3})*(?:[,.]\d+)?/.exec(s.trim());
  return m && m[0].length === s.trim().length ? Number(m[0].replace(/[  ]/g, '').replace(',', '.').replace('−', '-')) : null;
};

/** Jämför två värden: tal som tal, annars text i svensk ordning med siffror som tal. */
export function compareCells(a: string, b: string): number {
  const x = asNumber(a);
  const y = asNumber(b);
  if (x !== null && y !== null) return x - y;
  if (x !== null) return -1;
  if (y !== null) return 1;
  return a.localeCompare(b, 'sv', { numeric: true, sensitivity: 'base' });
}

/** Sortera tabellens rader efter kolumnen. */
export function sortTable(t: HTMLTableElement, s: SortState): void {
  const body = t.tBodies[0];
  if (!body) return;
  const rows = [...body.rows].map((r, i) => ({ r, i, v: cellValue(r, s.col) }));
  rows.sort((p, q) => compareCells(p.v, q.v) * s.dir || p.i - q.i);
  for (const { r } of rows) body.append(r);
  t.tHead?.querySelectorAll('th').forEach((th, i) => {
    if (i === s.col) th.setAttribute('aria-sort', s.dir === 1 ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });
}

/** Om rubriken går att sortera efter: den har text och inget fält. */
const sortable = (th: HTMLTableCellElement) => !!th.textContent?.trim() && !th.querySelector('input, select, button');

/** Lägg på den sparade sorteringen i tabellerna i `root`. */
export function applySavedSorts(root: ParentNode): void {
  const tables = root instanceof HTMLTableElement ? [root] : [...root.querySelectorAll<HTMLTableElement>('table')];
  for (const t of tables) {
    if (!t.tHead) continue;
    const s = saved.get(keyOf(t));
    if (s) sortTable(t, s);
  }
}

let installed = false;

/** Klick på rubrikerna, och sorteringen kvar när en tabell ritas om. En gång per sida. */
export function installTableSort(doc: Document = document): void {
  if (installed) return;
  installed = true;
  doc.addEventListener('click', (e) => {
    const th = (e.target as HTMLElement).closest?.('thead th') as HTMLTableCellElement | null;
    if (!th || !sortable(th) || (e.target as HTMLElement).closest('input, select, button')) return;
    const t = th.closest('table') as HTMLTableElement;
    const col = th.cellIndex;
    const key = keyOf(t);
    const now = saved.get(key);
    const s: SortState = { col, dir: now?.col === col ? (now.dir === 1 ? -1 : 1) : 1 };
    saved.set(key, s);
    sortTable(t, s);
  });
  new MutationObserver((list) => {
    for (const m of list)
      for (const n of m.addedNodes) {
        if (n instanceof HTMLTableElement || (n instanceof HTMLElement && n.querySelector('table'))) applySavedSorts(n as HTMLElement);
      }
  }).observe(doc.body, { childList: true, subtree: true });
}
