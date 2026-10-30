import { isSite, onPaper, SITE_STOREY, type Id, type ProjectDoc } from './model';
import { neighbourStorey, TRACE_ABOVE, TRACE_BELOW, TRACE_SITE, TRACE_STOREY, tracedStorey } from './storeys';
import { UNDERLAY_ORTHO, UNDERLAY_WORKSHEET } from './viewUnderlays';

/** Underlagens källor (0.10.35): vad de är och vad de heter. */

/** Var en vy står när dess underlag ritas: våningen och om det är en plan (våning eller Platsen). */
export interface UnderlayHost {
  storey: Id;
  /** En våning eller Platsen; i en fasad, sektion eller på ett arbetsblad finns bara vyer och arbetsblad. */
  plan: boolean;
  /** Vyns eget id, så att den inte ritas under sig själv. */
  viewId?: Id;
}

/** Vad en källa är, eller null om den inte finns (längre) eller inte går att visa här. */
export type ResolvedSource = { kind: 'storey'; storey: Id } | { kind: 'ortho' } | { kind: 'worksheet'; id: Id } | { kind: 'view'; id: Id };

export function resolveSource(doc: Pick<ProjectDoc, 'storeys' | 'views' | 'worksheets' | 'site' | 'assets'>, host: UnderlayHost, source: string): ResolvedSource | null {
  if (source === UNDERLAY_ORTHO) return host.plan && doc.site?.ortho && doc.assets[doc.site.ortho.asset] ? { kind: 'ortho' } : null;
  if (source.startsWith(UNDERLAY_WORKSHEET)) {
    const id = source.slice(UNDERLAY_WORKSHEET.length);
    return doc.worksheets.some((w) => w.id === id && !onPaper(w)) ? { kind: 'worksheet', id } : null;
  }
  if (source.startsWith('våning:')) {
    if (!host.plan) return null;
    const s = tracedStorey(doc, host.storey, source);
    return s ? { kind: 'storey', storey: s.id } : null;
  }
  if (source === host.viewId) return null;
  return doc.views.some((v) => v.id === source) ? { kind: 'view', id: source } : null;
}

/** Namnet på en källa, för listan under Visa och i stilboken. Relativa våningar med vilken våning de är just nu. */
export function sourceName(doc: Pick<ProjectDoc, 'storeys' | 'views' | 'worksheets'>, source: string, storey?: Id): string {
  const named = (dir: 1 | -1, label: string) => {
    const s = storey && !isSite(storey) ? neighbourStorey(doc, storey, dir) : undefined;
    return s && !s.site ? `${label} (${s.name})` : label;
  };
  if (source === UNDERLAY_ORTHO) return 'Ortofotot';
  if (source === TRACE_BELOW) return named(-1, 'Våningen under');
  if (source === TRACE_ABOVE) return named(1, 'Våningen över');
  if (source === TRACE_SITE) return 'Platsen (marken)';
  if (source.startsWith(TRACE_STOREY)) {
    const id = source.slice(TRACE_STOREY.length);
    return id === SITE_STOREY ? 'Platsen (marken)' : (doc.storeys.find((s) => s.id === id)?.name ?? 'Våningen finns inte längre');
  }
  if (source.startsWith(UNDERLAY_WORKSHEET)) return doc.worksheets.find((w) => w.id === source.slice(UNDERLAY_WORKSHEET.length))?.name ?? 'Arbetsbladet finns inte längre';
  return doc.views.find((v) => v.id === source)?.name ?? 'Vyn finns inte längre';
}
