/**
 * Underlag i vyn (0.10.35): något annat i projektet som ritas tonat under
 * eller över vyn och följer med den till bladet. Underlagen ligger i
 * vykategorins visning (`CategoryShow.underlays`) och kan ändras i vyn (en
 * avvikelse, `underlays`, med hela listan). Dagens kalkering är en genväg
 * som lägger ett underlag.
 */

/** Ortofotot (0.10.31) i 2D, som källa för ett underlag. */
export const UNDERLAY_ORTHO = 'ortofoto';
/** Ett arbetsblad som källa: `arbetsblad:` och bladets id. */
export const UNDERLAY_WORKSHEET = 'arbetsblad:';

/** Hur underlaget ritas: tonat i sina färger, i gråskala, bara konturerna, eller i en färg. */
export type UnderlayLook = 'tinted' | 'gray' | 'outline' | 'color';

export const UNDERLAY_LOOKS: readonly { id: UnderlayLook; name: string }[] = [
  { id: 'tinted', name: 'Tonad' },
  { id: 'gray', name: 'Gråskala' },
  { id: 'outline', name: 'Bara konturer' },
  { id: 'color', name: 'I en färg' },
];

export interface ViewUnderlay {
  /**
   * Varifrån: en vys id, `arbetsblad:<id>`, `ortofoto`, eller en våning som
   * i kalkeringen (`våning:under`, `våning:över`, `våning:platsen`,
   * `våning:id:<id>`).
   */
  source: string;
  /** Över ritningen (utan vita fyllningar); annars under. */
  above?: boolean;
  /** Utelämnat = tonad. */
  look?: UnderlayLook;
  /** Färgen när `look` är `color`. */
  color?: string;
  /** Täckning i procent, 5–100. Utelämnad = `UNDERLAY_OPACITY`. */
  opacity?: number;
}

export const UNDERLAY_OPACITY = 40;
/** Färgen som föreslås för `I en färg`, samma röda som kalkeringen hade. */
export const UNDERLAY_COLOR = '#c2372c';

/** Underlagen från fil: de utan källa hoppas över, värdena hålls inom gränserna. */
export function normalizeUnderlays(v: unknown): ViewUnderlay[] {
  const out: ViewUnderlay[] = [];
  for (const u of Array.isArray(v) ? v : []) {
    if (!u || typeof u !== 'object' || typeof u.source !== 'string' || !u.source) continue;
    const look = UNDERLAY_LOOKS.some((l) => l.id === u.look) ? (u.look as UnderlayLook) : undefined;
    const op = Number(u.opacity);
    out.push({
      source: u.source,
      ...(u.above === true ? { above: true } : {}),
      ...(look && look !== 'tinted' ? { look } : {}),
      ...(typeof u.color === 'string' && /^#[0-9a-f]{6}$/i.test(u.color) ? { color: u.color.toLowerCase() } : {}),
      ...(Number.isFinite(op) && op !== UNDERLAY_OPACITY ? { opacity: Math.min(100, Math.max(5, Math.round(op))) } : {}),
    });
  }
  return out;
}

/** Lägg till ett underlag i listan, eller ta bort det om källan redan finns (genvägen Kalkera). */
export function toggleUnderlay(list: readonly ViewUnderlay[] | undefined, source: string): ViewUnderlay[] {
  const cur = list ?? [];
  return cur.some((u) => u.source === source) ? cur.filter((u) => u.source !== source) : [...cur, { source }];
}
