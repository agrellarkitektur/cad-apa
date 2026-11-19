import { describe, expect, it } from 'vitest';
import { moveFiles, showsMoveNotice } from '../src/ui/app/moveNotice';

describe('0.12.5.3 flytten: spara det som finns i webbläsaren', () => {
  it('visas bara på den gamla adressen eller med ?flytt', () => {
    expect(showsMoveNotice({ hostname: 'agrellarkitektur.se', search: '' })).toBe(true);
    expect(showsMoveNotice({ hostname: 'www.agrellarkitektur.se', search: '' })).toBe(true);
    expect(showsMoveNotice({ hostname: 'cad-apa.danaid.cloud', search: '' })).toBe(false);
    expect(showsMoveNotice({ hostname: 'localhost', search: '?flytt' })).toBe(true);
  });

  it('projektet först med sitt namn, sedan mallen och det som inte gick att läsa', () => {
    const files = moveFiles(
      [
        { key: 'stilboksmall', value: { text: '{}', name: 'Kontoret', savedAt: 1 } },
        { key: 'unreadable-1763510400000', value: { text: 'trasigt', savedAt: 1763510400000 } },
        { key: 'current', value: { text: JSON.stringify({ project: { name: 'Villa/Ek' } }), savedAt: 2 } },
        { key: 'annat', value: 42 },
      ],
      'cadapa',
    );
    expect(files.map((f) => f.name)).toEqual(['VillaEk.cadapa', 'Mall Kontoret.json', expect.stringMatching(/^Autospar som inte gick att läsa 2025-11-1\d\.cadapa$/)]);
    expect(files[1].text).toBe('{}');
  });

  it('inget sparat ger inga filer', () => {
    expect(moveFiles([], 'cadapa')).toEqual([]);
  });
});
