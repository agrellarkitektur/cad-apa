// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { uniqueNames, writeZip } from '../../formats/zip';
import { allLocalEntries } from '../../storage/localStore';
import { saveBlobFile } from '../../storage/projectFile';

/**
 * Flytten till cad-apa.danaid.cloud (0.12.5.3, docs/FLYTT.md steg 7): på den
 * gamla adressen visas en rad överst som ber användaren spara det som bara
 * finns i webbläsaren, eftersom webbläsarens lagring hör till adressen och
 * inte följer med. Webbläsaren har bara ett autosparat projekt (det öppna),
 * plus mallen och autospar som inte gick att läsa. Ett är en projektfil,
 * fler blir en zipfil.
 */

export const NEW_ADDRESS = 'https://cad-apa.danaid.cloud/';
const OLD_HOSTS = ['agrellarkitektur.se', 'www.agrellarkitektur.se'];

/** Om raden ska visas: på den gamla adressen, eller med `?flytt` för att prova. */
export function showsMoveNotice(loc: { hostname: string; search: string }): boolean {
  return OLD_HOSTS.includes(loc.hostname) || new URLSearchParams(loc.search).has('flytt');
}

export interface MoveFile {
  name: string;
  text: string;
  /** Vad filen är, för raden som bekräftar. */
  label: string;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim();
const day = (t: unknown) => (typeof t === 'number' && Number.isFinite(t) ? new Date(t).toLocaleDateString('sv-SE') : '');

function projectName(text: string): string {
  try {
    const n = (JSON.parse(text) as { project?: { name?: unknown } })?.project?.name;
    return typeof n === 'string' ? safe(n) : '';
  } catch {
    return '';
  }
}

/** Filerna som ska sparas, ur webbläsarens lagring (`allLocalEntries`). */
export function moveFiles(entries: readonly { key: string; value: unknown }[], ext: string): MoveFile[] {
  const out: MoveFile[] = [];
  for (const { key, value } of entries) {
    const rec = value as { text?: unknown; name?: unknown; savedAt?: unknown } | null;
    if (!rec || typeof rec.text !== 'string') continue;
    if (key === 'current') {
      const n = projectName(rec.text) || 'projekt';
      out.unshift({ name: `${n}.${ext}`, text: rec.text, label: `${n}.${ext}` });
    } else if (key === 'stilboksmall') {
      const n = (typeof rec.name === 'string' && safe(rec.name)) || 'stilbok';
      out.push({ name: `Mall ${n}.json`, text: rec.text, label: 'mallen för nya projekt' });
    } else if (key.startsWith('unreadable-')) {
      out.push({ name: `Autospar som inte gick att läsa ${day(rec.savedAt)}.${ext}`.replace(/ \./, '.'), text: rec.text, label: 'ett autospar som inte gick att läsa' });
    }
  }
  return out;
}

function confirmation(files: readonly MoveFile[]): string {
  const labels = files.map((f) => f.label);
  const unread = labels.filter((l) => l.startsWith('ett autospar')).length;
  const rest = labels.filter((l) => !l.startsWith('ett autospar'));
  if (unread) rest.push(unread === 1 ? labels.find((l) => l.startsWith('ett autospar'))! : `${unread} autospar som inte gick att läsa`);
  return rest.length > 1 ? `${rest.slice(0, -1).join(', ')} och ${rest[rest.length - 1]}` : rest[0];
}

/** Spara det som finns i webbläsaren: en fil som den är, fler i en zipfil. */
async function saveAll(ext: string, hint: (text: string, ms?: number) => void): Promise<void> {
  const files = moveFiles(await allLocalEntries(), ext);
  if (!files.length) return hint('Inget sparat i webbläsaren här.', 4000);
  const enc = new TextEncoder();
  let r: 'saved' | 'downloaded' | 'cancelled';
  if (files.length === 1) {
    r = await saveBlobFile(new Blob([files[0].text], { type: 'application/json' }), files[0].name, 'Projekt', { 'application/json': [`.${ext}`] });
  } else {
    const names = uniqueNames(files.map((f) => f.name));
    const zip = writeZip(files.map((f, i) => ({ name: names[i], data: enc.encode(f.text) })));
    const name = `cad-apa-flytt-${new Date().toLocaleDateString('sv-SE')}.zip`;
    r = await saveBlobFile(new Blob([zip as BlobPart], { type: 'application/zip' }), name, 'Zipfil', { 'application/zip': ['.zip'] });
  }
  if (r !== 'cancelled') hint(`Sparat: ${confirmation(files)}.`, 6000);
}

/** Visa raden om appen körs på den gamla adressen. */
export function installMoveNotice(ext: string, hint: (text: string, ms?: number) => void): void {
  if (!showsMoveNotice(location)) return;
  const bar = document.createElement('div');
  bar.className = 'update-bar move-bar';
  bar.setAttribute('role', 'alert');
  bar.innerHTML = `<span class="move-text"><span aria-hidden="true">⚠</span> <b>cad-apa flyttar till cad-apa.danaid.cloud.</b> Projektet som är sparat i webbläsaren följer inte med. Spara det som fil och öppna filen på den nya adressen.</span>
    <button type="button" class="btn btn-primary" data-move="save">Spara som fil</button>
    <a class="btn" href="${NEW_ADDRESS}" target="_blank" rel="noopener">Till nya adressen ↗</a>
    <button type="button" class="icon-mini" aria-label="Stäng" title="Stäng (kommer tillbaka när sidan laddas om)">×</button>`;
  bar.querySelector('[data-move="save"]')!.addEventListener('click', () => void saveAll(ext, hint));
  bar.querySelector('.icon-mini')!.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}
