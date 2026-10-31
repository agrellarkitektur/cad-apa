import { setDefinition } from '../core/commands';
import type { Id } from '../core/model';
import { openingTypesOf } from '../core/openings';
import { kindOfElementType } from '../core/openingTypes';
import type { DocStore } from '../core/store';
import { openingLitteras } from '../elements/openingLittera';
import { askChoice, askText } from './ask';
import { parseModule, setOpeningLittera, setOpeningModule, toggleOpeningLock } from './openingFields';

/**
 * Smartmenyns val för dörrar och fönster (0.11.8, tavla 2): *Byt typ,
 * behåll mått* (T), *Byt mått, behåll typ* (M), *Samma littera som …* och
 * *Lås litteran*. *Spegla hängning* (S) är `flip-hinge`.
 */
export async function openingAction(store: DocStore, ids: Id[], action: string | undefined): Promise<void> {
  const doc = store.doc;
  const els = ids.map((id) => doc.elements[id]).filter(Boolean);
  const kind = els.length && els.every((e) => e.type === els[0].type) ? kindOfElementType(els[0].type) : null;
  if (!kind) return;
  switch (action) {
    case 'swap-type': {
      const types = openingTypesOf(doc, kind);
      const v = await askChoice('Byt typ, behåll mått', 'Måtten och läget står kvar; litteran följer regeln.', types.map((d) => ({ value: d.id, label: `${d.opening!.group} · ${d.name}` })));
      if (v) setDefinition(store, ids, v);
      return;
    }
    case 'swap-size': {
      const p = els[0].params as { width?: number; height?: number };
      const now = p.width && p.height ? `${Math.round(p.width / 100)}×${Math.round(p.height / 100)}` : '';
      const v = await askText('Byt mått, behåll typ (modulmått, t.ex. 12×13)', now, 'Byt');
      const mod = v ? parseModule(v) : null;
      if (mod) setOpeningModule(store, ids, mod);
      return;
    }
    case 'same-littera': {
      const lit = openingLitteras(doc);
      const others = [...new Set(Object.values(doc.elements).filter((e) => e.type === els[0].type && !ids.includes(e.id)).map((e) => lit.get(e.id) ?? ''))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'sv', { numeric: true }));
      if (!others.length) return;
      const v = await askChoice('Samma littera som …', 'Litteran låses på de markerade.', others.map((l) => ({ value: l, label: l })));
      if (v) setOpeningLittera(store, ids, v);
      return;
    }
    case 'lock-littera':
      toggleOpeningLock(store, ids);
      return;
  }
}
