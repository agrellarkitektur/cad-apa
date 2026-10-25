import type { StyleSheet } from '../../core/graphics';
import { formatDash, parseDash } from '../../core/lineTypes';
import { newFillTypeId, parsePat, type CustomFillType, type FillFamily, type FillTypeDef } from '../../core/fillTypes';
import { escapeHtml } from '../labels';
import { fillTypeSwatch } from '../patternPick';

/**
 * Fyllningstyperna i stilmallen (0.8.36): projektets egna, med en rad per
 * linjefamilj (vinkel, baspunkt, avstånd, förskjutning och streckning), och
 * knappar för att läsa in och spara `.pat`-filer. `uses` är hur många former,
 * rum och snittfyllningar som har varje typ, så att det syns vad en
 * borttagning påverkar (de ritas då som en vanlig skraffering).
 */
export function fillTypeSection(style: StyleSheet, uses: ReadonlyMap<string, number>): string {
  const comma = (n: number) => String(Math.round(n * 10000) / 10000).replace('.', ',');
  const own = (style.fillTypes ?? [])
    .map((t) => {
      const n = uses.get(t.id) ?? 0;
      const id = escapeHtml(t.id);
      const num = (i: number, field: keyof FillFamily, v: number, label: string, unit: string) =>
        `<label><span>${label}</span><span class="input-unit"><input type="text" data-expr${unit === '°' ? ' data-unit="deg"' : ''} inputmode="decimal" autocomplete="off" data-filltype="${id}:${i}:${field}" value="${comma(v)}"><i>${unit}</i></span></label>`;
      const rows = t.families
        .map(
          (f, i) => `<div class="filltype-family">
          ${num(i, 'angle', f.angle, 'Vinkel', '°')}
          ${num(i, 'spacing', f.spacing, 'Avstånd', 'mm')}
          ${num(i, 'shift', f.shift, 'Förskjutning', 'mm')}
          ${num(i, 'x', f.x, 'X', 'mm')}
          ${num(i, 'y', f.y, 'Y', 'mm')}
          <label class="filltype-dash"><span>Streckning</span><input type="text" data-filltype="${id}:${i}:dash" value="${f.dash.length ? formatDash(f.dash) : ''}" placeholder="Heldragen" inputmode="decimal" autocomplete="off"></label>
          <button class="btn" data-action="filltype-family-remove" data-filltype-id="${id}" data-family="${i}"${t.families.length > 1 ? '' : ' disabled'} title="Ta bort linjefamiljen">×</button>
        </div>`,
        )
        .join('');
      return `<div class="filltype">
        <div class="filltype-head">
          <input type="text" data-filltype="${id}:name" value="${escapeHtml(t.name)}" aria-label="Namn">
          ${fillTypeSwatch(t, 'currentColor', 44, 28)}
          <label><span>Måtten</span><select data-filltype="${id}:units"><option value="paper"${t.model ? '' : ' selected'}>På papper</option><option value="model"${t.model ? ' selected' : ''}>I verkligheten</option></select></label>
          <button class="btn" data-action="filltype-family-add" data-filltype-id="${id}">Ny linjefamilj</button>
          <button class="btn" data-action="filltype-remove" data-filltype-id="${id}" title="${n ? `Används av ${n}; de ritas som skraffering` : 'Används inte'}">Ta bort</button>
        </div>
        ${rows}
      </div>`;
    })
    .join('');
  return `<section class="style-labels style-filltypes">
    <h3>Fyllningstyper</h3>
    <p class="note">Ett mönster av en eller flera linjefamiljer, som i AutoCADs och ArchiCADs .pat-filer: parallella linjer med vinkel, avstånd mellan linjerna, förskjutning längs linjen från en linje till nästa, baspunkt (X, Y) och streckning (streck och mellanrum omväxlande, som linjetyperna). Måtten är i mm på papper, eller i verkligheten för mönster som tegel och plattor. Typerna väljs bland fyllningarna för 2D-former, rum och snittytor, och följer med stilmallen.</p>
    ${own}
    <div class="row">
      <button class="btn" data-action="filltype-add">Ny fyllningstyp</button>
      <button class="btn" data-action="filltype-import">Läs in .pat…</button>
      ${style.fillTypes?.length ? '<button class="btn" data-action="filltype-export">Spara som .pat…</button>' : ''}
    </div>
  </section>`;
}

/** Ändra en fyllningstyp i `style` (en kopia) efter fältet; null om fältet inte hör hit, '' om värdet inte gick att läsa. */
export function applyFillTypeField(style: StyleSheet, input: HTMLInputElement | HTMLSelectElement): string | null {
  const key = input.dataset.filltype;
  if (!key) return null;
  const parts = key.split(':');
  const field = parts.pop()!;
  const index = parts.length > 1 && /^\d+$/.test(parts[parts.length - 1]) ? Number(parts.pop()) : null;
  const id = parts.join(':');
  const t = style.fillTypes?.find((x) => x.id === id);
  if (!t) return null;
  if (index === null) {
    if (field === 'name') {
      const name = input.value.trim();
      if (!name || name === t.name) return null;
      t.name = name;
      return 'Byt namn på fyllningstyp';
    }
    if (field === 'units') {
      if (input.value === 'model') t.model = true;
      else delete t.model;
      return 'Ändra fyllningstyp';
    }
    return null;
  }
  const f = t.families[index];
  if (!f) return null;
  if (field === 'dash') {
    if (!input.value.trim()) f.dash = [];
    else {
      const dash = parseDash(input.value);
      if (!dash) return '';
      f.dash = dash;
    }
    return 'Ändra fyllningstyp';
  }
  const v = Number(input.value.replace(',', '.'));
  if (!Number.isFinite(v)) return '';
  if (field === 'spacing') {
    if (!(v > 0)) return '';
    f.spacing = v;
  } else if (field === 'angle' || field === 'shift' || field === 'x' || field === 'y') f[field] = v;
  else return null;
  return 'Ändra fyllningstyp';
}

/** En ny fyllningstyp: en linjefamilj i 45°, 2 mm isär. */
export function addFillType(style: StyleSheet, from?: FillTypeDef): CustomFillType {
  const t: CustomFillType = from
    ? { ...structuredClone(from), id: newFillTypeId(style) }
    : { id: newFillTypeId(style), name: `Egen fyllning ${(style.fillTypes?.length ?? 0) + 1}`, families: [{ angle: 45, x: 0, y: 0, spacing: 2, shift: 0, dash: [] }] };
  (style.fillTypes ??= []).push(t);
  return t;
}

/** Ta bort en fyllningstyp; snittfyllningar som hade den ritas som skraffering. False om den inte fanns. */
export function removeFillType(style: StyleSheet, id: string): boolean {
  const i = style.fillTypes?.findIndex((t) => t.id === id) ?? -1;
  if (i < 0) return false;
  style.fillTypes!.splice(i, 1);
  if (!style.fillTypes!.length) delete style.fillTypes;
  return true;
}

/** En ny linjefamilj i typen, vinkelrät mot den sista. */
export function addFamily(style: StyleSheet, id: string): boolean {
  const t = style.fillTypes?.find((x) => x.id === id);
  if (!t) return false;
  const last = t.families[t.families.length - 1];
  t.families.push({ angle: ((last?.angle ?? 45) + 90) % 360, x: 0, y: 0, spacing: last?.spacing ?? 2, shift: 0, dash: [] });
  return true;
}

export function removeFamily(style: StyleSheet, id: string, index: number): boolean {
  const t = style.fillTypes?.find((x) => x.id === id);
  if (!t || t.families.length < 2 || !t.families[index]) return false;
  t.families.splice(index, 1);
  return true;
}

/**
 * Typerna i en `.pat`-fil läggs till (0.8.36). En typ med samma namn som en
 * som finns byter ut dess linjer, så att en fil kan läsas in igen. Ger hur
 * många som lades till och byttes ut.
 */
export function importPat(style: StyleSheet, text: string): { added: number; replaced: number } {
  let added = 0;
  let replaced = 0;
  for (const t of parsePat(text)) {
    const same = style.fillTypes?.find((x) => x.name.toLowerCase() === t.name.toLowerCase());
    if (same) {
      same.families = t.families;
      if (t.model) same.model = true;
      else delete same.model;
      replaced++;
    } else {
      addFillType(style, t);
      added++;
    }
  }
  return { added, replaced };
}
