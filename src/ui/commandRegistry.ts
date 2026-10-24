import type { ShapeKind } from '../elements/drawing2d';
import type { RailId } from './modify/ops';
import type { ToolId } from './app/shell';

/**
 * Kommandona (0.8.20): ett register med namn och förkortningar, både
 * AutoCADs engelska och svenska. Smartshell (kommandoraden), verktygsraden,
 * Modifiera-raden och smartmenyn använder samma register, så att ett
 * kommando heter samma sak överallt.
 *
 * Ett kommando gör en av fyra saker: väljer ett verktyg, väljer 2D-verktyget
 * med ett sätt att rita, startar ett Modifiera-verktyg för det markerade,
 * eller gör något direkt (ångra, zooma, spara …).
 */

export type CommandAction =
  | 'erase'
  | 'undo'
  | 'redo'
  | 'zoom-fit'
  | 'zoom-box'
  | 'zoom-prev'
  | 'grid'
  | 'snap'
  | 'save'
  | 'save-as'
  | 'open'
  | 'plot'
  | 'mode-2d'
  | 'mode-3d'
  | 'mode-split'
  | 'help';

export interface CommandDef {
  /** Unikt id; samma som verktygets, 2D-formens eller Modifiera-knappens när det finns ett. */
  id: string;
  /** Namnet som visas. */
  label: string;
  /** Svenska namn och förkortningar, gemener. Det första är det man ser i listan. */
  sv: string[];
  /** AutoCADs namn och förkortningar, gemener. */
  en: string[];
  tool?: ToolId;
  shape?: ShapeKind;
  rail?: RailId;
  action?: CommandAction;
  /** Kort förklaring i listan. */
  note?: string;
}

const T = (id: ToolId, label: string, sv: string[], en: string[], note?: string): CommandDef => ({ id, label, sv, en, tool: id, note });
const S = (shape: ShapeKind, label: string, sv: string[], en: string[]): CommandDef => ({ id: shape, label, sv, en, tool: 'draw2d', shape, note: '2D-form' });
const R = (rail: RailId, label: string, sv: string[], en: string[]): CommandDef => ({ id: rail, label, sv, en, rail, note: 'det markerade' });
const A = (action: CommandAction, label: string, sv: string[], en: string[], note?: string): CommandDef => ({ id: action, label, sv, en, action, note });

export const COMMANDS: CommandDef[] = [
  // Visa och rita.
  T('select', 'Markera', ['markera', 'mk'], ['select']),
  T('pan', 'Panorera', ['panorera', 'pa'], ['pan', 'p']),
  T('measure', 'Måttband', ['måttband', 'mb', 'mät'], ['dist', 'di', 'measuregeom', 'mea']),
  T('wall', 'Vägg', ['vägg', 'vg'], ['wall', 'wa']),
  T('door', 'Dörr', ['dörr', 'dö'], ['door', 'do']),
  T('window', 'Fönster', ['fönster', 'fö'], ['window', 'win']),
  T('roof', 'Tak', ['tak'], ['roof', 'rf']),
  T('room', 'Rum', ['rum'], ['room', 'space']),
  T('dimension', 'Mått', ['mått', 'må'], ['dim', 'dli', 'dimlinear']),
  T('text', 'Text', ['text', 'tx'], ['mtext', 'mt', 't', 'dtext', 'dt']),
  T('draw2d', '2D-form', ['2d', '2dform'], ['draw'], 'med det sätt att rita som är valt'),
  S('line', 'Linje', ['linje', 'li'], ['line', 'l']),
  S('polyline', 'Polylinje', ['polylinje', 'pl'], ['pline', 'polyline']),
  S('rect', 'Rektangel', ['rektangel', 'rek'], ['rectang', 'rectangle', 'rec']),
  S('circle', 'Cirkel', ['cirkel', 'ci'], ['circle', 'c']),
  S('arc', 'Båge', ['båge', 'bå'], ['arc', 'a']),
  S('spline', 'Spline', ['spline', 'kurva'], ['spl']),
  T('section', 'Sektion', ['sektion', 'sek'], ['section', 'sec']),
  T('elevation', 'Fasad', ['fasad', 'fas'], ['elevation', 'elev']),
  // Modifiera det markerade.
  R('move', 'Flytta', ['flytta', 'fl'], ['move', 'm']),
  R('rotate', 'Vrid', ['vrid', 'vr'], ['rotate', 'ro']),
  R('mirror', 'Spegla', ['spegla', 'sp'], ['mirror', 'mi']),
  R('multiply', 'Kopiera i rad', ['kopiera', 'kop', 'irad'], ['copy', 'co', 'cp', 'array', 'ar']),
  R('offset', 'Förskjut', ['förskjut', 'fs'], ['offset', 'o']),
  R('parallel', 'Parallell kopia', ['parallell', 'par'], ['parallel']),
  R('offsetAll', 'Förskjut alla kanter', ['allakanter', 'ak'], ['offsetall']),
  R('wallOn', 'Ny vägg härifrån', ['nyvägg', 'nv'], ['wallon']),
  R('stretch', 'Sträck', ['sträck', 'stc'], ['stretch', 's']),
  R('extend', 'Förläng till', ['förläng', 'fg'], ['extend', 'ex']),
  R('trim', 'Trimma', ['trimma', 'tri'], ['trim', 'tr']),
  R('join', 'Hörnskarv', ['hörnskarv', 'hs'], ['corner', 'jn']),
  R('split', 'Dela', ['dela', 'de'], ['break', 'br']),
  R('insert', 'Lägg till punkt', ['nypunkt', 'np'], ['addvertex', 'av']),
  R('pointMove', 'Flytta punkt', ['flyttapunkt', 'fp'], ['movevertex', 'mv']),
  R('remove', 'Ta bort punkt', ['tabortpunkt', 'tp'], ['removevertex', 'rv']),
  R('curve', 'Böj', ['böj'], ['bend', 'be']),
  R('tangent', 'Båge med tangent', ['tangent', 'tg'], ['tangentarc', 'ta']),
  R('straighten', 'Räta ut', ['rätaut', 'rä'], ['straighten', 'st']),
  R('fillet', 'Avrunda hörn', ['avrunda', 'avr'], ['fillet', 'f']),
  R('chamfer', 'Fasa hörn', ['fasa', 'fa'], ['chamfer', 'cha']),
  R('align', 'Justera och fördela', ['justera', 'jus'], ['align', 'al']),
  R('pick', 'Hämta och överför', ['pipett', 'hämta'], ['matchprop', 'ma']),
  R('scale', 'Skala', ['skala', 'sk'], ['scale', 'sc']),
  // Direkt.
  A('erase', 'Ta bort', ['tabort', 'radera', 'tb'], ['erase', 'e', 'delete', 'del'], 'det markerade'),
  A('undo', 'Ångra', ['ångra', 'ån'], ['undo', 'u']),
  A('redo', 'Gör om', ['görom', 'go'], ['redo', 're']),
  A('zoom-fit', 'Zooma till allt', ['allt', 'zoomallt'], ['zoomextents', 'ze', 'za']),
  A('zoom-box', 'Zooma till område', ['zooma', 'zo'], ['zoom', 'z']),
  A('zoom-prev', 'Förra zoomen', ['förrazoomen', 'fz'], ['zoomprevious', 'zp']),
  A('grid', 'Rutnät av/på', ['rutnät', 'rn'], ['grid', 'gr']),
  A('snap', 'Snäpp av/på', ['snäpp', 'sn'], ['snap', 'osnap', 'os']),
  A('save', 'Spara', ['spara'], ['save', 'qsave']),
  A('save-as', 'Spara som', ['sparasom'], ['saveas']),
  A('open', 'Öppna fil', ['öppna'], ['open']),
  A('plot', 'Plot/export', ['plotta', 'exportera'], ['plot', 'export']),
  A('mode-2d', 'Plan', ['plan'], ['2dview']),
  A('mode-3d', '3D', ['3d'], ['3dview']),
  A('mode-split', 'Plan och 3D', ['båda'], ['split']),
  A('help', 'Alla kommandon', ['hjälp', '?'], ['help']),
];

/** Gemener, utan mellanslag och bindestreck: "Ta bort" och "ta-bort" blir "tabort". */
export function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[\s-]+/g, '');
}

const BY_NAME = new Map<string, CommandDef>();
for (const c of COMMANDS) for (const n of [...c.sv, ...c.en]) BY_NAME.set(n, c);

/** Kommandot med precis det namnet eller den förkortningen. */
export function findCommand(text: string): CommandDef | undefined {
  return BY_NAME.get(norm(text));
}

export function commandById(id: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.id === id);
}

/** Kommandot för ett verktyg, en 2D-form eller en Modifiera-knapp. */
export function commandFor(what: { tool?: ToolId; shape?: ShapeKind; rail?: RailId }): CommandDef | undefined {
  if (what.shape) return COMMANDS.find((c) => c.shape === what.shape);
  if (what.rail) return COMMANDS.find((c) => c.rail === what.rail);
  return COMMANDS.find((c) => c.tool === what.tool && !c.shape);
}

/** Förkortningarna att visa i en knapps hjälptext: "L, LI". De korta först, högst fyra. */
export function aliasText(c: CommandDef): string {
  const all = [...new Set([...c.en, ...c.sv])].filter((n) => n.length <= 4).sort((a, b) => a.length - b.length);
  return all
    .slice(0, 4)
    .map((n) => n.toUpperCase())
    .join(', ');
}

export interface Match {
  cmd: CommandDef;
  /** Namnet som passade. */
  name: string;
  exact: boolean;
}

/**
 * Kommandon som passar det man skrivit, bäst först: först det som heter
 * precis så, sedan namn som börjar så (kortast först), sist namn och
 * etiketter som innehåller det. Varje kommando en gång.
 */
export function complete(text: string, max = 8): Match[] {
  const q = norm(text);
  if (!q) return [];
  const scored: { m: Match; score: number }[] = [];
  for (const c of COMMANDS) {
    let best: { name: string; score: number; exact: boolean } | null = null;
    const names = [...c.sv, ...c.en];
    for (let i = 0; i < names.length; i++) {
      const n = names[i];
      let score = -1;
      if (n === q) score = 1000;
      else if (n.startsWith(q)) score = 500 - n.length - (i >= c.sv.length ? 0.5 : 0);
      else if (n.includes(q)) score = 100 - n.length;
      if (score >= 0 && (!best || score > best.score)) best = { name: n, score, exact: score === 1000 };
    }
    const label = norm(c.label);
    if (!best && label.includes(q)) best = { name: c.sv[0], score: label.startsWith(q) ? 300 - label.length : 50, exact: false };
    if (best) scored.push({ m: { cmd: c, name: best.name, exact: best.exact }, score: best.score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.m);
}
