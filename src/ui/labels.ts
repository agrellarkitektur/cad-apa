import type { Element, ProjectDoc } from '../core/model';
import { typeOf } from '../elements/registry';

/** Hur ett element benämns i gränssnittet: "Vägg IV01", "Dörr D1", "Rum Allrum". */
export function labelOf(doc: ProjectDoc, el: Element): string {
  const t = typeOf(el.type);
  const typeName = t?.label ?? el.type;
  const littera = el.definition ? doc.definitions[el.definition]?.name : undefined;
  const parts = [typeName, littera, el.name].filter(Boolean);
  return parts.join(' ');
}

/** Svenska namn på parametrar som visas i panelerna. */
export const PARAM_LABELS: Record<string, string> = {
  thickness: 'Tjocklek',
  width: 'Bredd',
  height: 'Höjd',
  sill: 'Bröstning',
  at: 'Läge längs vägg',
};

export function escapeHtml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}

/** Nästa lediga littera med ett prefix: IV01, IV02 … eller F1, F2 … */
export function nextLittera(doc: ProjectDoc, elementType: string, prefix: string): string {
  const used = new Set(Object.values(doc.definitions).filter((d) => d.elementType === elementType).map((d) => d.name));
  const pad = elementType === 'Wall';
  for (let i = 1; i < 1000; i++) {
    const name = `${prefix}${pad ? String(i).padStart(2, '0') : i}`;
    if (!used.has(name)) return name;
  }
  return `${prefix}?`;
}
