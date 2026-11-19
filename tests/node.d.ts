// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
/**
 * Det testerna använder av Node (0.8.32), så att de kan typkontrolleras med
 * `tsc` utan paketet @types/node. Vitest ger tomma CSS-filer, så
 * stilarnas test läser dem från disken.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
}
