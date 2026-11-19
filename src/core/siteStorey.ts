// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
/** Platsens id (0.10.25); `model.ts` exporterar det vidare. Egen fil så att stilarna kan fråga utan att importera modellen. */
export const SITE_STOREY = 'platsen';

/** Om id:t (eller våningen) är Platsen. */
export function isSite(s: string | { site?: boolean } | undefined | null): boolean {
  return typeof s === 'string' ? s === SITE_STOREY : !!s?.site;
}
