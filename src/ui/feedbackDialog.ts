import { ENGINE } from '../core/engine';
import { escapeHtml } from './labels';

/**
 * Synpunkter (0.7.1). Formuläret skickas till `feedback.php` i samma mapp
 * som appen, som mejlar det vidare. Inga personuppgifter krävs; e-post fylls
 * i bara om man vill ha svar. Ett dolt fält och en tidsspärr håller robotar
 * borta. Går det inte att nå skriptet (förhandsvisningen, eller om det inte
 * är uppsatt) öppnas ett mejl med texten ifylld i stället.
 */
export class FeedbackDialog {
  readonly el: HTMLElement;
  private openedAt = 0;
  private fallbackMail: string;
  private product: string;

  constructor(product: string, fallbackMail: string) {
    this.product = product;
    this.fallbackMail = fallbackMail;
    this.el = document.createElement('div');
    this.el.className = 'dialog-backdrop';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('[data-action="cancel-feedback"]')) this.close();
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      e.stopPropagation();
    });
    this.el.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send(e.target as HTMLFormElement);
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(): void {
    this.openedAt = Date.now();
    this.el.innerHTML = `<form class="dialog feedback" role="dialog" aria-modal="true" aria-labelledby="fb-title">
      <header><h2 id="fb-title">Skicka synpunkter</h2><button type="button" class="icon-btn" data-action="cancel-feedback" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        <p class="note">${escapeHtml(this.product)} är en betaversion. Berätta vad som fungerar, vad som saknas och vad som blir fel. Allt läses.</p>
        <label class="field" for="fb-text"><span>Synpunkt</span><textarea id="fb-text" name="message" rows="7" required maxlength="5000" placeholder="T.ex. vad du försökte göra och vad som hände"></textarea></label>
        <label class="field" for="fb-mail"><span>E-post <small>(om du vill ha svar)</small></span><input id="fb-mail" name="email" type="email" autocomplete="email" placeholder="namn@exempel.se"></label>
        <label class="fb-trap" aria-hidden="true">Lämna tomt<input name="website" tabindex="-1" autocomplete="off"></label>
        <p class="note">Med skickas versionen (${ENGINE.name} ${ENGINE.version}) och skärmens storlek, inget annat. E-post sparas bara för att kunna svara.</p>
        <p class="fb-status" role="status"></p>
      </div>
      <footer><div class="spacer"></div><button type="button" class="btn" data-action="cancel-feedback">Avbryt</button><button type="submit" class="btn btn-primary">Skicka</button></footer>
    </form>`;
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.querySelector<HTMLTextAreaElement>('textarea')?.focus());
  }

  close(): void {
    this.el.hidden = true;
    this.el.innerHTML = '';
  }

  private async send(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const message = String(data.get('message') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const status = form.querySelector<HTMLElement>('.fb-status')!;
    const button = form.querySelector<HTMLButtonElement>('[type=submit]')!;
    if (!message) return;
    button.disabled = true;
    status.textContent = 'Skickar…';
    const body = {
      message,
      email,
      website: String(data.get('website') ?? ''),
      elapsed: Date.now() - this.openedAt,
      version: `${ENGINE.name} ${ENGINE.version}`,
      screen: `${window.innerWidth}×${window.innerHeight}`,
    };
    try {
      const res = await fetch('./feedback.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const answer = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && answer?.ok) {
        status.textContent = 'Tack! Synpunkten är skickad.';
        setTimeout(() => this.close(), 1600);
        return;
      }
      if (res.status === 429 || res.status === 400) {
        status.textContent = answer?.error ?? 'Det gick inte att skicka just nu. Försök igen om en stund.';
        button.disabled = false;
        return;
      }
      throw new Error('saknas');
    } catch {
      // Inget skript att skicka till: öppna ett mejl med texten i stället.
      const subject = encodeURIComponent(`Synpunkt på ${this.product} (${body.version})`);
      const text = encodeURIComponent(`${message}\n\n— ${body.version}, skärm ${body.screen}`);
      window.location.href = `mailto:${this.fallbackMail}?subject=${subject}&body=${text}`;
      status.textContent = 'Formuläret kunde inte skickas härifrån, så ett mejl med texten öppnas i stället.';
      button.disabled = false;
    }
  }
}
