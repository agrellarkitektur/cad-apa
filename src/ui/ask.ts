import { escapeHtml } from './labels';

/**
 * Små frågor i appen, i stället för webbläsarens prompt() och confirm(), som
 * inte visas i alla miljöer (till exempel i förhandsvisningen).
 */
function dialog(html: string, setup: (el: HTMLElement, done: (v: string | null) => void) => void): Promise<string | null> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'dialog-backdrop ask';
    back.innerHTML = `<form class="dialog ask-dialog" role="dialog" aria-modal="true">${html}</form>`;
    document.body.appendChild(back);
    const form = back.querySelector('form')!;
    let finished = false;
    const done = (v: string | null) => {
      if (finished) return;
      finished = true;
      back.remove();
      resolve(v);
    };
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back) done(null);
    });
    form.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') done(null);
    });
    form.querySelector('[data-cancel]')?.addEventListener('click', () => done(null));
    setup(form, done);
  });
}

/** Fråga efter en text. Svarar null om man avbryter eller lämnar fältet tomt. */
export function askText(title: string, value = '', ok = 'Spara'): Promise<string | null> {
  return dialog(
    `<header><h2>${escapeHtml(title)}</h2></header>
     <div class="dialog-body"><input class="ask-input" value="${escapeHtml(value)}" aria-label="${escapeHtml(title)}" autocomplete="off"></div>
     <footer><div class="spacer"></div><button type="button" class="btn" data-cancel>Avbryt</button><button type="submit" class="btn btn-primary">${escapeHtml(ok)}</button></footer>`,
    (form, done) => {
      const input = form.querySelector<HTMLInputElement>('input')!;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        done(input.value.trim() || null);
      });
      requestAnimationFrame(() => {
        input.focus();
        input.select();
      });
    },
  );
}

/** Fråga ja eller nej. */
export async function askConfirm(title: string, text: string, ok = 'Ta bort'): Promise<boolean> {
  const r = await dialog(
    `<header><h2>${escapeHtml(title)}</h2></header>
     <div class="dialog-body"><p>${escapeHtml(text)}</p></div>
     <footer><div class="spacer"></div><button type="button" class="btn" data-cancel>Avbryt</button><button type="submit" class="btn btn-primary">${escapeHtml(ok)}</button></footer>`,
    (form, done) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        done('yes');
      });
      requestAnimationFrame(() => form.querySelector<HTMLButtonElement>('[type=submit]')?.focus());
    },
  );
  return r === 'yes';
}
