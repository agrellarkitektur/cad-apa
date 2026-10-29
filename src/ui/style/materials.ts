import type { Material, StyleSheet } from '../../core/graphics';
import { escapeHtml } from '../labels';
import { MATERIAL_3D_COLOR, savedSwatch } from '../fillPanel';
import { BUILDING_KEYS, buildingChange, buildingFields } from '../materialBuilding';

/**
 * Materiallistan i stilmallen (0.10.28.1): ett material per rad med namnet,
 * kryssrutorna *Mark* och *Byggnad*, färgerna i planen, illustrationsplanen
 * och 3D, pilar för ordningen och Ta bort. Mönstret i planen ändras i
 * objektets panel (Material). `uses` är hur många objekt och slänter som
 * har varje material, så att det syns vad en borttagning påverkar.
 */
export function materialSection(style: StyleSheet, uses: ReadonlyMap<string, number>): string {
  const list = style.materials ?? [];
  const rows = list
    .map((m, i) => {
      const id = escapeHtml(m.id);
      const n = uses.get(m.id) ?? 0;
      const check = (k: 'ground' | 'building', label: string) => `<label class="material-check"><input type="checkbox" data-material="${id}:${k}"${m[k] ? ' checked' : ''}><span>${label}</span></label>`;
      const color = (k: string, label: string, v: string) => `<label class="material-color"><span>${label}</span><input type="color" data-material="${id}:${k}" value="${escapeHtml(v)}"></label>`;
      const planColor = typeof m.plan.fillColor === 'string' ? m.plan.fillColor : '#9aa0a6';
      return `<div class="material-row">
        <span class="material-swatch">${savedSwatch(m.plan, style)}</span>
        <input type="text" data-material="${id}:name" value="${escapeHtml(m.name)}" aria-label="Namn">
        <span class="material-order">
          <button class="btn" data-action="material-up" data-material-id="${id}"${i ? '' : ' disabled'} title="Flytta upp" aria-label="Flytta upp">↑</button>
          <button class="btn" data-action="material-down" data-material-id="${id}"${i < list.length - 1 ? '' : ' disabled'} title="Flytta ned" aria-label="Flytta ned">↓</button>
        </span>
        <button class="btn" data-action="material-remove" data-material-id="${id}" title="${n ? `Används av ${n}; de behåller hur de ser ut i planen och får egen fyllning` : 'Används inte'}">Ta bort</button>
        <div class="material-props">
          ${check('ground', 'Mark')}${check('building', 'Byggnad')}
          ${color('plan', 'Planen', planColor)}
          ${color('ill', 'Illustration', m.illustration?.color ?? planColor)}
          ${color('c3d', '3D', m.color3d ?? MATERIAL_3D_COLOR)}
          <span class="material-uses">${n ? `${n} objekt` : ''}</span>
        </div>
        ${m.building ? `<div class="material-building">${buildingFields(m, (k) => `data-material="${id}:${k}"`, style)}</div>` : ''}
      </div>`;
    })
    .join('');
  return `<section class="style-labels style-materials">
    <h3>Material</h3>
    <p class="note">Materialen väljs i objektens panel under <i>Material</i>. <b>Mark</b> och <b>Byggnad</b> styr var de finns att välja (2D-former och rum ser alla). Ändras ett material här ändras alla objekt med det. Mönstret i planen ändras i panelen för ett objekt med materialet. Byggnadens material har också snittet i sektion, ytan i fasad och konturens penna i planen.</p>
    ${rows || '<p class="note">Inga material.</p>'}
    <button class="btn" data-action="material-add">Nytt material</button>
  </section>`;
}

/**
 * Fältets ändring av materialet `m` (en kopia), eller null om fältet inte
 * hör hit. Svarar med materialets nyckel, ångra-texten och det nya.
 */
export function materialFieldChange(style: StyleSheet, input: HTMLInputElement | HTMLSelectElement): { id: string; label: string; fn: (m: Material) => Material } | null {
  const key = input.dataset.material;
  if (!key) return null;
  const i = key.lastIndexOf(':');
  const id = key.slice(0, i);
  const field = key.slice(i + 1);
  const m = style.materials?.find((q) => q.id === id);
  if (!m) return null;
  if (field === 'name') {
    const name = input.value.trim();
    if (!name || name === m.name) return null;
    return { id, label: `Byt namn på material: ${name}`, fn: (q) => ({ ...q, name }) };
  }
  if (field === 'ground' || field === 'building') {
    const on = (input as HTMLInputElement).checked;
    return { id, label: `${m.name}: ${field === 'ground' ? 'Mark' : 'Byggnad'}`, fn: (q) => ({ ...q, [field]: on }) };
  }
  // Byggnadens snitt, yta och penna (0.10.28.2).
  if (BUILDING_KEYS.has(field)) {
    const change = buildingChange(m, field, input.value);
    return change ? { id, ...change } : null;
  }
  const c = input.value;
  if (!/^#[0-9a-f]{6}$/i.test(c)) return null;
  if (field === 'plan') return { id, label: `Ändra material: ${m.name}`, fn: (q) => ({ ...q, plan: { ...q.plan, fillColor: c } }) };
  if (field === 'ill') return { id, label: `Ändra material: ${m.name}`, fn: (q) => ({ ...q, illustration: { ...(q.illustration ?? {}), color: c } }) };
  if (field === 'c3d') return { id, label: `Ändra material: ${m.name}`, fn: (q) => ({ ...q, color3d: c }) };
  return null;
}
