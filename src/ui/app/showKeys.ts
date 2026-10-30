import type { ProjectDoc } from '../../core/model';
import { labelSorts, sortKey } from '../../elements/label';
import type { UiState } from './shell';

/**
 * Det som kan tändas och släckas under Visa, i kategorier (0.8.11). Nyckeln
 * är en objekttyp eller en del av ritningen i vyns `hide`; `demolished` är
 * vyns `hideDemolished`. Littera kan släckas per objekttyp (`littera:Wall`);
 * äldre vyer med `littera` släcker all littera.
 */
export const SHOW_GROUPS: readonly { id: string; label: string; items: readonly (readonly [key: string, label: string])[] }[] = [
  {
    id: 'model',
    label: 'Modell',
    items: [
      ['demolished', 'Det som rivs'],
      // Väggar, dörrar och fönster var för sig (0.10.15). Dörrar och fönster följer väggarna.
      ['Wall', 'Väggar'],
      ['Door', 'Dörrar'],
      ['Window', 'Fönster'],
      ['Slab', 'Bjälklag'],
      ['Roof', 'Tak'],
      ['footprint', 'Husets kontur genom taket'],
      ['roofsAround', 'Tak på andra våningar'],
      ['hiddenSlabs', 'Bjälklag streckade i fasad'],
      ['hiddenWalls', 'Ytterväggarnas insida streckad i fasad'],
      ['hiddenSlabsSection', 'Bjälklag bakom snittet streckade i sektion'],
      ['Furniture', 'Möbler och inredning'],
      ['swing', 'Öppningssätt (dörrar)'],
      ['Underlay', 'Underlag'],
    ],
  },
  {
    id: 'littera',
    label: 'Littera',
    items: [
      ['littera:Wall', 'Väggar'],
      ['littera:Door', 'Dörrar'],
      ['littera:Window', 'Fönster'],
      ['littera:Ground', 'Stödmurar (ledaren med M-littera)'],
      // Det generella littrat (0.10.20.2), och dess sorter var för sig (`showGroupsFor`).
      ['Label', 'Generell littera'],
    ],
  },
  {
    id: 'annotation',
    label: 'Rum, mått och text',
    items: [
      ['Space', 'Rum'],
      ['Dimension', 'Mått'],
      ['Text', 'Text'],
    ],
  },
  {
    id: '2d',
    label: '2D',
    items: [
      ['Shape2D', '2D-former'],
      // Bara fyllningarna (0.8.22): formerna finns kvar och går att klicka på.
      ['fill', 'Fyllningar'],
    ],
  },
  {
    // Platsen ur Höjdkurvor (0.10.3); gruppen visas när projektet har en plats, och på Platsen (0.10.25).
    id: 'site',
    label: 'Platsen',
    items: [
      ['Terrain', 'Marken (höjdkurvor och marklinjer)'],
      // Marken i 3D för sig (0.10.35), så att en kategori kan ha marken i 2D men inte i 3D, eller tvärtom.
      ['terrain3d', 'Marken i 3D-vyn'],
      ['contours3d', 'Höjdkurvor i 3D-vyn'],
      ['Ground', 'Markobjekt (konturerna)'],
      ['ground3d', 'Markobjektens linjer i 3D-vyn'],
      ['slopes3d', 'Släntmarkeringar i 3D-vyn'],
      ['steepSlopes', 'Branta slänter i den befintliga marken (gränsen under Platsen)'],
      ['SiteBuilding', 'Grannhus'],
      ['Tree', 'Träd'],
      ['SiteMap', 'Fastighetsgränser, vägar och punkter'],
      // Husets kontur på Platsen (0.10.25), heldragen utanför taken och streckad under dem.
      ['house', 'Husets kontur (på Platsen)'],
    ],
  },
  {
    id: 'markers',
    label: 'Markörer',
    items: [
      ['Elevation', 'Fasader'],
      ['BasisFacade', 'Beräkningsgrundande fasad'],
      ['Section', 'Sektioner'],
      ['North', 'Norrpil'],
      ['roofSlope', 'Taklutning i fasad och sektion'],
      ['level', 'Nivåer i fasad och sektion'],
      ['heightDims', 'Höjdmått i sektion'],
      ['buildingHeight', 'Byggnadshöjd, nock- och totalhöjd i fasad och sektion'],
    ],
  },
];

type ShowGroup = (typeof SHOW_GROUPS)[number];

/** Grupperna med det generella litterats sorter under Littera (0.10.20.2). */
export function showGroupsFor(doc: ProjectDoc): readonly ShowGroup[] {
  const sorts = labelSorts(doc);
  if (!sorts.length) return SHOW_GROUPS;
  return SHOW_GROUPS.map((g) => (g.id === 'littera' ? { ...g, items: [...g.items, ...sorts.map((s): readonly [string, string] => [sortKey(s), `– ${s}`])] } : g));
}


/**
 * Det som är släckt från början (0.10.2): det tänds med nyckeln och ett plus
 * i vyns `hide`, så att äldre vyer inte får det. Tak på andra våningar och
 * de dolda linjerna i fasader (0.10.10) likaså.
 */
export const OFF_BY_DEFAULT: ReadonlySet<string> = new Set(['footprint', 'roofsAround', 'hiddenSlabs', 'hiddenWalls', 'ground3d', 'slopes3d', 'steepSlopes']);

/** Om det som nyckeln står för syns i vyn. */
export function isShown(ui: Pick<UiState, 'hide' | 'hideDemolished'>, key: string): boolean {
  if (key === 'demolished') return !ui.hideDemolished;
  if (OFF_BY_DEFAULT.has(key)) return ui.hide.includes(`+${key}`);
  if (key.startsWith('littera:') && ui.hide.includes('littera')) return false;
  return !ui.hide.includes(key);
}

/** Tänd eller släck det som nyckeln står för. */
export function setShown(ui: Pick<UiState, 'hide' | 'hideDemolished'>, key: string, on: boolean): void {
  if (key === 'demolished') {
    ui.hideDemolished = !on;
    return;
  }
  if (OFF_BY_DEFAULT.has(key)) {
    const k = `+${key}`;
    ui.hide = on ? (ui.hide.includes(k) ? ui.hide : [...ui.hide, k]) : ui.hide.filter((h) => h !== k);
    return;
  }
  // Släckte en äldre vy all littera: dela upp den på objekttyperna först.
  if (key.startsWith('littera:') && ui.hide.includes('littera')) {
    const all = SHOW_GROUPS.find((g) => g.id === 'littera')!.items.map(([k]) => k);
    ui.hide = [...ui.hide.filter((h) => h !== 'littera'), ...all.filter((k) => !ui.hide.includes(k))];
  }
  ui.hide = on ? ui.hide.filter((h) => h !== key) : ui.hide.includes(key) ? ui.hide : [...ui.hide, key];
}
