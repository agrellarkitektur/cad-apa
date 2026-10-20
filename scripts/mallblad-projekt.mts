/**
 * Bygg ett projekt med ett mallblad av det `scripts/mallblad-fran-dxf.py`
 * skrev (0.8.8). Mallbladet blir projektets förval; exempelmallbladet tas
 * bort. Ett verktyg för utvecklingen, inte en del av appen.
 *
 *   npx rolldown scripts/mallblad-projekt.mts --file /tmp/mp.mjs --format esm --platform node
 *   node /tmp/mp.mjs mall.json "Ritningsmall A1" A1 landscape [kommun,handläggare] > Ritningsmall.cadapa
 *
 * Sista argumentet (0.8.10) är fält som ska gälla hela projektet, utöver de vanliga.
 */
import { readFileSync } from 'node:fs';
import { EXAMPLE_MASTER_ID } from '../src/core/exampleMaster';
import { emptyProject, type Element, type PaperSize } from '../src/core/model';
import { createMaster, setDefaultMaster } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { deleteWorksheet } from '../src/core/treeCommands';
import { serialize } from '../src/storage/format';

const [file, name, size, orientation, shared = ''] = process.argv.slice(2);
const items = JSON.parse(readFileSync(file, 'utf8')) as { type: string; params: Record<string, unknown> }[];
const store = new DocStore(emptyProject(name, 'nybyggnad', Object.fromEntries(shared.split(',').filter(Boolean).map((k) => [k.trim().toLowerCase(), '']))));
deleteWorksheet(store, EXAMPLE_MASTER_ID);
const id = createMaster(store, { name, size: size as PaperSize, orientation: orientation as 'landscape' | 'portrait' });
setDefaultMaster(store, id);
const states = store.doc.states.map((s) => s.id);
store.transact('Rita mallen', (tx) => {
  items.forEach((it, i) => {
    const el: Element = { id: `${id}-${i + 1}`, type: it.type, storey: store.doc.storeys[0].id, states, tags: [], space: id, params: it.params, props: {} };
    tx.putElement(el);
  });
});
process.stdout.write(serialize(store.doc));
