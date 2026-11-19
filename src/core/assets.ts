// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { Id } from './model';
import type { TxBuilder } from './store';

/** Ta bort filer som inget element längre använder (bland `candidates`). */
export function pruneAssets(tx: TxBuilder, candidates: Iterable<Id>): void {
  const used = new Set<unknown>(Object.values(tx.doc.elements).map((e) => e.params.asset));
  // Materialens texturer och ortofotot (0.10.31) räknas också.
  for (const m of tx.doc.graphics.materials ?? []) if (m.texture) used.add(m.texture.asset);
  if (tx.doc.site?.ortho) used.add(tx.doc.site.ortho.asset);
  // Kontorets logotyp (0.10.39) också, när den inte ligger på något blad.
  if (tx.doc.graphics.office?.logo) used.add(tx.doc.graphics.office.logo.asset);
  for (const a of candidates) if (!used.has(a)) tx.removeAsset(a);
}
