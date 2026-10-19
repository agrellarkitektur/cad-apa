import { ENGINE } from '../core/engine';
import { escapeHtml } from './labels';

/**
 * Synpunkter (0.7.1). Formuläret skickas till `feedback.php` i samma mapp
 * som appen, som mejlar det vidare. Inga personuppgifter krävs; e-post fylls
 * i bara om man vill ha svar. Ett dolt fält och en tidsspärr håller robotar
 * borta. Går det inte att nå skriptet (förhandsvisningen, eller om det inte
 * är uppsatt) öppnas ett mejl med texten ifylld i stället. Svarar skriptet
 * med ett fel (0.8) visas felet, så att det går att rätta på servern.
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
    let res: Response | null = null;
    let answer: { ok?: boolean; error?: string } | null = null;
    try {
      res = await fetch('./feedback.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      answer = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    } catch {
      res = null;
    }
    if (res?.ok && answer?.ok) {
      status.textContent = 'Tack! Synpunkten är skickad.';
      setTimeout(() => this.close(), 1600);
      return;
    }
    const mailto = () => {
      const subject = encodeURIComponent(`Synpunkt på ${this.product} (${body.version})`);
      const text = encodeURIComponent(`${message}\n\n— ${body.version}, skärm ${body.screen}`);
      window.location.href = `mailto:${this.fallbackMail}?subject=${subject}&body=${text}`;
    };
    button.disabled = false;
    if (res && answer?.error) {
      // Skriptet svarade men kunde inte skicka: säg varför, så att det går att rätta på servern.
      status.innerHTML = `${escapeHtml(answer.error)} <small>(svar ${res.status})</small> <button type="button" class="btn btn-link" data-action="feedback-mail">Skicka med e-post i stället</button>`;
      status.querySelector('[data-action="feedback-mail"]')?.addEventListener('click', mailto);
      return;
    }
    if (res && res.status !== 404 && res.status !== 405) {
      // Något annat än ett saknat skript, t.ex. ett fel i PHP på servern.
      status.innerHTML = `Servern svarade med fel ${res.status} och kunde inte ta emot synpunkten. <button type="button" class="btn btn-link" data-action="feedback-mail">Skicka med e-post i stället</button>`;
      status.querySelector('[data-action="feedback-mail"]')?.addEventListener('click', mailto);
      return;
    }
    // Inget skript att skicka till (förhandsvisningen och demon): öppna ett mejl med texten.
    mailto();
    status.textContent = 'Formuläret kan inte skickas härifrån, så ett mejl med texten öppnas i stället.';
  }
}
