// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
/**
 * Id för typsnitten som följer med appen. Måtten och filerna ligger i
 * `formats/fonts.ts` (`BUNDLED_FONTS`, samma ordning); kärnan behöver bara
 * veta vilka id som inte är egna typsnitt i projektet.
 */
export const BUNDLED_FONT_IDS = ['osifont', 'arimo', 'josefin'] as const;

export const isBundledFont = (id: string | undefined): boolean => !!id && (BUNDLED_FONT_IDS as readonly string[]).includes(id);
