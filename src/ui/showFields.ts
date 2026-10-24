import { addViewTag, setShowIn } from '../core/commands';
import { onPaper as paperSpace, type Element, type Id, type ProjectDoc, type ShowIn } from '../core/model';
import type { DocStore } from '../core/store';
import { allViews, countViews, homeOf } from '../core/visibility';
import { markerName } from '../elements/markers';
import { escapeHtml } from './labels';

/**
 * Visas i (0.8): i vilka vyer ett 2D-element, en text, ett mått eller ett
 * underlag syns. Utbrutet ur drawingPanel.ts i 0.8.27.
 */

/** Typer som har Visas i: det som är ritningsinformation och kan visas i vissa vyer. */
export const SHOWABLE = new Set(['Shape2D', 'Text', 'Dimension', 'Underlay']);

type ShowChoice = 'all' | 'this' | 'views' | 'tags';

function choiceOf(show: ShowIn | undefined, here: Id): ShowChoice {
  if (!show) return 'all';
  if (show.kind === 'tags') return 'tags';
  return show.views.length === 1 && show.views[0] === here ? 'this' : 'views';
}

/** Ytans namn: "våningen", "fasaden", "sektionen". */
function placeWord(doc: ProjectDoc, el: Element): string {
  const home = doc.elements[homeOf(el)];
  if (home?.type === 'Section') return 'sektionen';
  if (home?.type === 'Elevation') return 'fasaden';
  const ws = doc.worksheets.find((w) => w.id === homeOf(el));
  if (ws) return ws.stamp ? 'stämpeln' : ws.paper ? 'mallbladet' : 'arbetsbladet';
  if (doc.sheets.some((s) => s.id === homeOf(el))) return 'bladet';
  return 'våningen';
}

/**
 * Visas i: alla vyer av ytan, bara den här vyn, utvalda vyer eller vyer med
 * taggar. Under står hur många vyer det syns i, med en varning om det blir noll.
 */
export function showSection(doc: ProjectDoc, els: Element[], here: Id): string {
  if (!els.length || !els.every((e) => SHOWABLE.has(e.type))) return '';
  // På ett mallblad och ett ritningsblad finns bara en vy: själva bladet (0.8.9).
  const onPaper = (e: Element) => doc.sheets.some((s) => s.id === e.space) || doc.worksheets.some((w) => w.id === e.space && paperSpace(w));
  if (els.some(onPaper)) return '';
  const el = els[0];
  const same = els.every((e) => JSON.stringify(e.show ?? null) === JSON.stringify(el.show ?? null));
  const show = same ? el.show : undefined;
  const choice = same ? (listOpen && show?.kind === 'views' ? 'views' : choiceOf(show, here)) : null;
  const opt = (v: ShowChoice, label: string) => `<option value="${v}"${choice === v ? ' selected' : ''}>${label}</option>`;
  const parts: string[] = [];
  parts.push(`<label class="field"><span>Visas i</span><select data-key="show:kind">${choice ? '' : '<option selected disabled>Blandat</option>'}${opt('all', `Alla vyer av ${placeWord(doc, el)}`)}${opt('this', 'Bara den här vyn')}${opt('views', 'Utvalda vyer')}${opt('tags', 'Vyer med taggar')}</select></label>`);
  if (show?.kind === 'views' && choice === 'views') {
    const views = allViews(doc);
    const name = (v: (typeof views)[number]) => {
      if (!v.model) return v.name;
      const m = doc.elements[v.place];
      return m ? `${markerName(doc, m)} · modell` : v.name;
    };
    parts.push(`<div class="view-checks" role="group" aria-label="Vyer">${views
      .map((v) => `<label class="check"><input type="checkbox" data-key="show:view" value="${escapeHtml(v.id)}"${show.views.includes(v.id) ? ' checked' : ''}> ${escapeHtml(name(v))}${v.id === here ? ' <small>(den här)</small>' : ''}</label>`)
      .join('')}</div>`);
  }
  if (show?.kind === 'tags') {
    parts.push(`<div class="segmented wide" role="group" aria-label="Hur taggarna gäller">
        <button data-action="show-match" data-match="any" aria-pressed="${show.match === 'any'}">Någon av</button>
        <button data-action="show-match" data-match="all" aria-pressed="${show.match === 'all'}">Alla</button>
      </div>
      <div class="tag-chips">${doc.viewTags
        .map((t) => `<button class="state-chip ${show.tags.includes(t) ? 'on' : 'off'}" data-action="show-tag" data-tag="${escapeHtml(t)}" aria-pressed="${show.tags.includes(t)}"><span class="box"></span>${escapeHtml(t)}</button>`)
        .join('')}</div>
      <div class="row"><input id="new-view-tag" placeholder="Ny vy-tagg" aria-label="Ny vy-tagg"><button class="btn" data-action="add-view-tag">Lägg till</button></div>`);
  }
  if (same) {
    const n = countViews(doc, el);
    parts.push(n === 0
      ? `<p class="note warn" role="note"><b>!</b> Syns nu i 0 vyer. ${show?.kind === 'tags' ? 'Ge någon vy taggarna i projektträdet, eller välj andra taggar.' : 'Välj minst en vy.'}</p>`
      : `<p class="note">Syns nu i ${n} ${n === 1 ? 'vy' : 'vyer'}.</p>`);
  }
  return `<section><h3>Visas i</h3>${parts.join('')}</section>`;
}

/** Ändringar i Visas i (`show:…`). */
export function showChange(store: DocStore, ids: Id[], name: string, input: HTMLInputElement | HTMLSelectElement, here: Id): boolean {
  const doc = store.doc;
  const els = ids.map((id) => doc.elements[id]).filter(Boolean);
  if (name === 'kind') {
    const c = input.value as ShowChoice;
    const show: ShowIn | null =
      c === 'all' ? null : c === 'this' ? { kind: 'views', views: [here] } : c === 'views' ? { kind: 'views', views: [here] } : { kind: 'tags', tags: [], match: 'any' };
    setShowIn(store, ids, show);
    // "Utvalda vyer" börjar med den här vyn ikryssad men visar listan.
    listOpen = c === 'views';
    return true;
  }
  if (name === 'view') {
    const cur = els[0]?.show;
    if (cur?.kind !== 'views') return true;
    const on = (input as HTMLInputElement).checked;
    const views = on ? [...new Set([...cur.views, input.value])] : cur.views.filter((v) => v !== input.value);
    // Med bara den här vyn kvar visas ändå listan; användaren valde Utvalda vyer.
    listOpen = true;
    setShowIn(store, ids, { kind: 'views', views });
    return true;
  }
  return false;
}

/**
 * "Utvalda vyer" med bara den här vyn ikryssad sparas likadant som "Bara den
 * här vyn". När användaren valt Utvalda vyer visas listan ändå, tills
 * markeringen byts (`resetShowList`).
 */
let listOpen = false;
export function resetShowList(): void {
  listOpen = false;
}

/** Klick på knapparna i Visas i (taggarna). Svarar true om klicket hanterades. */
export function showClick(store: DocStore, ids: Id[], b: HTMLElement, root: HTMLElement): boolean {
  const doc = store.doc;
  const el = doc.elements[ids[0]];
  switch (b.dataset.action) {
    case 'show-match': {
      if (el?.show?.kind !== 'tags') return true;
      setShowIn(store, ids, { ...el.show, match: b.dataset.match === 'all' ? 'all' : 'any' });
      return true;
    }
    case 'show-tag': {
      if (el?.show?.kind !== 'tags') return true;
      const t = b.dataset.tag!;
      const tags = el.show.tags.includes(t) ? el.show.tags.filter((x) => x !== t) : [...el.show.tags, t];
      setShowIn(store, ids, { ...el.show, tags });
      return true;
    }
    case 'add-view-tag': {
      const input = root.querySelector<HTMLInputElement>('#new-view-tag');
      const t = input ? addViewTag(store, input.value) : null;
      if (t && el?.show?.kind === 'tags' && !el.show.tags.includes(t)) setShowIn(store, ids, { ...el.show, tags: [...el.show.tags, t] });
      return true;
    }
  }
  return false;
}
