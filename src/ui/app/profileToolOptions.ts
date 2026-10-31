import { defaultProfileDef, profileTypesFor } from '../../core/profiles';
import { defaultProfileTypes, profileModel } from '../../core/profileTypes';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';

/**
 * Verktygsraden för Profil (0.11.6): banan (Linje, Lodrät, Längs kant),
 * typen, ankaret, höjden (referenslinjens, eller pelarens fot och höjd),
 * vridningen, Spegla, Båge och Klar.
 */
export function profileOptionsMarkup(app: AppContext): string {
  const t = app.profileTool;
  const o = t.options;
  const doc = app.store.doc;
  const mode = (v: string, label: string, title: string) => `<button data-profile-mode="${v}" aria-pressed="${o.mode === v}" title="${title}">${label}</button>`;
  // Utan profiltyper i projektet visas de förvalda; de läggs in med den första profilen.
  const own = profileTypesFor(doc);
  const defs = own.length ? own : defaultProfileTypes();
  const cur = own.length ? defaultProfileDef(doc, o.def) : (o.def ?? 't-pr01');
  const typeSel = `<label class="opt"><span>Typ</span><select id="profile-def">${defs.map((d) => `<option value="${d.id}"${d.id === cur ? ' selected' : ''}>${escapeHtml(d.name)}${d.description ? ` – ${escapeHtml(d.description)}` : ''}</option>`).join('')}</select></label>`;
  const m = profileModel(defs.find((d) => d.id === cur));
  const anchors = m?.anchors ?? [];
  const anchorSel = anchors.length > 1 ? `<label class="opt"><span>Ankare</span><select id="profile-anchor">${anchors.map((a) => `<option value="${a.no}"${a.no === (o.anchor ?? m!.anchor) ? ' selected' : ''}>${a.no} ${escapeHtml(a.name)}</option>`).join('')}</select></label>` : '';
  const num = (id: string, label: string, v: number | undefined, unit: string, aria: string, ph = '') => `<label class="opt"><span>${label}</span><span class="input-unit"><input type="text" id="${id}" inputmode="decimal" value="${v ?? ''}" placeholder="${ph}" aria-label="${aria}" style="width:64px"><i>${unit}</i></span></label>`;
  const heights = o.mode === 'plumb' ? `${num('profile-level', 'Fot', o.level, 'mm', 'Pelarens fot över golvet')}${num('profile-height', 'Höjd', o.height, 'mm', 'Pelarens höjd', 'till våningen ovan')}` : num('profile-z', 'Höjd', o.z, 'mm', 'Referenslinjens höjd över golvet');
  return `
    <div class="opt"><span>Bana</span><div class="segmented" role="group" aria-label="Bana">${mode('line', 'Linje', 'Punkt för punkt, med bågar (N)')}${mode('plumb', 'Lodrät', 'En pelare: ett klick (L)')}${mode('edge', 'Längs kant', 'Längs en vägg, ett bjälklag eller en linje (K)')}</div></div>
    ${typeSel}${anchorSel}${heights}
    ${num('profile-rotate', 'Vridning', o.rotate, '°', 'Vridning kring ankaret')}
    <button class="btn" data-action="profile-mirror" aria-pressed="${o.mirror}" title="Tvärsnittet på andra sidan om banan (Tab)">Spegla</button>
    ${o.mode === 'line' ? `<button class="btn" data-action="profile-arc" aria-pressed="${t.arc}" title="Nästa kant blir en båge (G)">Båge</button>${t.chain.count >= 2 ? '<button class="btn btn-primary" data-action="profile-done">Klar</button>' : ''}` : ''}
    <span class="opt-hint">${t.hintText()}</span>`;
}

/** Ett ändrat fält i verktygsraden; svarar true om det var profilens. */
export function profileOptionChange(app: AppContext, el: HTMLInputElement | HTMLSelectElement): boolean {
  const o = app.profileTool.options;
  const v = Number(el.value.replace(',', '.'));
  const ok = el.value.trim() !== '' && Number.isFinite(v);
  switch (el.id) {
    case 'profile-def':
      o.def = el.value;
      o.anchor = undefined;
      break;
    case 'profile-anchor':
      o.anchor = ok ? v : undefined;
      break;
    case 'profile-z':
      o.z = ok ? Math.round(v) : 0;
      break;
    case 'profile-level':
      o.level = ok ? Math.round(v) : 0;
      break;
    case 'profile-height':
      o.height = ok && v > 0 ? Math.round(v) : undefined;
      break;
    case 'profile-rotate':
      o.rotate = ok ? ((v % 360) + 360) % 360 : 0;
      break;
    default:
      return false;
  }
  app.toolOpts.renderToolOptions();
  app.view.requestRender();
  return true;
}

/** En knapp i verktygsraden; svarar true om det var profilens. */
export function profileOptionClick(app: AppContext, b: HTMLElement): boolean {
  const t = app.profileTool;
  if (b.dataset.profileMode) t.setMode(b.dataset.profileMode as 'line' | 'plumb' | 'edge');
  else if (b.dataset.action === 'profile-mirror') t.flip();
  else if (b.dataset.action === 'profile-arc') t.setArc(!t.arc);
  else if (b.dataset.action === 'profile-done') t.finish();
  else return false;
  app.toolOpts.renderToolOptions();
  return true;
}
