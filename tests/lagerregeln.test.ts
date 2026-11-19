// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUNDLED_FONTS } from '../src/formats/fonts';
import { BUNDLED_FONT_IDS } from '../src/core/fontIds';

/**
 * Lagerregeln (UTVECKLING.md, *Lagren*; Granskning efter 0.12): `geometry/`
 * importerar bara ur sig själv, `core/` bara ur sig själv och `geometry/`.
 * Gäller också importer av typer.
 */
const SRC = 'src';
const join = (...p: string[]) => p.join('/');
const ALLOWED: Record<string, readonly string[]> = { geometry: ['geometry'], core: ['core', 'geometry'] };

function importsOf(dir: string): { file: string; target: string }[] {
  const out: { file: string; target: string }[] = [];
  for (const f of readdirSync(join(SRC, dir), { recursive: true }) as string[]) {
    if (!f.endsWith('.ts')) continue;
    const text = readFileSync(join(SRC, dir, f), 'utf8');
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const depth = f.split(/[\\/]/).length - 1;
      const parts = [dir, ...f.split(/[\\/]/).slice(0, depth)];
      for (const seg of m[1].split('/')) {
        if (seg === '..') parts.pop();
        else if (seg !== '.') parts.push(seg);
      }
      out.push({ file: `${dir}/${f}`, target: parts[0] ?? '' });
    }
  }
  return out;
}

describe('lagerregeln', () => {
  for (const [dir, ok] of Object.entries(ALLOWED)) {
    it(`${dir}/ importerar bara ur ${ok.join(' och ')}`, () => {
      const bad = importsOf(dir).filter((i) => !ok.includes(i.target));
      expect(bad).toEqual([]);
    });
  }

  it('kärnans typsnitts-id stämmer med typsnitten som följer med', () => {
    expect(BUNDLED_FONTS.map((f) => f.id)).toEqual([...BUNDLED_FONT_IDS]);
  });
});
