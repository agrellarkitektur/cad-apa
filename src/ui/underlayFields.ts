import { updateParams } from '../core/commands';
import type { Element, Id, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { moveToFolder } from '../core/treeCommands';
import { resolveParams } from '../elements/registry';
import { dxfOf, UNDERLAY_KIND_LABEL, type UnderlayParams } from '../elements/underlay';
import { hasImageGrips, resizeUnderlay } from '../elements/underlayEdit';
import { escapeHtml } from './labels';

/**
 * Underlagets fält (0.8 del 2, 0.8.16): fil, skala, läge och storlek,
 * vridning, synlighet och lager. Utbrutet ur drawingPanel.ts i 0.8.27.
 */

/** PDF: millimeter i modellen per PDF-punkt i skala 1:1. */
const MM_PER_PT = 25.4 / 72;
/** Enheter att välja för DXF-underlag. */
const DXF_UNITS: [number, string][] = [
  [1, 'mm'],
  [10, 'cm'],
  [1000, 'm'],
  [25.4, 'tum'],
  [304.8, 'fot'],
];

const comma = (n: number) => n.toLocaleString('sv-SE');

const ulNum = (key: string, label: string, v: number | string, unit: string, extra = '') =>
  `<label class="field"><span>${label}</span><span class="input-unit"><input type="text" data-expr ${unit === '°' ? 'data-unit="deg"' : unit === '' ? 'data-unit=""' : ''} inputmode="decimal" autocomplete="off" data-key="${key}" value="${v}"${extra}><i>${unit}</i></span></label>`;

/**
 * Läge och storlek (0.8.16): X och Y för nedre vänstra hörnet, bredd och
 * höjd. En bild eller PDF-sida sträcks av bredd och höjd var för sig, med
 * *Återställ proportioner*; en DXF skalas av bredden.
 */
export function underlayPlaceFields(doc: ProjectDoc, el: Element): string {
  const p = resolveParams<UnderlayParams>(doc, el);
  const w = Math.round(p.size[0] * p.scale);
  const h = Math.round(p.size[1] * p.scale);
  const ro = el.locked ? ' disabled' : '';
  const image = hasImageGrips(p);
  return `<div class="fields">
      ${ulNum('ul:x', 'X', Math.round(p.pos[0]), 'mm', ro)}
      ${ulNum('ul:y', 'Y', Math.round(p.pos[1]), 'mm', ro)}
      ${ulNum('ul:width', image ? 'Bredd' : 'Bredd i modellen', w, 'mm', ro)}
      ${image ? ulNum('ul:height', 'Höjd', h, 'mm', ro) : `<label class="field"><span>Höjd i modellen</span><span class="input-unit"><input value="${h}" readonly><i>mm</i></span></label>`}
    </div>
    ${image ? `<div class="row"><button class="btn" data-action="ul-proportions"${ro} title="Höjden efter bildens egna proportioner, med samma bredd">Återställ proportioner</button></div>` : ''}`;
}

/** Underlagets fält (0.8 del 2): fil, läge och storlek eller skala, vridning, tonat, lager och mapp. */
export function underlayFields(doc: ProjectDoc, el: Element): string {
  const p = resolveParams<UnderlayParams>(doc, el);
  const file = doc.assets[p.asset];
  const num = ulNum;
  const scale =
    p.kind === 'pdf'
      ? `<label class="field"><span>Skala (sidan i 1:1)</span><span class="input-unit scale-unit"><i>1:</i><input type="text" data-expr data-unit="" inputmode="decimal" autocomplete="off" data-key="ul:ratio" value="${Math.round((p.scale / MM_PER_PT) * 100) / 100}"></span></label>`
      : p.kind === 'dxf'
        ? `<label class="field"><span>Enhet i filen</span><select data-key="ul:unit">${DXF_UNITS.some(([f]) => Math.abs(f - p.scale) < 1e-9) ? '' : `<option selected>${comma(Math.round(p.scale * 1000) / 1000)} mm per enhet</option>`}${DXF_UNITS.map(([f, l]) => `<option value="${f}"${Math.abs(f - p.scale) < 1e-9 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`
        : '';
  const layers = p.kind === 'dxf' ? (dxfOf(doc, p.asset)?.layers ?? []) : [];
  const off = new Set(p.layersOff ?? []);
  const folders = doc.folders.filter((f) => f.tab === 'underlag');
  const folder = doc.tree[el.id] ?? '';
  return `<div class="fields">
      <label class="field"><span>Namn</span><input data-key="name:" value="${escapeHtml(el.name ?? '')}" placeholder="${escapeHtml(file?.name ?? '')}"></label>
      <label class="field"><span>Fil</span><input value="${escapeHtml(`${UNDERLAY_KIND_LABEL[p.kind]} · ${file?.name ?? 'saknas'}`)}" readonly></label>
      ${p.kind === 'pdf' ? num('ul:page', 'Sida', p.page ?? 1, '') : ''}
      ${scale}
      ${num('ul:angle', 'Vridning', Math.round(p.angle * 100) / 100, '°')}
      ${folders.length ? `<label class="field"><span>Mapp</span><select data-key="ul:folder"><option value="">Ingen mapp</option>${folders.map((f) => `<option value="${f.id}"${f.id === folder ? ' selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}</select></label>` : ''}
    </div>
    <div class="field-label">Läge och storlek</div>
    ${underlayPlaceFields(doc, el)}
    <p class="note">X och Y är nedre vänstra hörnet${p.angle ? ', före vridningen' : ''}.${hasImageGrips(p) ? ' Dra i hörnen för att skala (Shift sträcker fritt) och i sidorna för att sträcka.' : ''}</p>
    <label class="field range-field"><span>Synlighet <b>${p.opacity} %</b></span><input type="range" min="5" max="100" step="5" data-key="ul:opacity" value="${p.opacity}" aria-label="Synlighet"></label>
    ${p.kind !== 'dxf' ? `<label class="check"><input type="checkbox" data-key="ul:gray"${p.gray ? ' checked' : ''}> Gråskala</label>` : ''}
    <div class="row"><button class="btn" data-action="ul-calibrate"${el.locked ? ' disabled' : ''} title="Klicka två punkter med känt avstånd och skriv avståndet">Kalibrera skalan…</button><button class="btn" data-action="ul-align"${el.locked ? ' disabled' : ''} title="Klicka två punkter längs en linje som ska bli rak">Rikta…</button></div>
    ${
      layers.length
        ? `<div class="field-label">Lager i DXF-filen</div><div class="view-checks layer-checks" role="group" aria-label="Lager">${layers
            .map((l) => `<label class="check"><input type="checkbox" data-key="ul:layer" value="${escapeHtml(l)}"${off.has(l) ? '' : ' checked'}> ${escapeHtml(l)}</label>`)
            .join('')}</div>`
        : ''
    }
    <p class="note">${el.locked ? 'Låst: underlaget kan inte flyttas eller ändras av misstag.' : 'Lås underlaget när det ligger rätt, så att det inte flyttas av misstag.'}</p>`;
}

/** Ändringar i underlagets fält (`ul:…`). */
export function underlayChange(store: DocStore, ids: Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const doc = store.doc;
  const els = ids.map((id) => doc.elements[id]).filter(Boolean);
  const el = els[0];
  if (!el) return true;
  const p = resolveParams<UnderlayParams>(doc, el);
  const num = Number(input.value.replace(',', '.').replace(/\s/g, ''));
  // Ny skala kring mitten, så att underlaget ligger kvar där det är.
  const rescale = (scale: number, label: string) => {
    if (!(scale > 0)) return;
    const f = scale / p.scale;
    const r = (p.angle * Math.PI) / 180;
    const cx = (p.size[0] * p.scale) / 2;
    const cy = (p.size[1] * p.scale) / 2;
    const mid = [p.pos[0] + Math.cos(r) * cx - Math.sin(r) * cy, p.pos[1] + Math.sin(r) * cx + Math.cos(r) * cy];
    updateParams(store, [el.id], { scale, pos: [Math.round(mid[0] + (p.pos[0] - mid[0]) * f), Math.round(mid[1] + (p.pos[1] - mid[1]) * f)] }, label);
  };
  if (name === 'ratio' && num > 0) rescale(num * MM_PER_PT, 'Ändra skala');
  else if (name === 'unit' && num > 0) rescale(num, 'Ändra enhet');
  else if (name === 'x' && Number.isFinite(num)) updateParams(store, [el.id], { pos: [num, p.pos[1]] }, 'Flytta underlaget');
  else if (name === 'y' && Number.isFinite(num)) updateParams(store, [el.id], { pos: [p.pos[0], num] }, 'Flytta underlaget');
  else if ((name === 'width' || name === 'height') && num > 0 && hasImageGrips(p)) {
    const r = resizeUnderlay(p, name === 'width' ? num : null, name === 'height' ? num : null);
    if (r) updateParams(store, [el.id], r, name === 'width' ? 'Ändra bredd' : 'Ändra höjd');
  } else if (name === 'width' && num > 0) rescale(num / p.size[0], 'Ändra storlek');
  else if (name === 'angle' && Number.isFinite(num)) {
    // Vrid kring nedre vänstra hörnet.
    updateParams(store, [el.id], { angle: ((num % 360) + 360) % 360 }, 'Vrid underlaget');
  } else if (name === 'page' && num >= 1) updateParams(store, [el.id], { page: Math.round(num) }, 'Byt sida');
  else if (name === 'opacity' && num > 0) updateParams(store, ids, { opacity: Math.max(5, Math.min(100, Math.round(num))) }, 'Ändra synlighet');
  else if (name === 'gray') updateParams(store, ids, { gray: (input as HTMLInputElement).checked }, 'Gråskala');
  else if (name === 'folder') moveToFolder(store, el.id, input.value || null);
  else if (name === 'layer') {
    const set = new Set(p.layersOff ?? []);
    if ((input as HTMLInputElement).checked) set.delete(input.value);
    else set.add(input.value);
    updateParams(store, [el.id], { layersOff: [...set] }, (input as HTMLInputElement).checked ? `Tänd ${input.value}` : `Släck ${input.value}`);
  }
  return true;
}
