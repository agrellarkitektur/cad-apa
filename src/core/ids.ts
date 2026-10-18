/** Korta, slumpade id:n med prefix som visar vad de är, t.ex. "el-k3f9x2m1". */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += (b % 36).toString(36);
  return `${prefix}-${s}`;
}
