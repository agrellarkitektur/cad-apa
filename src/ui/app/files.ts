import type { Brand } from '../../brand';
import { sampleProject } from '../../sample/sampleProject';
import { startAutosave, type SaveStatus } from '../../storage/autosave';
import type { LocalRecord } from '../../storage/localStore';
import { autosaveProjectFile, forgetProjectFile, openProjectFile, projectFileName, saveProject, saveProjectFile } from '../../storage/projectFile';
import { NewProjectDialog } from '../newProjectDialog';
import type { AppContext } from './context';
import { defaultState, tf } from './helpers';

/**
 * Projektet som fil: autospar (i webbläsaren och, sedan 0.8.18, till filen)
 * med status i statusraden, Spara, Spara som,
 * Öppna, Nytt projekt och Börja om med exemplet.
 */
export function installFiles(app: AppContext, brand: Brand, start: { saved: LocalRecord | null; autosaveBlocked: boolean }) {
  let blockedHintShown = false;
  // Autospara till filen (0.8.18): projektet sparas i webbläsaren som förut,
  // och dessutom till filen som sparats eller öppnats här, när den finns.
  const toFile = () => app.uiSettings.autosaveFile && !!projectFileName();
  let fileFailedHintShown = false;
  let fileTimer = 0;
  const writeFile = async () => {
    fileTimer = 0;
    if (!toFile()) return;
    const name = projectFileName();
    const r = await autosaveProjectFile(app.store.doc);
    const el = app.out('save');
    if (r === 'saved' || r === 'unchanged') {
      el.dataset.kind = 'saved';
      el.textContent = `Sparat i filen ${tf.format(new Date())}`;
      el.title = `Autosparas till ${name}. Stäng av i Inställningar.`;
    } else if (r === 'failed') {
      el.dataset.kind = 'unavailable';
      el.textContent = 'Filen sparas inte';
      el.title = `${name} gick inte att skriva till. Spara med Ctrl+S.`;
      if (!fileFailedHintShown) {
        fileFailedHintShown = true;
        app.hint(`${name} gick inte att autospara till. Spara med Ctrl+S eller Spara som.`, 6000);
      }
    }
  };
  const scheduleFile = (delay = 2000) => {
    if (!toFile()) return;
    clearTimeout(fileTimer);
    fileTimer = window.setTimeout(() => void writeFile(), delay);
  };
  app.store.subscribe(() => scheduleFile());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && fileTimer) {
      clearTimeout(fileTimer);
      void writeFile();
    }
  });

  const showSaveStatus = (s: SaveStatus) => {
    // Med autospar till fil säger statusen när filen sparats, inte webbläsaren.
    if (toFile() && s.kind === 'saved') return;
    const el = app.out('save');
    el.dataset.kind = s.kind;
    el.textContent =
      s.kind === 'saved'
        ? `Sparat ${tf.format(s.at)}`
        : s.kind === 'pending'
          ? 'Sparar…'
          : s.kind === 'blocked'
            ? 'Autospar låst'
            : 'Sparas inte i den här webbläsaren';
    el.title = s.kind === 'blocked' ? 'Det autosparade projektet är från en nyare version och skrivs inte över. Spara som fil för att behålla det du gör här.' : '';
    if (s.kind === 'blocked' && !blockedHintShown) {
      blockedHintShown = true;
      app.hint('En nyare version av programmet har autosparat ett projekt här. Det skrivs inte över; spara som fil för att behålla det du gör nu.', 7000);
    }
  };
  startAutosave(app.store, showSaveStatus, { blocked: start.autosaveBlocked });
  if (start.autosaveBlocked) showSaveStatus({ kind: 'blocked' });
  else if (start.saved) app.out('save').textContent = `Sparat ${tf.format(new Date(start.saved.savedAt))}`;

  const newProjectDialog = new NewProjectDialog((doc) => {
    forgetProjectFile();
    app.ui.state = defaultState(doc);
    app.store.load(doc);
    app.hint(`${doc.project.name} är skapat. Rita väggar med W eller verktyget Vägg.`, 4000);
  });
  app.root.appendChild(newProjectDialog.el);

  async function saveNow(as: boolean): Promise<void> {
    if (import.meta.env.MODE === 'artifact') {
      app.hint('Förhandsvisningen kan inte spara filer. Det fungerar i versionen på webbhotellet.', 4000);
      return;
    }
    const doc = app.store.doc;
    const r = as ? await saveProjectFile(doc, brand.fileExtension) : await saveProject(doc, brand.fileExtension);
    if (r === 'saved') {
      app.hint(app.uiSettings.autosaveFile ? `Projektet sparades. Ändringarna autosparas nu till ${projectFileName()}.` : 'Projektet sparades.', 4000);
      void writeFile();
    }
    if (r === 'downloaded') app.hint('Projektfilen laddades ner.');
  }

  async function openFile(): Promise<void> {
    try {
      const doc = await openProjectFile(brand.fileExtension);
      if (doc) {
        app.ui.state = defaultState(doc);
        app.store.load(doc);
        const name = projectFileName();
        app.hint(name && app.uiSettings.autosaveFile ? `Öppnade ${doc.project.name}. Ändringarna autosparas till ${name}.` : `Öppnade ${doc.project.name}.`, 4000);
      }
    } catch (err) {
      app.hint((err as Error).message, 5000);
    }
  }

  /** Börja om med exemplet. */
  function resetSample(): void {
    const doc = sampleProject();
    forgetProjectFile();
    app.ui.state = defaultState(doc);
    app.store.load(doc);
    app.hint('Exemplet är återställt.');
  }

  return { newProjectDialog, openFile, resetSample, saveNow };
}
