// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { escapeHtml } from '../labels';

/**
 * *Stöd utvecklingen* i Om-rutan (0.12.5.4). Två flöden: privatpersoner ger
 * ett frivilligt bidrag med Swish (inget i utbyte), företag tecknar ett
 * supporteravtal mot faktura. Inga funktioner bakom betalning.
 *
 * Texterna skriver Carl August själv. Avsnittet visas inte förrän `intro`
 * är ifylld. Utan `swishQr` (en bild i public/, t.ex. 'swish-qr.svg') står
 * en ruta där QR-koden kommer; utan `sponsorsUrl` ingen rad om GitHub Sponsors.
 */
export const SUPPORT = {
  /** Stycket överst under rubriken. */
  intro: '',
  /** Stycket för privatpersoner, bredvid QR-koden. */
  private: '',
  /** Stycket för företag; e-postadressen läggs till efter. */
  business: '',
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
