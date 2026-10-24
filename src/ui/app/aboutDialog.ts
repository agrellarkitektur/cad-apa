import { ENGINE } from '../../core/engine';
import type { Brand } from '../../brand';
import { escapeHtml } from '../labels';

const GITHUB = 'https://github.com/agrellarkitektur/cad-apa';

/**
 * Om-rutan (0.8.18): versionen, länken till projektets GitHub och vad
 * appen är byggd med, med osifont krediterat.
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
        <p>Öppen källkod (GPL 3 eller senare). Koden, och vad som är nytt i varje version, finns på ${link(GITHUB, 'GitHub')}.</p>
        <h3>Typsnitt</h3>
        <p>Ritningens text: ${link('https://github.com/hikikomori82/osifont', 'osifont')}, ett fritt tekniskt typsnitt efter ISO 3098 (GPL 3 med typsnittsundantag). Tack till hikikomori82 och de som bidragit.</p>
        <p class="note">Gränssnittet: Archivo och IBM Plex Mono (SIL Open Font License).</p>
      </div>
      <footer><div class="spacer"></div><button type="button" class="btn btn-primary" data-action="close-about">Stäng</button></footer>
    </div>`;
    el.hidden = false;
    requestAnimationFrame(() => el.querySelector<HTMLButtonElement>('.btn-primary')?.focus());
  }
  return { open, close, get isOpen() { return !el.hidden; } };
}
