// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur

/**
 * Länken till källkoden (0.12.5.4, AGPL-3.0 §13): den som använder appen över
 * nätet ska erbjudas källkoden till just den version som körs. Bygget skriver
 * in commiten (`VITE_SOURCE_COMMIT` i vite.config.ts); utan den går länken
 * till repot. Den som kör en ändrad version byter SOURCE_REPO till sitt eget.
 */
export const SOURCE_REPO = 'https://github.com/agrellarkitektur/cad-apa';

export function sourceUrl(commit: unknown = import.meta.env.VITE_SOURCE_COMMIT): string {
  return typeof commit === 'string' && /^[0-9a-f]{7,40}$/.test(commit) ? `${SOURCE_REPO}/tree/${commit}` : SOURCE_REPO;
}

/** En fil i repot vid samma commit (LICENSE, THIRD-PARTY.md …). */
export function sourceFileUrl(path: string, commit: unknown = import.meta.env.VITE_SOURCE_COMMIT): string {
  const ref = typeof commit === 'string' && /^[0-9a-f]{7,40}$/.test(commit) ? commit : 'main';
  return `${SOURCE_REPO}/blob/${ref}/${path}`;
}
