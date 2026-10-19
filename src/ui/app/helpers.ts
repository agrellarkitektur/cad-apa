import type { Id, ProjectDoc, ViewDef } from '../../core/model';

export const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
export const tf = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });

/** Vanliga skalor för vyer och annotering (0.8 del 3). */
export const ANNOTATION_SCALES = [1, 2, 5, 10, 20, 50, 100, 200, 400, 500, 1000, 2000];

/** Kort beskrivning av en vy i vylistan. */
export function describeView(v: ViewDef): string {
  const detail = { sketch: 'Skiss', normal: 'Normal', detail: 'Detalj' }[v.detail];
  return [`1:${v.scale ?? 100}`, detail, v.compare ? 'jämför' : '', v.hideDemolished ? 'utan rivet' : '', v.style ?? ''].filter(Boolean).join(' · ');
}

export { defaultState } from '../../core/states';

/** Första typen (i littera-ordning) för en elementtyp. */
export function firstDefinition(doc: ProjectDoc, type: string): Id | null {
  const defs = Object.values(doc.definitions)
    .filter((d) => d.elementType === type)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
  return defs[0]?.id ?? null;
}

/** Förvald väggtyp i verktyget: en innervägg om det finns, annars den första typen. */
export function defaultWallType(doc: ProjectDoc): Id | null {
  const defs = Object.values(doc.definitions).filter((d) => d.elementType === 'Wall');
  return (defs.find((d) => d.name.startsWith('IV')) ?? defs[0])?.id ?? null;
}

/** Nästa lediga namn på ett förslag: Förslag A, B … */
export function nextProposalName(doc: ProjectDoc): string {
  const used = new Set(doc.states.map((s) => s.name));
  for (let i = 0; i < 26; i++) {
    const name = `Förslag ${String.fromCharCode(65 + i)}`;
    if (!used.has(name)) return name;
  }
  return `Förslag ${doc.states.length + 1}`;
}

/** Avrunda skalan till två värdesiffror: 1:87, 1:120, 1:4 300. */
export function formatScale(n: number): string {
  if (n < 1) return (Math.round(n * 10) / 10).toLocaleString('sv-SE');
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return nf.format(Math.round(n / p) * p);
}
