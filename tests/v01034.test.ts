import { describe, expect, it } from 'vitest';
import { newStyleBook, normalizeBook, normalizeColorSets } from '../src/core/graphics';
import { hexToHsv, hsvToHex } from '../src/ui/style/colors';
import { lineTypeOptions } from '../src/ui/lineTypePick';

/** 0.10.34 Radkontrollerna: färgpanelens omräkning, favoritseten och linjetypernas symboler. */
describe('0.10.34 Radkontrollerna', () => {
  it('färgen går fram och tillbaka mellan hexkod och färgfältets läge', () => {
    for (const hex of ['#000000', '#ffffff', '#8c8c8c', '#c2372c', '#b88400', '#1f4fa3', '#6f7d5a']) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    expect(hexToHsv('#ff0000')).toEqual([0, 1, 1]);
    expect(hsvToHex([120, 1, 1])).toBe('#00ff00');
  });

  it('favoritseten läses från fil och följer med stilboken', () => {
    expect(normalizeColorSets([{ name: ' Bygglov ', colors: ['#6F7D5A', 'röd', '#6f7d5a', '#cfc5ae'] }, { name: '', colors: [] }, null])).toEqual([{ name: 'Bygglov', colors: ['#6f7d5a', '#cfc5ae'] }]);
    expect(normalizeColorSets([])).toBeNull();
    const book = { ...newStyleBook(), colorSets: [{ name: 'Bygglov', colors: ['#6f7d5a'] }] };
    const read = normalizeBook(JSON.parse(JSON.stringify(book)));
    expect(read.colorSets).toEqual([{ name: 'Bygglov', colors: ['#6f7d5a'] }]);
    expect('colorSets' in normalizeBook(JSON.parse(JSON.stringify(newStyleBook())))).toBe(false);
  });

  it('linjetypernas val har mönstret, så att knappen kan visa symbolen', () => {
    const html = lineTypeOptions({ ...newStyleBook(), lineTypes: [{ id: 'egen', name: 'Egen', dash: [4, 1, 1, 1] }] }, 'egen');
    expect(html).toContain('value="solid" data-dash=""');
    expect(html).toContain('value="egen" data-dash="4 1 1 1" selected');
  });
});
