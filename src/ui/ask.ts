import { escapeHtml } from './labels';

/**
 * Små frågor i appen, i stället för webbläsarens prompt() och confirm(), som
 * inte visas i alla miljöer (till exempel i förhandsvisningen).
 */
export function dialog(html: string, setup: (el: HTMLElement, done: (v: string | null) => void) => void): Promise<string | null> {
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

/**
 * Välj ett av flera svar (0.10.3). Svarar med det valdas värde, eller null om
 * man avbryter. Det första alternativet är förvalt.
 */
export function askChoice(title: string, text: string, choices: { value: string; label: string }[]): Promise<string | null> {
  return dialog(
    `<header><h2>${escapeHtml(title)}</h2></header>
     <div class="dialog-body"><p>${escapeHtml(text)}</p></div>
     <footer><div class="spacer"></div><button type="button" class="btn" data-cancel>Avbryt</button>${choices
       .map((c, i) => `<button type="${i === 0 ? 'submit' : 'button'}" class="btn${i === 0 ? ' btn-primary' : ''}" data-choice="${escapeHtml(c.value)}">${escapeHtml(c.label)}</button>`)
       .join('')}</footer>`,
    (form, done) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        done(choices[0].value);
      });
      form.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((b) => b.addEventListener('click', (e) => {
        e.preventDefault();
        done(b.dataset.choice!);
      }));
      requestAnimationFrame(() => form.querySelector<HTMLButtonElement>('[type=submit]')?.focus());
    },
  );
}

/** En kryssruta i `askChecks`. */
export interface CheckOption {
  key: string;
  label: string;
  checked?: boolean;
  disabled?: boolean;
}

/**
 * Kryssa i vad som ska med (0.10.40), t.ex. mallblad och stämplar till en
 * stilbok. Svarar med kryssen, eller null om man avbryter. `extra` är en
 * knapp till vänster (t.ex. *Ta bort mallen*), som svarar med `extra: true`.
 */
export function askChecks(title: string, text: string, checks: readonly CheckOption[], ok: string, extra?: string): Promise<Record<string, boolean> | null> {
  return dialog(
    `<header><h2>${escapeHtml(title)}</h2></header>
     <div class="dialog-body"><p>${escapeHtml(text)}</p>${checks
       .map((c) => `<label class="check"><input type="checkbox" name="${escapeHtml(c.key)}"${c.checked ? ' checked' : ''}${c.disabled ? ' disabled' : ''}> ${escapeHtml(c.label)}</label>`)
       .join('')}</div>
     <footer>${extra ? `<button type="button" class="btn btn-ghost" data-extra>${escapeHtml(extra)}</button>` : ''}<div class="spacer"></div><button type="button" class="btn" data-cancel>Avbryt</button><button type="submit" class="btn btn-primary">${escapeHtml(ok)}</button></footer>`,
    (form, done) => {
      const read = (more: Record<string, boolean> = {}) =>
        JSON.stringify({ ...Object.fromEntries(checks.map((c) => [c.key, !!form.querySelector<HTMLInputElement>(`input[name="${CSS.escape(c.key)}"]`)?.checked && !c.disabled])), ...more });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        done(read());
      });
      form.querySelector('[data-extra]')?.addEventListener('click', () => done(read({ extra: true })));
      requestAnimationFrame(() => form.querySelector<HTMLButtonElement>('[type=submit]')?.focus());
    },
  ).then((v) => (v ? (JSON.parse(v) as Record<string, boolean>) : null));
}
