/**
 * Bacchus är motorns interna namn. Det används i koden, i projektfilernas
 * format och i felsökning, men aldrig som produktnamn i gränssnittet.
 */
export const ENGINE = {
  name: 'Bacchus',
  version: '0.6.2',
  /** Vilken milstolpe i byggordningen koden motsvarar. */
  milestone: 5,
  /** Antal milstolpar i byggordningen. */
  milestones: 12,
} as const;
