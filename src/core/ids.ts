/** Korta, slumpade id:n med prefix som visar vad de är, t.ex. "el-k3f9x2m1". */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += (b % 36).toString(36);
  return `${prefix}-${s}`;
}

/**
 * En nyckel ur ett namn (små bokstäver, bindestreck), som inte finns bland
 * `taken`: `base`, `base-2`, `base-3` … `fallback` när namnet inte ger något.
 */
export function slugId(name: string, taken: ReadonlySet<string>, fallback: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback;
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}
