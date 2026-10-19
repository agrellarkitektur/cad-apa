import type { Asset, Definition, Element, Id, ProjectDoc, State, Storey, ViewDef } from './model';

/**
 * Alla ändringar i ett projekt går genom DocStore som transaktioner. En
 * transaktion är en lista ändringar där varje ändring sparar värdet före och
 * efter, så att den kan ångras och göras om exakt.
 *
 * Nya objekttyper behöver inget eget ångra-stöd: allt som ligger i någon av
 * samlingarna nedan får det automatiskt.
 */

type Collections = {
  elements: Element;
  definitions: Definition;
  /** Underlagens filer (format 5). Egen samling, så att ångra inte kopierar alla filer vid varje ändring. */
  assets: Asset;
};

type ListCollections = {
  states: State;
  storeys: Storey;
  views: ViewDef;
};

export type Change =
  | { [K in keyof Collections]: { kind: 'record'; collection: K; id: Id; before?: Collections[K]; after?: Collections[K] } }[keyof Collections]
  | { [K in keyof ListCollections]: { kind: 'list'; collection: K; before: ListCollections[K][]; after: ListCollections[K][] } }[keyof ListCollections]
  | { [K in FieldKey]: { kind: 'field'; key: K; before: ProjectDoc[K]; after: ProjectDoc[K] } }[FieldKey];

/** Fält på projektnivå som byts ut i sin helhet. */
export type FieldKey = 'project' | 'graphics' | 'folders' | 'tree' | 'viewTags' | 'worksheets' | 'sheets';

export interface Transaction {
  /** Visas i gränssnittet, t.ex. "Ångra: Riv vägg". */
  label: string;
  changes: Change[];
}

export interface StoreEvent {
  /** Vad som hände: en ny transaktion, ångra, gör om eller att ett nytt dokument laddades. */
  cause: 'commit' | 'undo' | 'redo' | 'load';
  transaction?: Transaction;
}

export type Listener = (doc: ProjectDoc, event: StoreEvent) => void;

const MAX_HISTORY = 200;

export class DocStore {
  private current: ProjectDoc;
  private undoStack: Transaction[] = [];
  private redoStack: Transaction[] = [];
  private listeners = new Set<Listener>();

  constructor(doc: ProjectDoc) {
    this.current = doc;
  }

  get doc(): ProjectDoc {
    return this.current;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoLabel(): string | undefined {
    return this.undoStack.at(-1)?.label;
  }

  get redoLabel(): string | undefined {
    return this.redoStack.at(-1)?.label;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Ersätt hela dokumentet, t.ex. när en fil öppnas. Historiken töms. */
  load(doc: ProjectDoc): void {
    this.current = doc;
    this.undoStack = [];
    this.redoStack = [];
    this.emit({ cause: 'load' });
  }

  /**
   * Bygg en transaktion med en editor och genomför den. Editorn får läsa
   * dokumentet och registrera ändringar; inget skrivs förrän den är klar.
   */
  transact(label: string, build: (tx: TxBuilder) => void, opts: { merge?: boolean } = {}): Transaction | null {
    const tx = new TxBuilder(this.current);
    build(tx);
    if (tx.changes.length === 0) return null;
    this.current = applyChanges(this.current, tx.changes, 'forward');
    // En följdändring (t.ex. att väggar vänds när de ritats klart) läggs till
    // föregående steg, så att allt ångras på en gång.
    const last = this.undoStack.at(-1);
    if (opts.merge && last) {
      last.changes.push(...tx.changes);
      this.redoStack = [];
      this.emit({ cause: 'commit', transaction: last });
      return last;
    }
    const t: Transaction = { label, changes: tx.changes };
    this.undoStack.push(t);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.emit({ cause: 'commit', transaction: t });
    return t;
  }

  undo(): void {
    const t = this.undoStack.pop();
    if (!t) return;
    this.current = applyChanges(this.current, t.changes, 'backward');
    this.redoStack.push(t);
    this.emit({ cause: 'undo', transaction: t });
  }

  redo(): void {
    const t = this.redoStack.pop();
    if (!t) return;
    this.current = applyChanges(this.current, t.changes, 'forward');
    this.undoStack.push(t);
    this.emit({ cause: 'redo', transaction: t });
  }

  private emit(event: StoreEvent): void {
    for (const fn of this.listeners) fn(this.current, event);
  }
}

/**
 * Samlar ändringar inom en transaktion. Läsningar ser de ändringar som
 * redan registrerats, så att flera steg kan bygga på varandra.
 */
export class TxBuilder {
  readonly changes: Change[] = [];
  private working: ProjectDoc;

  constructor(doc: ProjectDoc) {
    this.working = doc;
  }

  get doc(): ProjectDoc {
    return this.working;
  }

  putElement(el: Element): void {
    this.record({ kind: 'record', collection: 'elements', id: el.id, before: this.working.elements[el.id], after: clone(el) });
  }

  removeElement(id: Id): void {
    const before = this.working.elements[id];
    if (before) this.record({ kind: 'record', collection: 'elements', id, before, after: undefined });
  }

  putDefinition(def: Definition): void {
    this.record({ kind: 'record', collection: 'definitions', id: def.id, before: this.working.definitions[def.id], after: clone(def) });
  }

  removeDefinition(id: Id): void {
    const before = this.working.definitions[id];
    if (before) this.record({ kind: 'record', collection: 'definitions', id, before, after: undefined });
  }

  setStates(states: State[]): void {
    this.record({ kind: 'list', collection: 'states', before: this.working.states, after: clone(states) });
  }

  setStoreys(storeys: Storey[]): void {
    this.record({ kind: 'list', collection: 'storeys', before: this.working.storeys, after: clone(storeys) });
  }

  setViews(views: ViewDef[]): void {
    this.record({ kind: 'list', collection: 'views', before: this.working.views, after: clone(views) });
  }

  setProject(project: ProjectDoc['project']): void {
    this.record({ kind: 'field', key: 'project', before: this.working.project, after: clone(project) });
  }

  setGraphics(graphics: ProjectDoc['graphics']): void {
    this.record({ kind: 'field', key: 'graphics', before: this.working.graphics, after: clone(graphics) });
  }

  /** Byt ut ett fält på projektnivå: mappar, trädet, vy-taggar, arbetsblad eller blad (format 5). */
  setField<K extends FieldKey>(key: K, value: ProjectDoc[K]): void {
    this.record({ kind: 'field', key, before: this.working[key], after: clone(value) } as Change);
  }

  putAsset(asset: Asset): void {
    this.record({ kind: 'record', collection: 'assets', id: asset.id, before: this.working.assets[asset.id], after: clone(asset) });
  }

  removeAsset(id: Id): void {
    const before = this.working.assets[id];
    if (before) this.record({ kind: 'record', collection: 'assets', id, before, after: undefined });
  }

  private record(change: Change): void {
    this.changes.push(change);
    this.working = applyChanges(this.working, [change], 'forward');
  }
}

/**
 * Tillämpa ändringar och returnera ett nytt dokument. Det gamla lämnas
 * orört, så vyer kan jämföra före och efter och historiken förblir säker.
 */
export function applyChanges(doc: ProjectDoc, changes: readonly Change[], direction: 'forward' | 'backward'): ProjectDoc {
  const list = direction === 'forward' ? changes : [...changes].reverse();
  let next: ProjectDoc = { ...doc };
  let elementsCopied = false;
  let definitionsCopied = false;
  let assetsCopied = false;

  for (const c of list) {
    const value = direction === 'forward' ? afterOf(c) : beforeOf(c);
    switch (c.kind) {
      case 'record': {
        if (c.collection === 'elements') {
          if (!elementsCopied) {
            next.elements = { ...next.elements };
            elementsCopied = true;
          }
          if (value) next.elements[c.id] = value as Element;
          else delete next.elements[c.id];
        } else if (c.collection === 'assets') {
          if (!assetsCopied) {
            next.assets = { ...next.assets };
            assetsCopied = true;
          }
          if (value) next.assets[c.id] = value as Asset;
          else delete next.assets[c.id];
        } else {
          if (!definitionsCopied) {
            next.definitions = { ...next.definitions };
            definitionsCopied = true;
          }
          if (value) next.definitions[c.id] = value as Definition;
          else delete next.definitions[c.id];
        }
        break;
      }
      case 'list':
        next = { ...next, [c.collection]: value };
        break;
      case 'field':
        next = { ...next, [c.key]: value };
        break;
    }
  }
  return next;
}

function afterOf(c: Change): unknown {
  return c.after;
}

function beforeOf(c: Change): unknown {
  return c.before;
}

function clone<T>(v: T): T {
  return structuredClone(v);
}
