/**
 * Temaväljaren, i samma stil som på höjdkurvor.se: en cell i menyraden med
 * rubriken TEMA och det aktuella temat, som fäller ut de tre temana.
 * Valet sparas i webbläsaren. Utan valt tema följer appen systemets läge.
 */
export type ThemeId = 'blueprint' | 'light' | 'dark';

export const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'blueprint', name: 'Blueprint' },
  { id: 'light', name: 'Ljust' },
  { id: 'dark', name: 'Mörkt' },
];

const KEY = 'bacchus-theme';
const listeners = new Set<() => void>();

export function savedTheme(): ThemeId | null {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.some((t) => t.id === v) ? (v as ThemeId) : null;
  } catch {
    return null;
  }
}

/** Temat som syns just nu, även när systemet bestämmer. */
export function currentTheme(): ThemeId {
  return savedTheme() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme(id: ThemeId | null): void {
  if (id) document.documentElement.setAttribute('data-ui-theme', id);
  else document.documentElement.removeAttribute('data-ui-theme');
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* Valet gäller bara den här gången om lagringen är avstängd. */
  }
  listeners.forEach((fn) => fn());
}

/** Anropas när temat byts, t.ex. så att 3D-vyn kan byta bakgrund. */
export function onThemeChange(fn: () => void): void {
  listeners.add(fn);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
}

export function themeName(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.name ?? id;
}

/** Cellen i menyraden. */
export function createThemeSwitcher(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'theme-wrap';
  const render = () => {
    const cur = currentTheme();
    wrap.innerHTML = `
      <button type="button" class="theme-btn" aria-haspopup="menu" aria-expanded="${wrap.classList.contains('open')}">
        <span class="lbl">TEMA</span><span class="name">${themeName(cur).toUpperCase()}</span>
      </button>
      <div class="theme-menu" role="menu" aria-label="Tema">
        ${THEMES.map((t) => `<button type="button" role="menuitemradio" data-theme-id="${t.id}" aria-checked="${t.id === cur}">${t.name.toUpperCase()}</button>`).join('')}
      </div>`;
  };
  render();
  wrap.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const pick = target.closest<HTMLElement>('[data-theme-id]');
    if (pick) {
      applyTheme(pick.dataset.themeId as ThemeId);
      wrap.classList.remove('open');
    } else if (target.closest('.theme-btn')) {
      wrap.classList.toggle('open');
    }
    render();
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target as Node) && wrap.classList.contains('open')) {
      wrap.classList.remove('open');
      render();
    }
  });
  onThemeChange(render);
  return wrap;
}

// Sätt sparat tema direkt när modulen laddas, innan appen ritas.
const initial = savedTheme();
if (initial) document.documentElement.setAttribute('data-ui-theme', initial);
