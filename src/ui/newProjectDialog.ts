import { emptyProject, type ProjectDoc, type ProjectKind } from '../core/model';
import { escapeHtml } from './labels';

const KINDS: { id: ProjectKind; name: string; text: string }[] = [
  { id: 'nybyggnad', name: 'Nybyggnad', text: 'Inget befintligt. Allt ritas som nytt.' },
  { id: 'tillbyggnad', name: 'Tillbyggnad', text: 'Befintligt hus som byggs till. Befintligt och nytt visas olika.' },
  { id: 'ombyggnad', name: 'Ombyggnad', text: 'Befintligt hus som ändras invändigt. Rivning och nytt markeras.' },
];

/**
 * Formuläret för nytt projekt. Bara det som behövs för att börja rätt:
 * namn och projekttyp. Adress och beställare fyller ritningshuvudet senare.
 */
export class NewProjectDialog {
  readonly el: HTMLElement;
  private onCreate: (doc: ProjectDoc) => void;

  constructor(onCreate: (doc: ProjectDoc) => void) {
    this.onCreate = onCreate;
    this.el = document.createElement('div');
    this.el.className = 'dialog-backdrop';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('[data-action="cancel-new"]')) this.close();
    });
    this.el.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const name = String(data.get('name') ?? '').trim() || 'Nytt projekt';
      const kind = (data.get('kind') as ProjectKind) ?? 'nybyggnad';
      const fields: Record<string, string> = {};
      for (const k of ['adress', 'bestallare']) {
        const v = String(data.get(k) ?? '').trim();
        if (v) fields[k] = v;
      }
      this.close();
      this.onCreate(emptyProject(name, kind, fields));
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      e.stopPropagation();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(): void {
    this.el.innerHTML = `<form class="dialog new-project" role="dialog" aria-modal="true" aria-labelledby="np-title">
      <header><h2 id="np-title">Nytt projekt</h2><button type="button" class="icon-btn" data-action="cancel-new" aria-label="Stäng">×</button></header>
      <div class="dialog-body">
        <label class="field" for="np-name"><span>Projektnamn</span><input id="np-name" name="name" required placeholder="T.ex. Villa Lindgren" autocomplete="off"></label>
        <fieldset class="kind-pick">
          <legend>Projekttyp</legend>
          ${KINDS.map(
            (k, i) => `<label class="kind-card"><input type="radio" name="kind" value="${k.id}"${i === 0 ? ' checked' : ''}><span><b>${k.name}</b><small>${escapeHtml(k.text)}</small></span></label>`,
          ).join('')}
        </fieldset>
        <div class="fields">
          <label class="field" for="np-adress"><span>Adress (valfritt)</span><input id="np-adress" name="adress" autocomplete="off"></label>
          <label class="field" for="np-bestallare"><span>Beställare (valfritt)</span><input id="np-bestallare" name="bestallare" autocomplete="off"></label>
        </div>
        <p class="note">Det öppna projektet ersätts. Spara det som fil först om du vill ha kvar det.</p>
      </div>
      <footer>
        <button type="button" class="btn" data-action="cancel-new">Avbryt</button>
        <button type="submit" class="btn btn-primary">Skapa projekt</button>
      </footer>
    </form>`;
    this.el.hidden = false;
    (this.el.querySelector('#np-name') as HTMLInputElement).focus();
  }

  close(): void {
    this.el.hidden = true;
  }
}
