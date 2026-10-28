import { escapeHtml, labelOf } from '../labels';
import { OPS, opsFor, RAIL_ITEMS, railOf, type ModifyContext, type ModifyHost, type OpId, type RailId } from './ops';
import { ALIGN_BUTTONS, ArrangeTool, type AlignKind } from './arrangeTool';
import { icons } from '../icons';
import { crestSuggestion, ModifyTool, runInstant } from './tool';
import { easeSuggestion, levelSuggestion } from './rampOps';

/**
 * Det som pågår i Modifiera (0.8.5): vad valen gäller (det markerade, eller
 * änden, hörnet eller kanten man klickat på), vilket val som körs och
 * värdet som skrivits in. Smartmenyn, Modifiera-raden och verktygsraden
 * under ritytan visar samma läge och anropar samma metoder.
 */
export class Modifier {
  private host: ModifyHost;
  /** Vad valen gäller nu, eller null när inget är markerat. */
  ctx: ModifyContext | null = null;
  /** Det markerade som helhet: dit går man tillbaka när ett val är klart. */
  private body: ModifyContext | null = null;
  active: OpId | null = null;
  private tool: ModifyTool | ArrangeTool | null = null;
  /** Modifiera-raden väntar på ett klick på en ände, ett hörn eller en kant. */
  picking: RailId | null = null;
  /** Senaste värdet per val, så att man slipper skriva samma radie igen. */
  private remembered = new Map<OpId, number>();
  /**
   * Knappen i raden som senast användes på en kant i en linje eller kontur
   * (0.10.17): ett klick mitt på en kant startar den igen.
   */
  private lastEdge: RailId | null = null;
  /** Förskjut (0.10.17): hur många kanter, kvar till nästa gång; 0 = alla. */
  edges = 1;
  private listeners = new Set<() => void>();

  constructor(host: ModifyHost) {
    this.host = host;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  get running(): boolean {
    return !!this.tool;
  }

  /** Verktyget som kör valet just nu (för smartshell, 0.8.21). */
  get runningTool(): ModifyTool | ArrangeTool | null {
    return this.tool;
  }

  /** Ett val körs, Ny vägg pågår eller raden väntar på ett klick: Esc avbryter först det. */
  get busy(): boolean {
    return !!this.active || !!this.picking;
  }

  /** Ny vägg härifrån pågår. */
  get drawingWall(): boolean {
    return this.active === 'wallOn';
  }

  /** Valen för det som gäller nu, i grupper. */
  groups(): OpId[][] {
    return this.ctx ? opsFor(this.host, this.ctx) : [];
  }

  /** Nytt markerat (eller inget): det som pågår avbryts. */
  setSelection(body: ModifyContext | null): void {
    this.abort();
    this.picking = null;
    this.body = body;
    this.ctx = body;
    this.changed();
  }

  /**
   * Ett klick på det markerade: valen byts till det som gäller där. Väntar
   * Modifiera-raden på just det klicket startar dess verktyg; annars börjar
   * `start` direkt (Ny vägg vid en ände, 0.8.4).
   */
  setPart(ctx: ModifyContext, start?: OpId): void {
    this.abort();
    if (ctx.kind === 'body') this.body = ctx;
    this.ctx = ctx;
    const avail = opsFor(this.host, ctx).flat();
    if (this.picking) {
      const want = RAIL_ITEMS.find((r) => r.id === this.picking)!;
      const op = want.ops.find((o) => avail.includes(o));
      if (op) {
        this.picking = null;
        this.choose(op);
        return;
      }
      this.host.hint(want.ask ?? 'Klicka på det som ska ändras.', 3500);
      this.changed();
      return;
    }
    if (start && avail.includes(start)) {
      this.choose(start);
      return;
    }
    // Ett klick mitt på en kant i en 2D-form, ett takfall, en håltagning eller
    // ett markobjekt startar det som senast användes på en kant (0.10.17).
    const again = this.lastEdge && isLineEdge(ctx) ? RAIL_ITEMS.find((r) => r.id === this.lastEdge)?.ops.find((o) => avail.includes(o)) : undefined;
    if (again) this.choose(again);
    else this.changed();
  }

  /** Ett val i smartmenyn. */
  choose(op: OpId): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.abort();
    this.picking = null;
    // Förläng rampen (0.10.18): verktyget Mark ritar vidare från änden.
    if (op === 'pathExtend') {
      this.host.startRampFrom?.(ctx);
      this.finish();
      return;
    }
    if (op === 'wallOn') {
      this.active = this.host.startWallFrom?.(ctx) ? 'wallOn' : null;
      this.changed();
      return;
    }
    const def = OPS[op];
    // Val som utförs direkt (Räta ut …) startas inte av sig själva.
    if (isLineEdge(ctx) && !def.instant) this.lastEdge = railOf(op)?.id ?? this.lastEdge;
    if (def.instant) {
      runInstant(this.host, op, ctx);
      this.finish();
      return;
    }
    this.active = op;
    const Tool = ArrangeTool.handles(op) ? ArrangeTool : ModifyTool;
    // Höjdpunkten (0.10.13) föreslår krönets höjd där man klickade.
    const start =
      op === 'crestPoint'
        ? (crestSuggestion(this.host, ctx)?.value ?? 0)
        : op === 'pathLevel'
          ? (levelSuggestion(this.host, ctx)?.value ?? 0)
          : op === 'pathEase'
            ? easeSuggestion(this.host, ctx)
            : (this.remembered.get(op) ?? def.value?.initial ?? 0);
    this.tool = new Tool(this.host, op, ctx, start, () => this.finish(), () => this.changed());
    if (this.tool instanceof ModifyTool) this.tool.edges = this.edges;
    this.host.startModify(this.tool);
    this.changed();
  }

  /**
   * En knapp i Modifiera-raden. Har man redan klickat på en ände, ett hörn
   * eller en kant där verktyget går att använda, används det. Verktyg för
   * det markerade som helhet börjar direkt. Annars ber raden om ett klick.
   */
  chooseRail(id: RailId): void {
    const def = RAIL_ITEMS.find((r) => r.id === id);
    if (!def || !this.body) return;
    if (this.picking === id || def.ops.includes(this.active as OpId)) {
      this.cancel();
      return;
    }
    const here = this.ctx ? opsFor(this.host, this.ctx).flat() : [];
    let op = def.ops.find((o) => here.includes(o));
    if (!op && this.ctx !== this.body) {
      const whole = opsFor(this.host, this.body).flat();
      op = def.ops.find((o) => whole.includes(o));
      if (op) this.ctx = this.body;
    }
    if (op) {
      this.choose(op);
      return;
    }
    this.abort();
    this.ctx = this.body;
    // Tipset står i smartmenyn eller i verktygsraden under ritytan.
    this.picking = id;
    this.changed();
  }

  /**
   * Flytta i höjd med ett värde direkt (0.10.14), från kommandoraden
   * (`M Z -500`, `FZ -500`, eller `Z -500` medan Flytta pågår). Falskt när
   * det markerade inte kan flyttas i höjd.
   */
  moveZ(v: number): boolean {
    if (!this.body || !opsFor(this.host, this.body).flat().includes('moveZ')) return false;
    this.abort();
    this.ctx = this.body;
    this.choose('moveZ');
    this.applyValue(v);
    return true;
  }

  /** Avbryt det som pågår, men behåll det markerade. */
  cancel(): void {
    this.abort();
    this.picking = null;
    this.changed();
  }

  /** Ny vägg härifrån: menyn släpper väggen, som fortsätter av sig själv. */
  release(): void {
    this.active = null;
    this.tool = null;
    this.changed();
  }

  setValue(v: number): void {
    this.tool?.setValue(v);
  }

  /** Antalet kanter för Förskjut (0.10.17); 0 = alla. */
  setEdges(n: number): void {
    this.edges = n;
    if (this.tool instanceof ModifyTool) this.tool.setEdges(n);
  }

  applyValue(v: number): void {
    if (!this.active || !this.tool) return;
    this.remembered.set(this.active, v);
    this.tool.applyValue(v);
  }

  /** Valet är utfört: tillbaka till det markerade som helhet. */
  private finish(): void {
    const was = !!this.tool;
    this.active = null;
    this.tool = null;
    this.ctx = this.body;
    if (was) this.host.endModify();
    this.changed();
  }

  private abort(): void {
    const was = !!this.tool;
    const wall = this.active === 'wallOn';
    this.active = null;
    this.tool = null;
    if (was) this.host.endModify();
    if (wall) this.host.stopWall?.();
  }

  /** Den knapp i raden som är intryckt. */
  get railActive(): RailId | null {
    return this.picking ?? (this.active ? (railOf(this.active)?.id ?? null) : null);
  }

  /** Vad valen gäller, i ord: "Änden · Vägg 3". */
  where(): { where: string; what: string } | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const doc = this.host.store.doc;
    const where = ctx.shapeId
      ? ctx.hole !== undefined
        ? doc.elements[ctx.shapeId]?.type === 'Ground'
          ? `${ctx.hole === 0 ? 'Vänster' : 'Höger'} sida, ${ctx.kind === 'edge' ? 'kanten' : 'punkten'}`
          : ctx.kind === 'edge'
            ? `Hål ${ctx.hole + 1}, kanten`
            : `Hål ${ctx.hole + 1}, hörnet`
        : ctx.kind === 'edge'
          ? 'Kanten'
          : 'Punkten'
      : { edge: 'Referenslinjen', point: 'Änden', corner: 'Hörnet', body: '' }[ctx.kind];
    const one = ctx.shapeId ?? (ctx.kind !== 'body' ? ctx.wallId : undefined) ?? (ctx.ids.length === 1 ? ctx.ids[0] : undefined);
    const what = one ? labelOf(doc, doc.elements[one]) : `${ctx.ids.length} objekt`;
    return { where, what };
  }

  /**
   * Raden med valets namn, värdefält och tips, eller tipset om vad man ska
   * klicka på. Tom när inget val pågår.
   */
  detailMarkup(): string {
    if (this.picking) {
      const def = RAIL_ITEMS.find((r) => r.id === this.picking)!;
      return `<div class="sm-detail"><b>${escapeHtml(def.label)}</b><span class="sm-hint">${escapeHtml(def.ask ?? '')} Esc avbryter.</span></div>`;
    }
    const op = this.active;
    if (!op) return '';
    const def = OPS[op];
    const crest =
      op === 'crestPoint' && this.ctx
        ? crestSuggestion(this.host, this.ctx)
        : op === 'pathLevel' && this.ctx
          ? levelSuggestion(this.host, this.ctx)
          : op === 'pathEase' && this.ctx
            ? { value: easeSuggestion(this.host, this.ctx), unit: 'mm' as const }
            : null;
    const v = def.value && crest ? { ...def.value, unit: crest.unit } : def.value;
    const initial = crest
      ? String(crest.value).replace('.', ',')
      : (this.remembered.get(op) ?? (op === 'stretch' ? Math.round(this.tool?.currentLength() ?? 0) : (v?.initial ?? 0)));
    const value = v
      ? `<label class="sm-value"><span>${v.label}</span><input type="text" data-modify-value data-expr ${v.unit === '°' ? 'data-unit="deg"' : v.unit === 'st' || v.unit === '×' || v.unit === 'm' ? 'data-unit=""' : ''} inputmode="decimal" autocomplete="off" value="${initial}"><i>${v.unit}</i></label>`
      : '';
    const hint = this.tool?.prompt() ?? def.hint;
    // Justera och Fördela (0.8.14): en knapp per sätt, bredvid tipset om att klicka en linje.
    const align =
      op === 'align'
        ? `<span class="sm-align" role="group" aria-label="Justera och fördela">${ALIGN_BUTTONS.map((b) => `<button type="button" class="qb-btn sm-align-btn" data-align="${b.kind}" title="${escapeHtml(b.label)}" aria-label="${escapeHtml(b.label)}">${icons[ALIGN_ICONS[b.kind]]}</button>`).join('')}</span>`
        : '';
    // Förskjut (0.10.17): en kant, flera symmetriskt kring den eller alla.
    const edges =
      op === 'shapeOffset'
        ? `<label class="sm-value"><span>Kanter</span><select data-modify-edges>${EDGE_CHOICES.map(([n, l]) => `<option value="${n}"${n === this.edges ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`
        : '';
    return `<div class="sm-detail"><b>${escapeHtml(def.label)}</b>${value}${edges}${align}<span class="sm-hint">${escapeHtml(hint)}</span></div>`;
  }

  /**
   * Värdefältet i en behållare (smartmenyn eller verktygsraden): Enter utför,
   * Esc avbryter, och förhandsvisningen följer det man skriver.
   */
  bindValue(el: HTMLElement): void {
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-align]');
      if (!b || !(this.tool instanceof ArrangeTool)) return;
      e.preventDefault();
      e.stopPropagation();
      this.tool.alignBy(b.dataset.align as AlignKind);
    });
    el.addEventListener('keydown', (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.matches('input[data-modify-value]')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = Number(input.value);
        if (Number.isFinite(v)) this.applyValue(v);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.cancel();
      }
    });
    el.addEventListener('change', (e) => {
      const sel = e.target as HTMLSelectElement;
      if (sel.matches('select[data-modify-edges]')) this.setEdges(Number(sel.value));
    });
    el.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.matches('input[data-modify-value]')) return;
      const v = Number(input.value);
      if (Number.isFinite(v)) this.setValue(v);
    });
  }

  /** Lägg markören i värdefältet, så att man kan skriva direkt (inte på pekskärm). */
  focusValue(el: HTMLElement): void {
    if (matchMedia('(pointer: coarse)').matches) return;
    // Efter klicket i ritningen, som annars tar fokus tillbaka.
    setTimeout(() => {
      const input = el.querySelector<HTMLInputElement>('input[data-modify-value]');
      if (input && document.activeElement !== input) {
        input.focus();
        input.select();
      }
    }, 0);
  }
}

/** Valen för hur många kanter Förskjut flyttar (0.10.17). */
const EDGE_CHOICES: [number, string][] = [
  [1, '1'],
  [3, '3'],
  [5, '5'],
  [0, 'Alla'],
];

/** En kant i en 2D-form, en kontur (takfall, bjälklag, markyta), en håltagning eller ett markobjekts linje (inte en vägg). */
function isLineEdge(ctx: ModifyContext): boolean {
  return ctx.kind === 'edge' && !!ctx.shapeId;
}

/** Ikonerna för Justera och Fördela. */
const ALIGN_ICONS = {
  left: 'alignLeft',
  hcenter: 'alignHCenter',
  right: 'alignRight',
  top: 'alignTop',
  vcenter: 'alignVCenter',
  bottom: 'alignBottom',
  distH: 'distH',
  distV: 'distV',
} as const satisfies Record<AlignKind, string>;
