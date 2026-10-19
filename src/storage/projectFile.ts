import type { ProjectDoc } from '../core/model';
import { parse, serialize } from './format';

/**
 * Spara och öppna projektfiler. Där webbläsaren har filsystems-API:t
 * (Chrome, Edge) används en riktig spara-dialog; annars laddas filen ner.
 */

/**
 * Filen projektet senast sparades till eller öppnades från, där webbläsaren
 * har filsystems-API:t (Chrome och Edge). Då sparar Spara tillbaka till samma
 * fil; annars frågar Spara efter en plats, eller laddar ner filen.
 */
let currentHandle: any = null;

/** Glöm den öppna filen, t.ex. vid nytt projekt. */
export function forgetProjectFile(): void {
  currentHandle = null;
}

export function saveProjectFile(doc: ProjectDoc, extension: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  return saveTextFile(serialize(doc), safeName(doc.project.name), extension, 'Projekt', true);
}

/** Spara till filen som redan är öppen; finns ingen frågar den som Spara som. */
export async function saveProject(doc: ProjectDoc, extension: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  if (currentHandle) {
    try {
      const w = await currentHandle.createWritable();
      await w.write(serialize(doc));
      await w.close();
      return 'saved';
    } catch {
      // Filen gick inte att skriva till (flyttad, nekad): fråga efter en plats.
      currentHandle = null;
    }
  }
  return saveProjectFile(doc, extension);
}

/** Spara text som fil, med spara-dialog där webbläsaren har en. */
export async function saveTextFile(
  text: string,
  baseName: string,
  extension: string,
  description: string,
  remember = false,
): Promise<'saved' | 'downloaded' | 'cancelled'> {
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
      if (remember) currentHandle = handle;
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

/**
 * Spara en fil (0.8 del 3), t.ex. en zipfil från Plot/export, med
 * spara-dialog där webbläsaren har en och annars som nedladdning.
 */
export async function saveBlobFile(blob: Blob, name: string, description: string, accept: Record<string, string[]>): Promise<'saved' | 'downloaded' | 'cancelled'> {
  const picker = (window as any).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description, accept }] });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return 'saved';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
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
export async function openProjectFile(extension: string): Promise<ProjectDoc | null> {
  const picker = (window as any).showOpenFilePicker;
  if (typeof picker === 'function') {
    let handle: any;
    try {
      [handle] = await picker({
        multiple: false,
        types: [{ description: 'Projekt', accept: { 'application/json': [`.${extension}`, '.json'] } }],
      });
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return null;
      handle = null;
    }
    if (handle) {
      const doc = parse(await (await handle.getFile()).text());
      currentHandle = handle;
      return doc;
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `.${extension},.json,application/json`;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const doc = parse(await file.text());
        currentHandle = null;
        resolve(doc);
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
