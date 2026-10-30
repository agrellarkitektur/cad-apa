import { emptyProject, type ProjectDoc, type ProjectKind } from '../core/model';
import { DocStore } from '../core/store';
import { applyTemplate, readBookFile, type ReadBook } from '../core/styleBookFile';
import { loadTemplate, type TemplateRecord } from '../storage/localStore';
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
  /** Mallen i webbläsaren (0.10.40), läst när formuläret öppnas. */
  private template: TemplateRecord | null = null;

  constructor(onCreate: (doc: ProjectDoc) => void) {
    this.onCreate = onCreate;
    this.el = document.createElement('div');
    this.el.className = 'dialog-backdrop';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.el || t.closest('[data-action="cancel-new"]')) this.close();
    });
    this.el.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = new FormData(form);
      const name = String(data.get('name') ?? '').trim() || 'Nytt projekt';
      const kind = (data.get('kind') as ProjectKind) ?? 'nybyggnad';
      const fields: Record<string, string> = {};
      for (const k of ['adress', 'beställare']) {
        const v = String(data.get(k) ?? '').trim();
        if (v) fields[k] = v;
      }
      // Stilboken (0.10.40): Svensk standard, mallen i webbläsaren eller en stilboksfil.
      let read: ReadBook | null = null;
      try {
        const book = data.get('book');
        if (book === 'template' && this.template) read = readBookFile(JSON.parse(this.template.text));
        if (book === 'file') {
          const file = (form.querySelector('#np-bookfile') as HTMLInputElement).files?.[0];
          if (!file) return this.note('Välj en stilboksfil, eller Svensk standard.');
          read = readBookFile(JSON.parse(await file.text()));
        }
      } catch (err) {
        return this.note(err instanceof SyntaxError ? 'Filen gick inte att läsa som stilbok.' : (err as Error).message);
      }
      this.close();
      const store = new DocStore(emptyProject(name, kind, fields));
      if (read) applyTemplate(store, read);
      this.onCreate(store.doc);
    });
    this.el.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id === 'np-bookfile' && t.files?.length) (this.el.querySelector('input[name="book"][value="file"]') as HTMLInputElement).checked = true;
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      e.stopPropagation();
    });
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  private note(text: string): void {
    const p = this.el.querySelector<HTMLElement>('.np-book-note');
    if (p) {
      p.textContent = text;
      p.hidden = false;
    }
  }

  async open(): Promise<void> {
    this.template = await loadTemplate();
    const t = this.template;
    const books = [
      ...(t ? [{ id: 'template', name: `Mallen: ${t.name}`, text: 'Stilboken som är sparad som mall för nya projekt i den här webbläsaren, med mallbladen och stämplarna.' }] : []),
      { id: 'standard', name: 'Svensk standard', text: 'Programmets förval.' },
    ];
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
        <fieldset class="kind-pick book-pick">
          <legend>Stilbok</legend>
          ${books.map((b, i) => `<label class="kind-card"><input type="radio" name="book" value="${b.id}"${i === 0 ? ' checked' : ''}><span><b>${escapeHtml(b.name)}</b><small>${escapeHtml(b.text)}</small></span></label>`).join('')}
          <label class="kind-card"><input type="radio" name="book" value="file"><span><b>Från fil</b><small>En exporterad stilbok.</small><input id="np-bookfile" type="file" accept=".json,application/json" aria-label="Stilboksfil"></span></label>
          <p class="note np-book-note" hidden></p>
        </fieldset>
        <div class="fields">
          <label class="field" for="np-adress"><span>Adress (valfritt)</span><input id="np-adress" name="adress" autocomplete="off"></label>
          <label class="field" for="np-bestallare"><span>Beställare (valfritt)</span><input id="np-bestallare" name="beställare" autocomplete="off"></label>
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
