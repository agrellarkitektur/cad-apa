import type { ViewDef } from '../../core/model';
import type { ViewStates } from '../../core/states';
import type { DocStore } from '../../core/store';
import type { PlanResult } from '../../repr/plan';
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
  readonly view3d: View3D | null;

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

  copySelection(data: DataTransfer | null): boolean;
  pasteFromMenu(): Promise<void>;
}
