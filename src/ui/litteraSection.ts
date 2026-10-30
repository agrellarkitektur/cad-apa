import type { LeaderKind } from '../core/graphics';
import type { Element, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { LEADER_ATTACH, LEADER_ENDS, LEADER_SIDES, type LeaderAttach, type LeaderEnd, type LeaderSide, type TagParams } from '../elements/leader';
import { escapeHtml } from './labels';

/**
 * Litterans del i egenskaperna (0.10.20.1), gemensam för alla sorter:
 * stammens sida och längd, änden och *Litteran tillbaka*. Texten, punkten
 * och knäcken dras med greppen i planen.
 */

/** Littera-sorten för ett objekt, eller null om det inte har någon littera med ledare. */
export function leaderKindOf(el: Element): LeaderKind | null {
  if (el.type === 'Wall' || el.type === 'Door' || el.type === 'Window' || el.type === 'Space') return el.type;
  if (el.type === 'Ground' && el.params.kind === 'wall') return 'Ground';
  if (el.type === 'Label') return 'Label';
  return null;
}

const KIND_LABEL: Record<LeaderKind, string> = { Wall: 'väggar', Door: 'dörrar', Window: 'fönster', Space: 'rum', Ground: 'stödmurar', Label: 'generell littera' };

export function litteraSection(doc: ProjectDoc, els: Element[]): string {
  const kinds = els.map(leaderKindOf);
  if (!els.length || kinds.some((k) => !k)) return '';
  const kind = kinds[0]!;
  const tag = ((els[0].params as { tag?: TagParams }).tag ?? {}) as TagParams;
  const style = doc.graphics.labels.leaders[kind];
  const endName = LEADER_ENDS.find(([k]) => k === style.end)?.[1] ?? '';
  const side = LEADER_SIDES.map(([k, l]) => `<option value="${k}"${(tag.side ?? 'auto') === k ? ' selected' : ''}>${l}</option>`).join('');
  const end = [`<option value=""${tag.end ? '' : ' selected'}>Som stilboken (${escapeHtml(endName.toLowerCase())})</option>`, ...LEADER_ENDS.map(([k, l]) => `<option value="${k}"${tag.end === k ? ' selected' : ''}>${l}</option>`)].join('');
  const attachName = LEADER_ATTACH.find(([k]) => k === style.attach)?.[1] ?? '';
  const attach = [`<option value=""${tag.attach ? '' : ' selected'}>Som stilboken (${escapeHtml(attachName.toLowerCase())})</option>`, ...LEADER_ATTACH.map(([k, l]) => `<option value="${k}"${tag.attach === k ? ' selected' : ''}>${l}</option>`)].join('');
  const moved = els.some((e) => {
    const t = (e.params as { tag?: TagParams }).tag;
    return !!(t && Object.keys(t).length) || (e.type === 'Space' && !!e.params.labelAt);
  });
  const sameKind = kinds.every((k) => k === kind);
  return `<section>
    <h3>Littera</h3>
    <div class="fields">
      <label class="field"><span>Stammens sida</span><select data-key="tag:side">${side}</select></label>
      <label class="field"><span>Ände</span><select data-key="tag:end">${sameKind ? end : end.replace(/Som stilboken \([^)]*\)/, 'Som stilboken')}</select></label>
      <label class="field"><span>Mot texten</span><select data-key="tag:attach">${sameKind ? attach : attach.replace(/Som stilboken \([^)]*\)/, 'Som stilboken')}</select></label>
      <label class="field" for="f-tag-stub"><span>Stammens längd</span><span class="input-unit"><input type="text" data-expr data-step="0.5" inputmode="decimal" autocomplete="off" id="f-tag-stub" data-key="tag:stub" value="${tag.stub ?? ''}" placeholder="${sameKind ? style.stub : ''}"><i>mm</i></span></label>
    </div>
    <div class="row"><button class="btn" data-action="tag-reset"${moved ? '' : ' disabled'} title="Litteran, punkten och stammen tillbaka till förvalet">Litteran tillbaka</button></div>
    <p class="note">Dra i texten eller romben där ledaren lämnar texten för att flytta litteran (den står lika långt från objektet på papperet i alla skalor), i den runda punkten för att flytta vad ledaren pekar på och i fyrkanten för stammens längd. Shift håller den sneda delen i steg om 15°. Stammens längd är på papperet; förvalen för ${KIND_LABEL[kind]} står i stilboken under Texter och littera.</p>
  </section>`;
}

/** Samma slags ändring i varje objekt, i en transaktion. */
function patchEach(store: DocStore, ids: string[], label: string, patch: (p: Record<string, unknown>, el: Element) => Record<string, unknown>): void {
  const doc = store.doc;
  const patches = ids.filter((id) => doc.elements[id]).map((id) => [id, patch(doc.elements[id].params, doc.elements[id])] as const);
  store.transact(label, (tx) => {
    for (const [id, q] of patches) {
      const el = tx.doc.elements[id];
      if (el) tx.putElement({ ...el, params: { ...el.params, ...q } });
    }
  });
}

/** Ett ändrat fält i litterans del. */
export function applyTagField(store: DocStore, ids: string[], name: string, value: string): boolean {
  const set = (p: Record<string, unknown>, k: keyof TagParams, v: unknown) => {
    const tag = { ...((p.tag as TagParams | undefined) ?? {}), [k]: v };
    if (v === undefined) delete tag[k];
    return { tag: Object.keys(tag).length ? tag : undefined };
  };
  if (name === 'side') {
    const v = LEADER_SIDES.some(([k]) => k === value) ? (value as LeaderSide) : 'auto';
    patchEach(store, ids, 'Stammens sida', (p) => set(p, 'side', v === 'auto' ? undefined : v));
    return true;
  }
  if (name === 'end') {
    const v = LEADER_ENDS.some(([k]) => k === value) ? (value as LeaderEnd) : undefined;
    patchEach(store, ids, 'Ledarens ände', (p) => set(p, 'end', v));
    return true;
  }
  if (name === 'attach') {
    const v = LEADER_ATTACH.some(([k]) => k === value) ? (value as LeaderAttach) : undefined;
    patchEach(store, ids, 'Ledaren mot texten', (p) => set(p, 'attach', v));
    return true;
  }
  if (name === 'stub') {
    const t = value.trim();
    const v = Number(t.replace(',', '.'));
    if (t && !(Number.isFinite(v) && v >= 0)) return false;
    patchEach(store, ids, 'Stammens längd', (p) => set(p, 'stub', t ? Math.round(v * 2) / 2 : undefined));
    return true;
  }
  return false;
}

/** *Litteran tillbaka*: text, punkt och stam som förvalet (rummets stämpel i mitten). */
export function resetTags(store: DocStore, ids: string[]): void {
  patchEach(store, ids, 'Litteran tillbaka', (p, el) => {
    const tag = { ...((p.tag as TagParams | undefined) ?? {}) };
    delete tag.at;
    delete tag.to;
    delete tag.stub;
    return { tag: Object.keys(tag).length ? tag : undefined, ...(el.type === 'Space' ? { labelAt: undefined } : {}) };
  });
}
