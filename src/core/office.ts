import { newId } from './ids';
import type { OfficeInfo } from './general';
import type { Asset, Element, Id } from './model';
import { applyFieldChanges } from './sheetFields';
import type { DocStore } from './store';

/**
 * Det som ändras under Projektet › Allmänt (0.10.39) och inte bara är ett
 * fält i stilboken: logotypen (en bild i projektets filer), projektets
 * uppgifter och skedet, och logotypen på ett blad, mallblad eller en
 * stämpel.
 */

/** Byt eller ta bort kontorets logotyp. Den gamla bilden tas bort om inget annat använder den. */
export function setOfficeLogo(store: DocStore, logo: { asset: Asset; width: number; height: number } | null): void {
  const book = store.doc.graphics;
  const old = book.office?.logo;
  if (!logo && !old) return;
  const office: OfficeInfo = { ...(book.office ?? {}) };
  if (logo) office.logo = { asset: logo.asset.id, width: logo.width, height: logo.height };
  else delete office.logo;
  store.transact(logo ? 'Ny logotyp' : 'Ta bort logotypen', (tx) => {
    if (logo) tx.putAsset(logo.asset);
    const next = { ...book };
    if (Object.keys(office).length) next.office = office;
    else delete next.office;
    tx.setGraphics(next);
    // Logotyperna på bladen (`logo: true`) får den nya bilden, lika breda som förut.
    if (logo)
      for (const el of Object.values(tx.doc.elements)) {
        if (el.type !== 'Underlay' || !el.params.logo) continue;
        const size = el.params.size as [number, number];
        const wide = size[0] * (el.params.scale as number);
        tx.putElement({ ...el, params: { ...el.params, asset: logo.asset.id, size: [logo.width, logo.height], scale: wide / logo.width } });
      }
    if (old && !Object.values(tx.doc.elements).some((el) => el.params.asset === old.asset)) tx.removeAsset(old.asset);
  });
}

/** Projektets fält (gäller alla blad): ett nytt värde, eller ett nytt fält. */
export function setProjectField(store: DocStore, key: string, value: string): void {
  const fields = store.doc.project.fields;
  const v = value.trim();
  if (key in fields && fields[key] === v) return;
  store.transact(`Ändra projektets ${key}`, (tx) => tx.setProject({ ...tx.doc.project, fields: { ...tx.doc.project.fields, [key]: v } }));
}

/** Ta bort ett av projektets fält (bladen behåller inget värde för det). */
export function removeProjectField(store: DocStore, key: string): void {
  if (!(key in store.doc.project.fields)) return;
  store.transact(`Ta bort fältet ${key}`, (tx) => {
    const fields = { ...tx.doc.project.fields };
    delete fields[key];
    tx.setProject({ ...tx.doc.project, fields });
  });
}

/**
 * Projektets skede: ifyllt gäller det alla blad (som ett fält med kryss i
 * *Projekt*), tomt har bladen sina egna igen (nya blad får
 * BYGGLOVSHANDLING).
 */
export function setProjectPhase(store: DocStore, value: string): void {
  const v = value.trim();
  const now = store.doc.project.fields.skede;
  if ((now ?? '') === v && (v !== '') === ('skede' in store.doc.project.fields)) return;
  const ids = store.doc.sheets.map((s) => s.id);
  applyFieldChanges(store, ids, v ? { shared: { skede: true }, values: { skede: v } } : { shared: { skede: false } }, v ? `Skede: ${v}` : 'Skedet per blad');
}

/**
 * Lägg kontorets logotyp på ett blad, mallblad eller en stämpel, 40 mm bred
 * med nedre vänstra hörnet i `at` (mm på papperet). Den är ett underlag
 * med `logo: true`, som får den nya bilden när logotypen byts.
 */
export function placeLogo(store: DocStore, space: Id, at: [number, number], width = 40): Id | null {
  const doc = store.doc;
  const logo = doc.graphics.office?.logo;
  if (!logo) return null;
  const id = newId('el');
  const el: Element = {
    id,
    type: 'Underlay',
    storey: doc.storeys[0].id,
    states: [],
    tags: [],
    space,
    params: { asset: logo.asset, kind: 'image', pos: at, angle: 0, scale: width / logo.width, size: [logo.width, logo.height], opacity: 100, logo: true },
    props: {},
  };
  store.transact('Lägg in logotypen', (tx) => tx.putElement(el));
  return id;
}
