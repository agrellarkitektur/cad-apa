import type { StyleSheet } from './graphics';

/**
 * Linjetyperna (0.8.30): de inbyggda och projektets egna i stilmallen
 * (`StyleSheet.lineTypes`). Ett mönster är streck och mellanrum på papper i
 * mm, omväxlande, och börjar med ett streck. Ett streck kortare än 0,5 mm
 * ritas som en punkt (med rund ände). Tomt mönster = heldragen.
 *
 * En 2D-form och en penna i stilmallen anger linjetypen med dess nyckel.
 * En nyckel som inte finns (en borttagen egen linjetyp) ritas heldragen.
 */

/** En linjetyp: namnet och mönstret på papper i mm. */
export interface LineTypeDef {
  name: string;
  dash: number[];
}

/** En egen linjetyp i stilmallen, med sin nyckel. */
export interface CustomLineType extends LineTypeDef {
  id: string;
}

/** De inbyggda, i den ordning de står i listorna. Nycklarna sparas i projekten. */
export const LINE_TYPES: Record<string, LineTypeDef> = {
  solid: { name: 'Heldragen', dash: [] },
  dashed: { name: 'Streckad', dash: [3, 1.5] },
  dashedShort: { name: 'Kort streckad', dash: [1.5, 1] },
  dashedLong: { name: 'Lång streckad', dash: [6, 2] },
  dotted: { name: 'Prickad', dash: [0.3, 1] },
  dashdot: { name: 'Punktstreckad', dash: [5, 1, 0.3, 1] },
  dashdotdot: { name: 'Streck och två punkter', dash: [5, 1, 0.3, 1, 0.3, 1] },
};

/** Alla linjetyper som går att välja: de inbyggda och stilmallens egna. */
export function lineTypeList(style: StyleSheet | undefined): { id: string; name: string; dash: number[]; own: boolean }[] {
  return [
    ...Object.entries(LINE_TYPES).map(([id, t]) => ({ id, ...t, own: false })),
    ...(style?.lineTypes ?? []).map((t) => ({ ...t, own: true })),
  ];
}

/** Mönstret för nyckeln, eller undefined för heldragen (också för en okänd nyckel). */
export function lineTypeDash(style: StyleSheet | undefined, key: string | undefined): number[] | undefined {
  if (!key || key === 'solid') return undefined;
  const dash = LINE_TYPES[key]?.dash ?? style?.lineTypes?.find((t) => t.id === key)?.dash;
  return dash?.length ? dash : undefined;
}

/** Ett mönster ur text, t.ex. "3 1,5" eller "5; 1; 0,3; 1". Null om texten inte är ett mönster. */
export function parseDash(text: string): number[] | null {
  const parts = text
    .trim()
    .split(/[\s;]+/)
    .filter(Boolean)
    .map((s) => Number(s.replace(',', '.')));
  if (!parts.length || parts.some((x) => !Number.isFinite(x) || x < 0) || parts.length > 12) return null;
  // Bara mellanrum ritar ingenting.
  if (!parts.some((x) => x > 0)) return null;
  return parts.map((x) => Math.round(x * 100) / 100);
}

/** Mönstret som text, med decimalkomma: [5, 1, 0.3, 1] → "5 1 0,3 1". */
export function formatDash(dash: readonly number[]): string {
  return dash.map((x) => String(x).replace('.', ',')).join(' ');
}

/** En ny nyckel för en egen linjetyp, som inte krockar med någon annan. */
export function newLineTypeId(style: StyleSheet): string {
  const used = new Set([...Object.keys(LINE_TYPES), ...(style.lineTypes ?? []).map((t) => t.id)]);
  let i = 1;
  while (used.has(`egen-${i}`)) i++;
  return `egen-${i}`;
}

/** Stilmallens egna linjetyper från fil; de som inte går att läsa hoppas över. */
export function normalizeLineTypes(v: unknown): CustomLineType[] | null {
  if (!Array.isArray(v)) return null;
  const out: CustomLineType[] = [];
  for (const t of v) {
    const dash = Array.isArray(t?.dash) ? t.dash.map(Number) : [];
    if (typeof t?.id !== 'string' || !t.id || LINE_TYPES[t.id] || out.some((o) => o.id === t.id)) continue;
    if (dash.some((x: number) => !Number.isFinite(x) || x < 0)) continue;
    out.push({ id: t.id, name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : t.id, dash });
  }
  return out.length ? out : null;
}
