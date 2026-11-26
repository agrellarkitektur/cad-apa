// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
/**
 * Bacchus är motorns interna namn. Det används i koden, i projektfilernas
 * format och i felsökning, men aldrig som produktnamn i gränssnittet.
 */
export const ENGINE = {
  name: 'Bacchus',
  /** Versionen. Vad varje version innehåller står i README och docs/PLAN.md. */
  version: '0.12.5.9',
} as const;
