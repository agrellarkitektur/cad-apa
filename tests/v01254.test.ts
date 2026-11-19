// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { describe, expect, it } from 'vitest';
import { SOURCE_REPO, sourceFileUrl, sourceUrl } from '../src/ui/app/sourceLink';
import { SUPPORT, supportSectionHtml } from '../src/ui/app/supportSection';

// 0.12.5.4: AGPL-3.0, länken till källkoden och Stöd utvecklingen.
describe('0.12.5.4 licensen', () => {
  it('länken till källkoden pekar på commiten bygget gjordes från', () => {
    expect(sourceUrl('426940f0123456789abcdef0123456789abcdef0')).toBe(`${SOURCE_REPO}/tree/426940f0123456789abcdef0123456789abcdef0`);
    expect(sourceUrl('')).toBe(SOURCE_REPO);
    expect(sourceUrl('inte-en-commit')).toBe(SOURCE_REPO);
    expect(sourceFileUrl('LICENSE', '')).toBe(`${SOURCE_REPO}/blob/main/LICENSE`);
    expect(sourceFileUrl('THIRD-PARTY.md', 'abc1234')).toBe(`${SOURCE_REPO}/blob/abc1234/THIRD-PARTY.md`);
  });

  it('Stöd utvecklingen syns först när texten finns, med platshållare för QR-koden', () => {
    expect(supportSectionHtml({ ...SUPPORT, intro: '' })).toBe('');
    const html = supportSectionHtml({ ...SUPPORT, intro: 'Tack', private: 'Swisha', business: 'Avtal' });
    expect(html).toContain('Stöd utvecklingen');
    expect(html).toContain('swish-qr placeholder');
    expect(html).toContain('mailto:kontakt@agrellarkitektur.se');
    expect(html).not.toContain('GitHub Sponsors');
    const withQr = supportSectionHtml({ ...SUPPORT, intro: 'Tack', swishQr: 'swish-qr.svg', sponsorsUrl: 'https://github.com/sponsors/x' });
    expect(withQr).toContain('src="swish-qr.svg"');
    expect(withQr).toContain('GitHub Sponsors');
  });
});
