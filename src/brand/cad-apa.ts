import type { Brand } from './types.ts';

/** Låtsasbranding för den publika betan. Byts mot den riktiga när namnet är bestämt. */
export const cadApa: Brand = {
  name: 'cad-apa',
  shortName: 'cad-apa',
  description: 'Ritprogram i webbläsaren för små arkitektkontor. Alfaversion.',
  badge: 'Alfa',
  // Delad i bitar så att den inte plockas upp av adressinsamlare.
  feedbackFallback: ['ca', 'agrellarkitektur.se'].join('@'),
  themeColor: '#f3f5f6',
  fileExtension: 'cadapa',
  // En enkel apa i linjer: huvud, öron och ansiktsfält.
  logoSvg:
    '<circle cx="12" cy="12.5" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<circle cx="4.2" cy="11" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<circle cx="19.8" cy="11" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M8.2 14.2c0-2.3 1.7-3.7 3.8-3.7s3.8 1.4 3.8 3.7c0 2-1.7 3.2-3.8 3.2s-3.8-1.2-3.8-3.2z" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
    '<circle cx="9.9" cy="9.6" r="0.9" fill="currentColor"/><circle cx="14.1" cy="9.6" r="0.9" fill="currentColor"/>',
};
