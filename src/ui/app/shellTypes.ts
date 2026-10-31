import type { Definition, Id } from '../../core/model';
import { profileTypesFor } from '../../core/profiles';
import { canUseAs, defaultProfileTypes } from '../../core/profileTypes';
import { defaultRailingTypes } from '../../core/railingTypes';
import type { DocStore } from '../../core/store';

/**
 * Typen som argument i kommandoraden (0.11.7.1): `PROFIL PR03` väljer
 * profilverktyget med PR03, `RÄCKE RÄ02` räcket med RÄ02. Medan verktyget
 * är igång räcker litteran (`PR03`). Projektets typer går först; saknar
 * projektet typen men den är en av de förvalda väljs den, och den läggs in
 * med det första objektet som förut.
 */
export type TypedTool = 'profile' | 'railing';

const norm = (s: string): string => s.trim().toLocaleLowerCase('sv').replace(/\s+/g, '');

function candidates(doc: DocStore['doc'], tool: TypedTool): Definition[] {
  if (tool === 'profile') {
    const own = profileTypesFor(doc);
    const ids = new Set(own.map((d) => d.id));
    return [...own, ...defaultProfileTypes().filter((d) => canUseAs(d.profile, 'free') && !ids.has(d.id) && !doc.definitions[d.id])];
  }
  const own = Object.values(doc.definitions).filter((d) => d.elementType === 'Railing' && d.railing?.group !== 'Grindar');
  const ids = new Set(own.map((d) => d.id));
  return [...own, ...defaultRailingTypes().filter((d) => d.railing?.group !== 'Grindar' && !ids.has(d.id) && !doc.definitions[d.id])];
}

/** Typen vars littera (eller littera och beskrivning) är texten; null om ingen. */
export function typeByName(doc: DocStore['doc'], tool: TypedTool, text: string): Id | null {
  const t = norm(text);
  if (!t) return null;
  const all = candidates(doc, tool);
  return all.find((d) => norm(d.name) === t)?.id ?? all.find((d) => norm(`${d.name}${d.description ?? ''}`).startsWith(t) && t.length > norm(d.name).length)?.id ?? null;
}

/** Delar `PROFIL PR03` i kommandot och argumentet; null om texten inte har två ord. */
export function splitArgument(text: string): { cmd: string; arg: string } | null {
  const m = /^(\S+)\s+(.+)$/.exec(text.trim());
  return m ? { cmd: m[1], arg: m[2] } : null;
}
