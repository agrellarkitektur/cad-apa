// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { ENGINE } from '../../core/engine';
import type { Brand } from '../../brand';
import { escapeHtml } from '../labels';
import { SOURCE_REPO, sourceFileUrl, sourceUrl } from './sourceLink';
import { supportSectionHtml } from './supportSection';

/**
 * Om-rutan (0.8.18): versionen, länken till projektets GitHub och vad
 * appen är byggd med, med osifont krediterat. Sedan 0.12.5.4 licensen
 * (AGPL-3.0), länken till källkoden för just den här versionen och
 * *Stöd utvecklingen* (visas när texten finns, se supportSection.ts).
 */
export function installAboutDialog(root: HTMLElement, brand: Brand) {
  const el = document.createElement('div');
  el.className = 'dialog-backdrop';
  el.hidden = true;
  const close = () => {
    el.hidden = true;
    el.innerHTML = '';
  };
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === el || t.closest('[data-action="close-about"]')) close();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    e.stopPropagation();
  });
  root.appendChild(el);

  const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
  function open(): void {
    el.innerHTML = `<div class="dialog about" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <header><h2 id="about-title">Om ${escapeHtml(brand.name)}</h2><button type="button" class="icon-btn" data-action="close-about" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        <p><b>${escapeHtml(brand.name)}</b> · ${ENGINE.name} ${ENGINE.version}</p>
        <p class="note">${escapeHtml(brand.description)}</p>
        <p>Fri programvara under ${link(sourceFileUrl('LICENSE'), 'GNU AGPL 3.0')} eller senare. Du får använda, ändra och dela programmet, också i betalda uppdrag.</p>
        <p>${link(sourceUrl(), 'Källkoden till den här versionen')} finns på GitHub, liksom ${link(SOURCE_REPO, 'vad som är nytt')} i varje version och ${link(sourceFileUrl('THIRD-PARTY.md'), 'det som kommer från andra')}.</p>
        <h3>Typsnitt</h3>
        <p>Ritningens text: ${link('https://github.com/hikikomori82/osifont', 'osifont')}, ett fritt tekniskt typsnitt efter ISO 3098 (GPL 3 med typsnittsundantag). Tack till hikikomori82 och de som bidragit.</p>
        <p class="note">Gränssnittet: Archivo och IBM Plex Mono (SIL Open Font License).</p>
        ${supportSectionHtml()}
      </div>
      <footer><div class="spacer"></div><button type="button" class="btn btn-primary" data-action="close-about">Stäng</button></footer>
    </div>`;
    el.hidden = false;
    requestAnimationFrame(() => el.querySelector<HTMLButtonElement>('.btn-primary')?.focus());
  }
  return { open, close, get isOpen() { return !el.hidden; } };
}
