import type { ProjectDoc } from '../core/model';
import { parse, serialize } from './format';

/**
 * Spara och öppna projektfiler. Där webbläsaren har filsystems-API:t
 * (Chrome, Edge) används en riktig spara-dialog; annars laddas filen ner.
 */

export function saveProjectFile(doc: ProjectDoc, extension: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  return saveTextFile(serialize(doc), safeName(doc.project.name), extension, 'Projekt');
}

/** Spara text som fil, med spara-dialog där webbläsaren har en. */
export async function saveTextFile(text: string, baseName: string, extension: string, description: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const name = `${safeName(baseName)}.${extension}`;
  const picker = (window as any).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description, accept: { 'application/json': [`.${extension}`] } }],
      });
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      return 'saved';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      // Annars faller vi tillbaka på nedladdning.
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

/** Låt användaren välja en fil och läs den som projekt. */
export function openProjectFile(extension: string): Promise<ProjectDoc | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `.${extension},.json,application/json`;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(parse(await file.text()));
      } catch (e) {
        reject(e);
      }
    });
    input.click();
  });
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '').trim() || 'projekt';
}
