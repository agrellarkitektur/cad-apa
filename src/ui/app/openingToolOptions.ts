import { openingSettingsOf } from '../../core/general';
import { addDefaultHoleTypes, openingTypesOf } from '../../core/openings';
import { frameFromModule, holeOf, kindOfElementType, type OpeningKind } from '../../core/openingTypes';
import type { DocStore } from '../../core/store';
import { escapeHtml } from '../labels';
import { moduleLabel, parseModule } from '../openingFields';
import type { OpeningTool } from '../tools/openingTool';
import type { AppContext } from './context';

/**
 * Verktygsraden för Fönster och Dörr (0.11.8, tavla 2): typen, modulmåttet
 * och karmyttermåttet (skrivs fritt), höjdläget (överkant karm som förval,
 * eller bröstning), hängningen sedd utifrån (*Spegla*, S), karmens läge och
 * vilken littera nästa objekt får.
 */

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/** Verktyget för Dörr, Fönster eller Vägghål, om något av dem är valt. */
export function openingToolOf(app: AppContext): OpeningTool | null {
  const id = app.ui.tool;
  return id === 'door' ? app.doorTool : id === 'window' ? app.windowTool : id === 'hole' ? app.holeTool : null;
}

export function openingOptionsMarkup(store: DocStore, t: OpeningTool): string {
  const doc = store.doc;
  const kind = kindOfElementType(t.kind) as OpeningKind;
  const types = openingTypesOf(doc, kind);
  if (!t.options.definition || !doc.definitions[t.options.definition]) t.options.definition = types[0]?.id ?? null;
  const groups = new Map<string, typeof types>();
  for (const d of types) groups.set(d.opening!.group, [...(groups.get(d.opening!.group) ?? []), d]);
  const opts = [...groups.entries()].map(([g, list]) => `<optgroup label="${escapeHtml(g)}">${list.map((d) => `<option value="${d.id}"${d.id === t.options.definition ? ' selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}</optgroup>`).join('');
  if (kind === 'hole') return holeOptionsMarkup(store, t, opts, types.length);
  const p = t.preview();
  const st = openingSettingsOf(doc.graphics);
  const door = kind === 'door';
  const ref = t.options.heightRef ?? (p.floor ? 'sill' : 'head');
  const hv = t.options.height ?? (ref === 'head' ? st.head : (p.sill ?? 900));
  const o = t.options;
  const place = o.place ?? 'out';
  const num = (id: string, value: number | string, title: string, w = 58) => `<input id="${id}" type="text" data-expr inputmode="decimal" autocomplete="off" value="${value}" title="${escapeHtml(title)}" style="width:${w}px">`;
  return `
    <label class="opt"><span>Typ</span><select id="opening-def" aria-label="Typ">${opts}</select></label>
    <label class="opt"><span>Modulmått</span><input id="opening-module" value="${escapeHtml(moduleLabel(p))}" title="T.ex. 12×13 (moduler) eller 1200×1300 (mm)" style="width:96px"></label>
    <span class="opt"><span>Karmyttermått</span>${num('opening-fw', Math.round(p.frameW), 'Karmyttermåttets bredd, mm (skrivs fritt)')} × ${num('opening-fh', Math.round(p.frameH), 'Karmyttermåttets höjd, mm')}</span>
    ${
      door
        ? ''
        : `<span class="opt"><span>Höjdläge</span><select id="opening-ref"><option value="head"${ref === 'head' ? ' selected' : ''}>Överkant karm</option><option value="sill"${ref === 'sill' ? ' selected' : ''}>Bröstning</option></select>${num('opening-height', hv, ref === 'head' ? 'Överkant karm över golvet, mm' : 'Bröstning (hålets underkant) över golvet, mm')}</span>`
    }
    <div class="opt"><span>Hängning</span><div class="segmented" role="group" aria-label="Hängning sedd utifrån">
      <button data-opening-mirror="0" aria-pressed="${!o.mirror}" title="Som typen, sedd utifrån">Som typen</button>
      <button data-opening-mirror="1" aria-pressed="${!!o.mirror}" title="Spegelvänd (S)">Speglad</button>
    </div></div>
    <span class="opt"><span>Karmens läge</span><select id="opening-place"><option value="out"${place === 'out' ? ' selected' : ''}>Liv ute</option><option value="in"${place === 'in' ? ' selected' : ''}>Liv inne</option><option value="mid"${place === 'mid' ? ' selected' : ''}>Mitt</option></select>${num('opening-inset', o.inset ?? 0, 'Avstånd från livet, mm', 44)}</span>
    <span class="opt-hint">${door ? 'Peka på en vägg och klicka. Sidan du pekar på blir slagsidan, gångjärnen hamnar närmast markören.' : 'Peka på en vägg och klicka där fönstret ska sitta.'} Hålet ${nf.format(p.holeW)} × ${nf.format(p.holeH)}.</span>`;
}

/**
 * Vägghålets rad (0.11.8.3): typen, måttet i mm (diametern för en
 * genomföring) och underkanten över golvet. Saknar projektet vägghålstyper
 * finns en knapp som lägger in de förvalda.
 */
function holeOptionsMarkup(store: DocStore, t: OpeningTool, opts: string, n: number): string {
  const p = t.preview();
  const m = t.options.definition ? store.doc.definitions[t.options.definition]?.opening : undefined;
  const round = !!m && holeOf(m).shape === 'round';
  const num = (id: string, value: number, title: string, w = 58) => `<input id="${id}" type="text" data-expr inputmode="decimal" autocomplete="off" value="${value}" title="${escapeHtml(title)}" style="width:${w}px">`;
  const sill = t.options.height ?? p.sill ?? 300;
  return `
    ${n ? `<label class="opt"><span>Typ</span><select id="opening-def" aria-label="Typ">${opts}</select></label>` : '<button class="btn btn-small" data-opening-defaults="hole" title="Ventgaller, Nisch, Genomföring och Rent hål">Lägg in vägghålens typer</button>'}
    ${round ? `<span class="opt"><span>Diameter</span>${num('opening-hw', Math.round(p.holeW), 'Hålets diameter, mm')}</span>` : `<span class="opt"><span>Mått</span>${num('opening-hw', Math.round(p.holeW), 'Hålets bredd, mm')} × ${num('opening-hh', Math.round(p.holeH), 'Hålets höjd, mm')}</span>`}
    <span class="opt"><span>Underkant</span>${num('opening-height', sill, 'Hålets underkant över golvet, mm (negativt under golvet, t.ex. i sockeln)')}</span>
    <span class="opt-hint">Peka på en vägg och klicka.${m && holeOf(m).depth !== null ? ' Nischen hamnar på den sida du pekar på.' : ''}</span>`;
}

/** Ett ändrat fält i raden; true om det hörde hit. */
export function openingOptionChange(store: DocStore, t: OpeningTool, el: HTMLInputElement | HTMLSelectElement, value: number): boolean {
  const o = t.options;
  switch (el.id) {
    case 'opening-def':
      o.definition = el.value;
      o.frame = null;
      o.module = null;
      o.height = null;
      o.heightRef = undefined;
      return true;
    case 'opening-module': {
      const mod = parseModule(el.value);
      if (mod) {
        o.module = mod;
        o.frame = null;
      }
      return true;
    }
    case 'opening-fw':
    case 'opening-fh': {
      if (!(value >= 50)) return true;
      const p = t.preview();
      const fr: [number, number] = [p.frameW, p.frameH];
      fr[el.id === 'opening-fw' ? 0 : 1] = Math.round(value);
      const st = openingSettingsOf(store.doc.graphics);
      const mod: [number, number] = [Math.round((fr[0] + p.frameLess) / 100) * 100, Math.round((fr[1] + p.frameLess) / 100) * 100];
      o.module = mod;
      const m = t.options.definition ? store.doc.definitions[t.options.definition]?.opening : undefined;
      const onModule = m ? frameFromModule(m, mod, st) : null;
      o.frame = onModule && onModule[0] === fr[0] && onModule[1] === fr[1] ? null : fr;
      return true;
    }
    case 'opening-ref':
      o.heightRef = el.value === 'sill' ? 'sill' : 'head';
      o.height = null;
      return true;
    case 'opening-hw':
    case 'opening-hh': {
      // Vägghålen har måttet i mm (0.11.8.3); en rund genomföring lika i båda.
      if (!(value >= 10)) return true;
      const p = t.preview();
      const m = o.definition ? store.doc.definitions[o.definition]?.opening : undefined;
      const v = Math.round(value);
      o.module = m && holeOf(m).shape === 'round' ? [v, v] : el.id === 'opening-hw' ? [v, Math.round(p.holeH)] : [Math.round(p.holeW), v];
      o.frame = null;
      return true;
    }
    case 'opening-height':
      if (Number.isFinite(value)) o.height = Math.round(value);
      return true;
    case 'opening-place':
      o.place = el.value as 'out' | 'in' | 'mid';
      return true;
    case 'opening-inset':
      o.inset = Number.isFinite(value) ? Math.round(value) : null;
      return true;
  }
  return false;
}

/** Knapparna i raden; true om klicket hörde hit. */
export function openingOptionClick(store: DocStore, t: OpeningTool, target: HTMLElement): boolean {
  if (target.closest('[data-opening-defaults]')) {
    addDefaultHoleTypes(store);
    t.options.definition = openingTypesOf(store.doc, 'hole')[0]?.id ?? null;
    return true;
  }
  const m = target.closest<HTMLElement>('[data-opening-mirror]')?.dataset.openingMirror;
  if (m === undefined) return false;
  t.options.mirror = m === '1';
  return true;
}
