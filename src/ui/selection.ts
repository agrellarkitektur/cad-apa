import type { Id } from '../core/model';

/** Vad som är markerat. Hör till vyn, inte till projektet, och sparas inte. */
export class Selection {
  private ids = new Set<Id>();
  private listeners = new Set<() => void>();

  get size(): number {
    return this.ids.size;
  }

  has(id: Id): boolean {
    return this.ids.has(id);
  }

  list(): Id[] {
    return [...this.ids];
  }

  set(ids: Iterable<Id>): void {
    const next = new Set(ids);
    if (next.size === this.ids.size && [...next].every((i) => this.ids.has(i))) return;
    this.ids = next;
    this.emit();
  }

  toggle(id: Id): void {
    if (this.ids.has(id)) this.ids.delete(id);
    else this.ids.add(id);
    this.emit();
  }

  add(ids: Iterable<Id>): void {
    let changed = false;
    for (const id of ids) {
      if (!this.ids.has(id)) {
        this.ids.add(id);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  clear(): void {
    if (this.ids.size === 0) return;
    this.ids.clear();
    this.emit();
  }

  /** Ta bort id:n som inte längre finns, t.ex. efter ångra. */
  prune(exists: (id: Id) => boolean): void {
    const before = this.ids.size;
    for (const id of this.ids) if (!exists(id)) this.ids.delete(id);
    if (this.ids.size !== before) this.emit();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
