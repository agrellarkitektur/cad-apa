import type { Brand } from '../../brand';
import { sampleProject } from '../../sample/sampleProject';
import { startAutosave, type SaveStatus } from '../../storage/autosave';
import type { LocalRecord } from '../../storage/localStore';
import { forgetProjectFile, openProjectFile, saveProject, saveProjectFile } from '../../storage/projectFile';
import { NewProjectDialog } from '../newProjectDialog';
import type { AppContext } from './context';
import { defaultState, tf } from './helpers';

/**
 * Projektet som fil: autospar med status i statusraden, Spara, Spara som,
 * Öppna, Nytt projekt och Börja om med exemplet.
 */
export function installFiles(app: AppContext, brand: Brand, start: { saved: LocalRecord | null; autosaveBlocked: boolean }) {
  let blockedHintShown = false;
  const showSaveStatus = (s: SaveStatus) => {
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
    if (r === 'saved') app.hint('Projektet sparades.');
    if (r === 'downloaded') app.hint('Projektfilen laddades ner.');
  }

  async function openFile(): Promise<void> {
    try {
      const doc = await openProjectFile(brand.fileExtension);
      if (doc) {
        app.ui.state = defaultState(doc);
        app.store.load(doc);
        app.hint(`Öppnade ${doc.project.name}.`);
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
