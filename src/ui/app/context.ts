import type { ViewDef } from '../../core/model';
import type { ViewStates } from '../../core/states';
import type { DocStore } from '../../core/store';
import type { PlanResult } from '../../repr/plan';
import type { SectionResult } from '../../repr/section';
import type { PlanView } from '../../view2d/planView';
import type { View3D } from '../../view3d/view3d';
import type { ContextMenu } from '../contextMenu';
import type { MeasureBox } from '../measureBox';
import type { ModifyPalette } from '../modify';
import type { Navigator } from '../navigator';
import type { NewProjectDialog } from '../newProjectDialog';
import type { PetPalette } from '../petPalette';
import type { PropertiesPanel } from '../propertiesPanel';
import type { Selection } from '../selection';
import type { SettingsDialog } from '../settingsDialog';
import type { StyleDialog } from '../styleDialog';
import type { Draw2DTool } from '../tools/draw2dTool';
import type { DimensionTool, TextTool } from '../tools/annotationTools';
import type { MarkerTool, RoofTool } from '../tools/markerTools';
import type { MeasureTool } from '../tools/measureTool';
import type { OpeningTool } from '../tools/openingTool';
import type { RoomTool } from '../tools/roomTool';
import type { SelectTool } from '../tools/selectTool';
import type { WallTool } from '../tools/wallTool';
import type { ToolHost } from '../tools/host';
import type { UiSettings } from '../uiSettings';
import type { ToolId, UiState, ViewMode } from './shell';
import type { Place } from './views';

/**
 * Det som delarna av appen (src/ui/app/*.ts) behöver av varandra. Objektet
 * byggs i `mountApp` med getters, så att det som skapas senare eller byts ut
 * (planen, 3D-vyn) alltid läses som det är just då. Hämta därför alltid
 * genom `app.x` när det används, inte en gång när delen installeras.
 */
export interface AppContext {
  readonly root: HTMLElement;
  $<T extends Element>(sel: string): T;
  out(name: string): HTMLElement;
  readonly appEl: HTMLElement;
  readonly menu: HTMLElement;
  readonly toolOptions: HTMLElement;
  readonly pane2d: HTMLElement;
  readonly pane3d: HTMLElement;

  readonly store: DocStore;
  readonly selection: Selection;
  readonly ui: UiState;
  readonly uiSettings: UiSettings;
  readonly view: PlanView;
  /** Det som ritas just nu, med det som går att klicka på. */
  readonly plan: PlanResult;
  /** Den öppna fasaden eller sektionen, senast den räknades. */
  readonly section: SectionResult | null;
  readonly view3d: View3D | null;
  /** Det verktygen får av appen (snäpp, ytan, markeringen …). */
  readonly host: ToolHost;

  readonly selectTool: SelectTool;
  readonly wallTool: WallTool;
  readonly doorTool: OpeningTool;
  readonly windowTool: OpeningTool;
  readonly roomTool: RoomTool;
  readonly dimensionTool: DimensionTool;
  readonly textTool: TextTool;
  readonly draw2dTool: Draw2DTool;
  readonly measureTool: MeasureTool;
  readonly roofTool: RoofTool;
  readonly sectionTool: MarkerTool;
  readonly elevationTool: MarkerTool;
  /** Rikta efter objekt eller Zooma till område pågår. */
  readonly aligning: boolean;
  readonly zoomingBox: boolean;

  readonly panel: PropertiesPanel;
  readonly palette: PetPalette;
  readonly modifyPalette: ModifyPalette;
  readonly navigator: Navigator;
  readonly measureBox: MeasureBox;
  readonly newProjectDialog: NewProjectDialog;
  readonly settingsDialog: SettingsDialog;
  readonly styleDialog: StyleDialog;
  readonly ctxMenu: ContextMenu;

  hint(text: string, ms?: number): void;
  renderAll(): void;
  viewStates(): ViewStates;
  setTool(id: ToolId): void;
  setMode(mode: ViewMode): Promise<void>;
  setPanel(open: boolean, sheet?: 'peek' | 'full'): void;
  setNav(open: boolean): void;
  togglePanel(): void;
  toggleNav(): void;
  toggleGrid(): void;
  closeMenu(): void;
  closeShowMenu(): void;
  cancelCommand(): void;
  endAlign(): void;
  startZoomBox(): void;
  endZoomBox(): void;
  previousZoom(): void;
  zoomToSelection(): void;
  /** Flytta måttrutan till sin punkt i planen eller i 3D. */
  positionMeasureBox(): void;
  roofOverHouse(): void;
  screenMm(): number;
  saveNow(as: boolean): Promise<void>;
  openFile(): Promise<void>;

  applyView(v: ViewDef): void;
  currentViewDef(id: string, name: string): ViewDef;
  viewModified(v: ViewDef): boolean;
  goTo(p: Place): void;
  openHistoryMenu(x: number, y: number): void;
  openMarkerMenu(id: string, x: number, y: number): void;
  openViewMenu(id: string, x: number, y: number): void;

  /** Underlag (0.8 del 2): välj filer, kalibrera eller rikta, menyn i projektträdet. */
  chooseUnderlayFiles(): void;
  startUnderlayTool(id: string, mode: 'calibrate' | 'align'): void;
  openUnderlayMenu(id: string, x: number, y: number): void;
  /** Visa ett underlag: gå dit det ligger, markera och zooma till det. */
  showUnderlay(id: string): void;

  copySelection(data: DataTransfer | null): boolean;
  pasteFromMenu(): Promise<void>;
}

/**
 * Bygg ett objekt där varje fält läses genom sin funktion när det används
 * (0.8.1). Det ersätter en lång rad getters i `mountApp`.
 */
export function lazyContext<T extends object>(fields: { [K in keyof T]: () => T[K] }): T {
  const o = {} as T;
  for (const k of Object.keys(fields) as (keyof T)[]) Object.defineProperty(o, k, { get: fields[k], enumerable: true });
  return o;
}
