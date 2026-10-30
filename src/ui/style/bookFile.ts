import type { DocStore } from '../../core/store';
import type { ProjectDoc } from '../../core/model';
import type { ViewCategory } from '../../core/viewCategories';
import { exportBook, importBook, paperCounts, paperInFile, readBookFile, type PaperChoice, type StyleBookFile } from '../../core/styleBookFile';
import { clearTemplate, loadTemplate, saveTemplate } from '../../storage/localStore';
import { withFrozenPens } from '../../repr/penPlaces';
import { askChecks } from '../ask';
import { pickFile } from './resourceEdits';

/**
 * Stilboken ut och in (0.10.40): *Exportera…*, *Importera…* och *Mall för
 * nya projekt…* i stilbokens rubrikrad. Mallbladen och stämplarna följer
 * med som val.
 */

/**
 * Fråga om mallbladen och stämplarna ska med. Har projektet inga svaras
 * direkt utan dem; null om man avbryter.
 */
export async function askPaper(doc: ProjectDoc, title: string, text: string, ok: string, extra?: string, counts = paperCounts(doc)): Promise<(PaperChoice & { extra?: boolean }) | null> {
  if (!counts.masters && !counts.stamps && !extra) return { masters: false, stamps: false };
  const checks = [
    ...(counts.masters ? [{ key: 'masters', label: `Mallbladen (${counts.masters}), med det som är ritat på dem`, checked: true }] : []),
    ...(counts.stamps ? [{ key: 'stamps', label: `Stämplarna (${counts.stamps})`, checked: true }] : []),
  ];
  const r = await askChecks(title, text, checks, ok, extra);
  return r ? { masters: !!r.masters, stamps: !!r.stamps, ...(r.extra ? { extra: true } : {}) } : null;
}

/** *Exportera…*: hela stilboken som fil, med bilderna och (om man vill) papperet. */
export async function exportBookFile(doc: ProjectDoc, save: (file: StyleBookFile) => void): Promise<void> {
  const choice = await askPaper(doc, 'Exportera stilboken', 'Hela stilboken sparas som fil, med logotypen och materialens texturer. Projektets uppgifter (namn, nummer, fastighet, skede) följer inte med.', 'Exportera');
  if (choice) save(exportBook(doc, choice));
}

/** *Mall för nya projekt…*: stilboken i webbläsaren, som nya projekt får; eller ta bort mallen. */
export async function templateDialog(doc: ProjectDoc, notify: (msg: string) => void): Promise<void> {
  const had = await loadTemplate();
  const when = had ? new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(had.savedAt) : '';
  const text = had
    ? `Mallen i webbläsaren är ${had.name}, sparad ${when}. Den ersätts med den här stilboken. Nya projekt får mallen; under Nytt projekt kan du också välja Svensk standard eller en stilboksfil.`
    : 'Nya projekt får den här stilboken i stället för Svensk standard. Mallen sparas i webbläsaren och försvinner om webbläsarens data rensas: exportera stilboken också som fil, så kan du välja filen under Nytt projekt.';
  const choice = await askPaper(doc, 'Mall för nya projekt', text, 'Spara som mall', had ? 'Ta bort mallen' : undefined);
  if (!choice) return;
  if (choice.extra) {
    await clearTemplate();
    notify('Mallen är borttagen. Nya projekt får Svensk standard.');
    return;
  }
  const ok = await saveTemplate(JSON.stringify(exportBook(doc, choice)), doc.graphics.name);
  notify(ok ? `${doc.graphics.name} är mall för nya projekt.` : 'Webbläsaren sparade inte mallen (privat fönster eller blockerad webbplatsdata). Exportera stilboken som fil i stället.');
}

/**
 * *Importera…*: filens stilbok ersätter projektets, med bilderna och det
 * papper man kryssar. En äldre stilmall ger stilen till kategorin `at`.
 */
export function importBookFile(store: DocStore, at: ViewCategory | undefined, onError: (msg: string) => void): void {
  pickFile('.json,application/json', async (file) => {
    try {
      const read = readBookFile(JSON.parse(await file.text()), store.doc.graphics, at);
      const choice = read.paper
        ? await askPaper(store.doc, 'Importera stilboken', `Stilboken i ${file.name} ersätter projektets. Filen har också mallblad eller stämplar; de du kryssar läggs till bredvid de som finns.`, 'Importera', undefined, paperInFile(read))
        : { masters: false, stamps: false };
      if (!choice) return;
      // Pennlistan låses (0.10.36), som vid andra ändringar.
      read.book = withFrozenPens({ ...store.doc, graphics: read.book });
      importBook(store, read, choice, `Importera stilbok: ${read.book.name}`);
    } catch (err) {
      onError(err instanceof SyntaxError ? 'Filen gick inte att läsa som stilbok.' : (err as Error).message);
    }
  });
}
