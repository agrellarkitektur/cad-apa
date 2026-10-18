/**
 * Produktens utåtvända identitet. Motorn (Bacchus) vet ingenting om namnet
 * appen säljs eller sprids under; allt som syns för användaren hämtas härifrån.
 */
export interface Brand {
  /** Produktnamn som visas i appen och i webbläsarens flik. */
  name: string;
  /** Kort namn för hemskärmsikonen när appen installeras. */
  shortName: string;
  /** En mening om vad appen är. Används i manifest och metadata. */
  description: string;
  /** Visas som en etikett bredvid namnet, t.ex. "Demo". Utelämna för skarp version. */
  badge?: string;
  /** Färg för webbläsarens adressfält och installerad app (ljust tema). */
  themeColor: string;
  /** Filändelse för projektfiler, utan punkt. */
  fileExtension: string;
  /** Logotypens SVG-innehåll (utan yttre <svg>), ritat i en 24×24-ruta med currentColor. */
  logoSvg: string;
}
