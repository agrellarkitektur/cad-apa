import type { StyleResources } from '../../core/graphics';
import { formatDash, parseDash } from '../../core/lineTypes';
import { FILL_TYPES, newFillTypeId, type CustomFillType, type FillFamily, type FillTypeDef } from '../../core/fillTypes';
import { parsePat } from '../../core/patFile';
import { escapeHtml } from '../labels';
import { icons } from '../icons';
import { fillTypeSwatch } from '../patternPick';

/**
 * Fyllningstyperna i stilboken (0.8.36): projektets egna, med en rad per
 * linjefamilj (vinkel, baspunkt, avstånd, förskjutning och streckning), och
 * knappar för att läsa in och spara `.pat`-filer. `uses` är hur många former,
 * rum och snittfyllningar som har varje typ, så att det syns vad en
 * borttagning påverkar (de ritas då som en vanlig skraffering).
 */
export function fillTypeSection(style: StyleResources, uses: ReadonlyMap<string, number>): string {
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
          <label><span>Linjer</span><select data-filltype="${id}:weight">${weightOptions(t.weight)}</select></label>
          <label><span>Måtten</span><select data-filltype="${id}:units"><option value="paper"${t.model ? '' : ' selected'}>På papper</option><option value="model"${t.model ? ' selected' : ''}>I verkligheten</option></select></label>
          <button class="btn" data-action="filltype-family-add" data-filltype-id="${id}">Ny linjefamilj</button>
          <button class="icon-btn rc-icon" data-action="filltype-remove" data-filltype-id="${id}" title="Ta bort. ${n ? `Används av ${n}; de ritas som skraffering` : 'Används inte'}" aria-label="Ta bort">${icons.trash}</button>
        </div>
        ${rows}
      </div>`;
    })
    .join('');
  // De inbyggda (0.8.37): att se, och att kopiera till en egen som går att ändra.
  const builtIn = Object.entries(FILL_TYPES)
    .map(
      ([id, t]) => `<div class="filltype-builtin">${fillTypeSwatch(t, 'currentColor', 44, 28)}<span class="filltype-bname">${escapeHtml(t.name)}<small>${t.model ? 'i verkligheten' : 'på papper'}</small></span><button class="btn" data-action="filltype-copy" data-filltype-id="${escapeHtml(id)}" title="Gör en egen kopia att ändra">Kopiera</button></div>`,
    )
    .join('');
  return `<section class="style-labels style-filltypes">
    <h3>Fyllningstyper</h3>
    <p class="note">Ett mönster av en eller flera linjefamiljer, som i AutoCADs och ArchiCADs .pat-filer. Typerna väljs bland fyllningarna för 2D-former, rum och snittytor, och de egna följer med stilboken.</p>
    ${GUIDE}
    <div class="filltype-builtins">${builtIn}</div>
    ${own}
    <div class="row">
      <button class="btn" data-action="filltype-add">Ny fyllningstyp</button>
      <button class="btn" data-action="filltype-import">Läs in .pat…</button>
      ${style.fillTypes?.length ? '<button class="btn" data-action="filltype-export">Spara som .pat…</button>' : ''}
    </div>
  </section>`;
}

/** Tjocklekarna att välja för en typs linjer (0.8.37); tomt = fyllningens förval. */
const WEIGHTS = [0.05, 0.09, 0.13, 0.18, 0.25, 0.35, 0.5];

function weightOptions(current: number | undefined): string {
  const list = current && !WEIGHTS.includes(current) ? [...WEIGHTS, current].sort((a, b) => a - b) : WEIGHTS;
  return `<option value=""${current ? '' : ' selected'}>Förval</option>${list.map((w) => `<option value="${w}"${w === current ? ' selected' : ''}>${String(w).replace('.', ',')} mm</option>`).join('')}`;
}

/**
 * Snabbguiden (0.8.37): vad fälten gör, med tre exempel att skriva in.
 */
const GUIDE = `<details class="filltype-guide"><summary>Så gör du en egen fyllning</summary>
  <p>Ett mönster byggs av <b>linjefamiljer</b>: parallella linjer som upprepas över ytan. Varje familj har</p>
  <ul>
    <li><b>Vinkel</b>: linjernas riktning, 0° vågrätt och 90° lodrätt.</li>
    <li><b>Avstånd</b>: mellan två linjer, mätt vinkelrätt mot dem.</li>
    <li><b>Förskjutning</b>: hur långt streckningen flyttas längs linjen från en linje till nästa. Den gör förband av tegel och plattor.</li>
    <li><b>X och Y</b>: baspunkten, där första linjen och dess första streck börjar.</li>
    <li><b>Streckning</b>: streck och mellanrum omväxlande, som linjetyperna (t.ex. <i>75 75</i>). Tomt är heldragen, och ett streck under 0,5 mm blir en punkt.</li>
  </ul>
  <p><b>Måtten</b> är i mm på papper (mönstret är lika tätt i alla skalor) eller i verkligheten (mönstret följer ritningens skala, som riktigt tegel). <b>Linjer</b> är tjockleken på papperet.</p>
  <p><b>Exempel</b> (Ny fyllningstyp, sedan Ny linjefamilj för den andra raden):</p>
  <ul>
    <li><b>Rutor 2 mm</b>, på papper: 0° avstånd 2, och 90° avstånd 2.</li>
    <li><b>Tegel</b>, i verkligheten: 0° avstånd 75 (skiften), och 90° avstånd 131, förskjutning 75, streckning <i>75 75</i> (stötfogarna, förskjutna varannat skift).</li>
    <li><b>Streckad skraffering</b>, på papper: 45° avstånd 1,5, förskjutning 1, streckning <i>2 1</i>.</li>
  </ul>
  <p>Enklast är ofta att kopiera en inbyggd typ och ändra den, eller att läsa in en .pat-fil. Att rita ett mönster och göra det till en fyllningstyp kommer i 0.11.1.</p>
</details>`;

/** Ändra en fyllningstyp i `style` (en kopia) efter fältet; null om fältet inte hör hit, '' om värdet inte gick att läsa. */
export function applyFillTypeField(style: StyleResources, input: HTMLInputElement | HTMLSelectElement): string | null {
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
    if (field === 'weight') {
      const w = Number(input.value);
      if (w > 0) t.weight = w;
      else delete t.weight;
      return 'Ändra fyllningstypens linjer';
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
export function addFillType(style: StyleResources, from?: FillTypeDef): CustomFillType {
  const t: CustomFillType = from
    ? { ...structuredClone(from), id: newFillTypeId(style) }
    : { id: newFillTypeId(style), name: `Egen fyllning ${(style.fillTypes?.length ?? 0) + 1}`, families: [{ angle: 45, x: 0, y: 0, spacing: 2, shift: 0, dash: [] }] };
  (style.fillTypes ??= []).push(t);
  return t;
}

/** Ta bort en fyllningstyp; snittfyllningar som hade den ritas som skraffering. False om den inte fanns. */
export function removeFillType(style: StyleResources, id: string): boolean {
  const i = style.fillTypes?.findIndex((t) => t.id === id) ?? -1;
  if (i < 0) return false;
  style.fillTypes!.splice(i, 1);
  if (!style.fillTypes!.length) delete style.fillTypes;
  return true;
}

/** En ny linjefamilj i typen, vinkelrät mot den sista. */
export function addFamily(style: StyleResources, id: string): boolean {
  const t = style.fillTypes?.find((x) => x.id === id);
  if (!t) return false;
  const last = t.families[t.families.length - 1];
  t.families.push({ angle: ((last?.angle ?? 45) + 90) % 360, x: 0, y: 0, spacing: last?.spacing ?? 2, shift: 0, dash: [] });
  return true;
}

export function removeFamily(style: StyleResources, id: string, index: number): boolean {
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
export function importPat(style: StyleResources, text: string): { added: number; replaced: number } {
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
