// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { escapeHtml } from '../labels';

/**
 * *Stöd utvecklingen* i Om-rutan (0.12.5.4). Två flöden: privatpersoner ger
 * ett frivilligt bidrag med Swish (inget i utbyte), företag tecknar ett
 * supporteravtal mot faktura. Inga funktioner bakom betalning.
 *
 * Texterna är Claudes första version (Carl August 19 november: skriv den
 * och publicera, han skriver om på stället). Avsnittet visas inte om `intro`
 * är tom. Utan `swishQr` (en bild i public/, t.ex. 'swish-qr.svg') står
 * en ruta där QR-koden kommer; utan `sponsorsUrl` ingen rad om GitHub Sponsors.
 */
export const SUPPORT = {
  /** Stycket överst under rubriken. */
  intro:
    'cad-apa är fritt att använda, också i betalda uppdrag, och ska förbli det. Inga funktioner läggs bakom betalning. Sparar programmet tid och licenskostnader åt dig eller ditt kontor får du gärna hjälpa till att hålla utvecklingen igång.',
  /** Stycket för privatpersoner, bredvid QR-koden. */
  private:
    'Ett frivilligt bidrag, stort eller litet, utan något krav i gengäld. Swish är på väg; till dess får du gärna höra av dig om du vill stödja projektet.',
  /** Stycket för företag; e-postadressen läggs till efter. */
  business:
    'Använder ert kontor cad-apa kan ni teckna ett supporteravtal mot faktura, till exempel med er logotyp bland supportrarna och förtur för felrapporter. Vill ni bygga in programmet i en egen produkt eller tjänst finns kommersiella licenser.',
  /** QR-kodens fil i public/, relativt appen. Tom = platshållare. */
  swishQr: '',
  /** GitHub Sponsors, för den som inte har Swish. Tom = ingen rad. */
  sponsorsUrl: '',
};

export const SUPPORT_MAIL = 'kontakt@agrellarkitektur.se';

export function supportSectionHtml(s: typeof SUPPORT = SUPPORT): string {
  if (!s.intro.trim()) return '';
  const p = (t: string) => (t.trim() ? `<p>${escapeHtml(t)}</p>` : '');
  const qr = s.swishQr
    ? `<img class="swish-qr" src="${escapeHtml(s.swishQr)}" alt="QR-kod för Swish" width="120" height="120">`
    : `<div class="swish-qr placeholder" aria-label="QR-kod för Swish kommer">Swish-QR<br>kommer</div>`;
  const sponsors = s.sponsorsUrl
    ? `<p class="note">Utan Swish: <a href="${escapeHtml(s.sponsorsUrl)}" target="_blank" rel="noopener">GitHub Sponsors</a>.</p>`
    : '';
  return `<h3>Stöd utvecklingen</h3>
        ${p(s.intro)}
        <div class="support-private">${qr}<div><h4>Privatpersoner</h4>${p(s.private)}${sponsors}</div></div>
        <h4>Företag</h4>
        ${p(s.business)}
        <p><a href="mailto:${SUPPORT_MAIL}">${SUPPORT_MAIL}</a></p>`;
}
