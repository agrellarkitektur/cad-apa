import type { StyleResources } from '../../core/graphics';
import type { LeaderKind } from '../../core/graphics';
import { LEADER_ATTACH, LEADER_ENDS, type LeaderAttach, type LeaderEnd } from '../../elements/leader';
import { escapeHtml } from '../labels';

const LEADER_NAMES: Record<LeaderKind, string> = { Wall: 'Väggar', Door: 'Dörrar', Window: 'Fönster', Space: 'Rum', Ground: 'Stödmurar', Label: 'Generell littera' };

/** Stilbokens texter och littera: justering, texthöjder och mallarna. */
export function labelSection(style: StyleResources): string {
  const l = style.labels;
  const h = (k: keyof StyleResources['labels']['heights'], label: string) =>
    `<label><span>${label}</span><span class="input-unit"><input type="text" data-expr data-step="0.05" inputmode="decimal" autocomplete="off" data-lab="h:${k}" value="${Number(l.heights[k]).toFixed(2)}"><i>mm</i></span></label>`;
  const names: Record<string, string> = { Wall: 'Väggar', Door: 'Dörrar', Window: 'Fönster' };
  const tpl = (Object.keys(l.templates) as (keyof StyleResources['labels']['templates'])[])
    .map(
      (k) => `<div class="tpl-row"><b>${names[k]}</b>
          <label><span>Normal</span><textarea rows="2" data-lab="t:${k}:normal">${escapeHtml(l.templates[k].normal)}</textarea></label>
          <label><span>Detalj</span><textarea rows="3" data-lab="t:${k}:detail">${escapeHtml(l.templates[k].detail)}</textarea></label></div>`,
    )
    .join('');
  return `<section class="style-labels">
      <h3>Texter och littera</h3>
      <div class="style-row labels-row">
        <label><span>Justering</span><select data-lab="align"><option value="left"${l.align === 'left' ? ' selected' : ''}>Vänster</option><option value="center"${l.align === 'center' ? ' selected' : ''}>Centrerat</option></select></label>
        ${h('roomName', 'Rumsnamn')}${h('roomInfo', 'Rumsnr, area')}${h('littera', 'Littera')}${h('dimension', 'Mått')}
      </div>
      <p class="note">Litteramallar: en rad per textrad. Fält: <code>{typ}</code> (D1), <code>{storlek}</code> (D10×21), <code>{nummer}</code> (D1203), <code>{hål}</code> (1010×2110), <code>{karm}</code> (990×2090) och egna egenskaper med sitt namn, t.ex. <code>{brandklass}</code>. Tomma rader hoppas över. I Skiss visas ingen littera.</p>
      ${tpl}
      <div class="tpl-row wide"><b>Rum</b>
        <label><span>Rumsstämpel</span><textarea rows="4" data-lab="room">${escapeHtml(l.room)}</textarea></label></div>
      <p class="note">Rumsstämpeln: en rad per textrad, i den ordning de ska stå. Fält: <code>{namn}</code>, <code>{nummer}</code>, <code>{area}</code>, <code>{takhöjd}</code> och rummets egna egenskaper. Raden med namnet blir större och fet.</p>
      <h4>Ledarna</h4>
      ${(Object.keys(l.leaders) as LeaderKind[])
        .map(
          (k) => `<div class="style-row labels-row"><b>${LEADER_NAMES[k]}</b>
          <label><span>Ände</span><select data-lab="le:${k}">${LEADER_ENDS.map(([v, n]) => `<option value="${v}"${l.leaders[k].end === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <label><span>Stammens längd</span><span class="input-unit"><input type="text" data-expr data-step="0.5" inputmode="decimal" autocomplete="off" data-lab="ls:${k}" value="${l.leaders[k].stub}"><i>mm</i></span></label>
          <label><span>Mot texten</span><select data-lab="la:${k}">${LEADER_ATTACH.map(([v, n]) => `<option value="${v}"${l.leaders[k].attach === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>${
            k === 'Label'
              ? `<label title="Det generella litterats vridning som förval: 0 vågrät, 90 lodrät. En littera med egen vridning behåller den."><span>Vridning</span><span class="input-unit"><input type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" data-lab="lr:${k}" value="${l.leaders[k].angle ?? 0}"><i>°</i></span></label>`
              : ''
          }</div>`,
        )
        .join('')}
      <p class="note">Ledaren går vinkelrätt ut från texten (stammen) och viker sedan av mot punkten. <i>Understruken</i>: ett streck under hela texten, och stammen fortsätter från dess ände. <i>Automatiskt</i> ger pil mot en kant och prick inne i en yta. Varje littera kan få egna värden under Littera i egenskaperna.</p>
    </section>`;
}

/** Ändra texterna i `style` (en kopia) efter fältet; null om fältet inte hör hit. */
export function applyLabelField(style: StyleResources, input: HTMLInputElement | HTMLSelectElement): string | null {
  if (!input.dataset.lab) return null;
  const [kind, a, b] = input.dataset.lab.split(':');
  if (kind === 'align') style.labels.align = input.value === 'center' ? 'center' : 'left';
  if (kind === 'h' && Number(input.value) > 0) style.labels.heights[a as keyof StyleResources['labels']['heights']] = Number(input.value);
  if (kind === 't') style.labels.templates[a as keyof StyleResources['labels']['templates']][b as 'normal' | 'detail'] = input.value;
  if (kind === 'room') style.labels.room = input.value;
  if (kind === 'le' && LEADER_ENDS.some(([v]) => v === input.value)) style.labels.leaders[a as LeaderKind].end = input.value as LeaderEnd;
  if (kind === 'ls' && Number(input.value.replace(',', '.')) >= 0) style.labels.leaders[a as LeaderKind].stub = Math.round(Number(input.value.replace(',', '.')) * 2) / 2;
  if (kind === 'lr' && Number.isFinite(Number(input.value.replace(',', '.').replace('°', '')))) {
    const v = ((Math.round(Number(input.value.replace(',', '.').replace('°', '')) * 10) / 10) % 360 + 360) % 360;
    style.labels.leaders[a as LeaderKind].angle = v || undefined;
  }
  if (kind === 'la' && LEADER_ATTACH.some(([v]) => v === input.value)) style.labels.leaders[a as LeaderKind].attach = input.value as LeaderAttach;
  return 'Ändra texter';
}
