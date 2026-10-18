import type { Brand } from './types.ts';
import { cadApa } from './cad-apa.ts';

/**
 * Alla varumärken som appen kan byggas med. Välj med miljövariabeln
 * VITE_BRAND vid bygget, t.ex. `VITE_BRAND=cad-apa npm run build`.
 * Ett nytt varumärke = en ny fil i den här mappen + en rad här.
 */
const brands: Record<string, Brand> = {
  'cad-apa': cadApa,
};

export function resolveBrand(key: string | undefined): Brand {
  return brands[key ?? ''] ?? cadApa;
}

export type { Brand };
