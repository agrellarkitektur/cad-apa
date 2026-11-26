// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { uniqueNames, writeZip } from '../../formats/zip';
import { keepUnreadable, loadLocal, unreadableEntries, type LocalRecord } from '../../storage/localStore';
import { saveBlobFile } from '../../storage/projectFile';

/**
 * Autospar som inte går att öppna (0.12.5.9, granskningen 26 november, drift
 * 1 och 3). Ett autospar i ett äldre format eller som är trasigt läggs undan
 * under en egen nyckel; här får användaren veta det och kan spara det som
 * fil: med ett besked vid start, med menyraden *Undanlagda autospar…* och,
 * om appen inte går att starta alls, med räddningsrutan.
 */

type Hint = (text: string, ms?: number) => void;

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

/** Filnamnet för ett undanlagt autospar: projektets namn och dagen det sparades. */
export function setAsideName(rec: Pick<LocalRecord, 'text' | 'savedAt'>, ext: string): string {
  const d = day(rec.savedAt);
  return `${projectName(rec.text) || 'Autospar'}${d ? ` (autosparat ${d})` : ''}.${ext}`;
}

async function saveOne(rec: LocalRecord, ext: string): Promise<'saved' | 'downloaded' | 'cancelled'> {
  return saveBlobFile(new Blob([rec.text], { type: 'application/json' }), setAsideName(rec, ext), 'Projekt', { 'application/json': [`.${ext}`] });
}

/** Menyraden: spara de undanlagda autosparen, ett som fil, fler som en zipfil. */
export async function saveSetAside(ext: string, hint: Hint): Promise<void> {
  const list = await unreadableEntries();
  if (!list.length) return hint('Det finns inga undanlagda autospar i den här webbläsaren.', 4000);
  let r: 'saved' | 'downloaded' | 'cancelled';
  if (list.length === 1) r = await saveOne(list[0].rec, ext);
  else {
    const enc = new TextEncoder();
    const names = uniqueNames(list.map((e) => setAsideName(e.rec, ext)));
    const zip = writeZip(list.map((e, i) => ({ name: names[i], data: enc.encode(e.rec.text) })));
    r = await saveBlobFile(new Blob([zip as BlobPart], { type: 'application/zip' }), `cad-apa-undanlagda-${new Date().toLocaleDateString('sv-SE')}.zip`, 'Zipfil', { 'application/zip': ['.zip'] });
  }
  if (r !== 'cancelled') hint(list.length === 1 ? 'Det undanlagda autosparet är sparat som fil.' : `${list.length} undanlagda autospar är sparade i en zipfil.`, 5000);
}

/** Beskedet vid start: autosparet gick inte att öppna och har lagts undan. */
export function showSetAsideNotice(rec: LocalRecord, reason: string, ext: string, hint: Hint): void {
  const bar = document.createElement('div');
  bar.className = 'update-bar move-bar';
  bar.setAttribute('role', 'alert');
  const text = document.createElement('span');
  text.className = 'move-text';
  text.innerHTML = '<span aria-hidden="true">⚠</span> <b>Det autosparade projektet kunde inte öppnas och har lagts undan.</b> ';
  text.append(`${reason} Programmet startade med exemplet. Det undanlagda finns också under menyn › Undanlagda autospar.`);
  bar.append(text);
  bar.insertAdjacentHTML(
    'beforeend',
    `<button type="button" class="btn btn-primary" data-aside="save">Spara som fil</button>
    <button type="button" class="icon-mini" aria-label="Stäng" title="Stäng">×</button>`,
  );
  bar.querySelector('[data-aside="save"]')!.addEventListener('click', async () => {
    const r = await saveOne(rec, ext);
    if (r !== 'cancelled') {
      hint('Det undanlagda autosparet är sparat som fil.', 4000);
      bar.remove();
    }
  });
  bar.querySelector('.icon-mini')!.addEventListener('click', () => bar.remove());
  document.body.appendChild(bar);
}

/**
 * Räddningsrutan: appen gick inte att starta (ett autospar som går att läsa
 * men inte att rita). Autosparet kan sparas som fil, eller läggas undan så
 * att appen startar med exemplet. Utan den var enda utvägen att rensa
 * webbplatsens data, vilket tog bort projektet.
 */
export async function showRescue(root: HTMLElement, err: unknown, ext: string): Promise<void> {
  console.error(err);
  const rec = await loadLocal();
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'rescue';
  box.setAttribute('role', 'alertdialog');
  const h = document.createElement('h1');
  h.textContent = 'Programmet kunde inte starta';
  const p = document.createElement('p');
  p.textContent = rec
    ? 'Det autosparade projektet gick att läsa men inte att rita. Spara det som fil, så att inget går förlorat, och börja sedan med exemplet. Skicka den gärna med en synpunkt.'
    : 'Något gick fel när programmet startade. Ladda om sidan; hjälper det inte, skicka gärna en synpunkt.';
  const detail = document.createElement('p');
  detail.className = 'rescue-detail';
  detail.textContent = String((err as Error)?.message ?? err);
  const buttons = document.createElement('div');
  buttons.className = 'rescue-buttons';
  box.append(h, p, detail, buttons);
  const button = (label: string, primary: boolean, run: () => void | Promise<void>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = primary ? 'btn btn-primary' : 'btn';
    b.textContent = label;
    b.addEventListener('click', () => void run());
    buttons.append(b);
    return b;
  };
  if (rec) {
    button('Spara autosparet som fil', true, async () => {
      const r = await saveOne(rec, ext);
      if (r !== 'cancelled') p.textContent = 'Autosparet är sparat som fil. Börja med exemplet för att fortsätta.';
    });
    button('Börja med exemplet', false, async () => {
      // Autosparet läggs undan (det finns kvar under menyn › Undanlagda autospar) och tas bort som aktuellt.
      // Går det inte (full lagring) startar appen med exemplet utan att röra autosparet (`?exempel`).
      if (await keepUnreadable(rec, { clear: true })) location.reload();
      else location.search = '?exempel';
    });
  } else button('Ladda om', true, () => location.reload());
  root.append(box);
}
