import type { ColorSet } from '../../core/graphics';
import { escapeHtml } from '../labels';
import { lineTypeSwatch } from '../lineTypePick';
import { icons } from '../icons';
import { askText } from '../ask';
import { hexToHsv, hsvToHex } from './colors';

/**
 * Radkontrollerna i stilboken (0.10.34, tavla 5 i mockupen): varje val är en
 * rund knapp som bara visar det som gäller, utan rullgardinspil.
 *
 * - **Tjocklek** (`details.weight-pick`): en rad åt sidan med tjocklekarna
 *   och ett fält för eget värde.
 * - **Linjetyp** (en lista vars val har `data-dash`): en sökbar lista med
 *   symbol och namn, och *Lägg till egen…*.
 * - **Färg** (`input[type=color]`): en panel med förval, favoriter i set,
 *   färgfält, hexkod och (när fältet har en `input.rc-alpha` bredvid sig)
 *   opacitet.
 * - **Textval** (övriga listor): en knapp med det valda, som öppnar listan.
 *
 * Fälten finns kvar, dolda, och knapparna skriver i dem och skickar
 * `change`, så att dialogens hantering är densamma som förut. Panelen
 * ligger utanför dialogen och hittar sitt fält med en väljare, så att den
 * kan vara kvar när dialogen ritas om efter en ändring (färgpanelen).
 */

export interface RowControlOptions {
  /** Favoritseten (stilbokens `colorSets`). */
  colorSets: () => readonly ColorSet[];
  /** Spara favoritseten (en ändring i stilboken). */
  setColorSets: (sets: ColorSet[]) => void;
  /** *Lägg till egen…* i linjetypslistan. */
  addLineType: () => void;
}

/** Fält som redan har en knapp, och knappen. */
const BUTTON = new WeakMap<Element, HTMLButtonElement>();

/** Förvalen i färgpanelen: svart och vitt följer temat (`ink`, `paper`), grått som det skrivs ut. */
export const PRESET_COLORS: readonly { hex: string; name: string }[] = [
  { hex: '#000000', name: 'Svart' },
  { hex: '#8c8c8c', name: 'Grått' },
  { hex: '#d5dadd', name: 'Ljusgrått' },
  { hex: '#ffffff', name: 'Vitt' },
  { hex: '#c2372c', name: 'Rött' },
  { hex: '#b88400', name: 'Ockra' },
  { hex: '#1f4fa3', name: 'Blått' },
];

const comma = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

/** Fältets nyckel: taggen och data-attributen (och namnet för tjocklekens knappar), så att samma fält hittas efter en omritning. */
function keyOf(el: Element): string {
  const parts = [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'name').map((a) => `[${a.name}="${CSS.escape(a.value)}"]`);
  return el.tagName.toLowerCase() + parts.join('');
}

/** Lägg knappar på fälten i `root` (efter varje omritning). En öppen färgpanel flyttar till sin nya knapp; andra paneler stängs. */
export function enhanceRowControls(root: HTMLElement, opts: RowControlOptions): void {
  for (const sel of root.querySelectorAll<HTMLSelectElement>('select:not(.rc-native)')) attach(sel, sel.querySelector('option[data-dash]') ? 'line' : 'text');
  for (const inp of root.querySelectorAll<HTMLInputElement>('input[type="color"]')) attach(inp, 'color');
  for (const det of root.querySelectorAll<HTMLDetailsElement>('details.weight-pick')) {
    const radio = det.querySelector<HTMLInputElement>('input[type="radio"]');
    if (radio) attach(det, 'weight');
  }
  pop.it.reattach(root, opts);
}

type Kind = 'text' | 'line' | 'color' | 'weight';

function attach(src: HTMLElement, kind: Kind): void {
  if (BUTTON.has(src)) {
    sync(src, kind, BUTTON.get(src)!);
    return;
  }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `rc-val rc-${kind}`;
  b.dataset.rcKind = kind;
  const label = src.getAttribute('aria-label') ?? src.closest('label')?.querySelector(':scope > span:first-child')?.textContent ?? '';
  if (label) b.setAttribute('aria-label', label);
  if (src.title) b.title = src.title;
  src.hidden = true;
  src.classList.add('rc-src');
  src.after(b);
  BUTTON.set(src, b);
  sync(src, kind, b);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    pop.it.toggle(src, kind, b);
  });
}

/** Knappens innehåll efter fältets värde. */
function sync(src: HTMLElement, kind: Kind, b: HTMLButtonElement): void {
  if (kind === 'weight') {
    const r = src.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    const w = Number(r?.value ?? 0);
    b.textContent = w ? comma(w) : 'Ingen';
    b.disabled = !!r?.disabled;
    return;
  }
  if (kind === 'color') {
    const inp = src as HTMLInputElement;
    const alpha = alphaOf(inp);
    const op = alpha && !alpha.disabled ? Math.max(0, Math.min(100, Number(alpha.value))) : 100;
    b.innerHTML = `<i class="rc-sw" style="background:${escapeHtml(inp.value)};opacity:${Math.max(0.15, op / 100)}"></i>${alpha ? `<span class="rc-op">${Math.round(op)} %</span>` : ''}`;
    b.title = inp.title || `${inp.value.toUpperCase()}${alpha ? `, ${Math.round(op)} %` : ''}`;
    b.disabled = inp.disabled;
    return;
  }
  const sel = src as HTMLSelectElement;
  const opt = sel.selectedOptions[0];
  if (kind === 'line') {
    const dash = opt?.dataset.dash;
    b.innerHTML = dash !== undefined ? lineTypeSwatch(parseDashAttr(dash)) : `<span>${escapeHtml(opt?.textContent ?? '')}</span>`;
    b.title = opt?.textContent ?? '';
  } else b.innerHTML = `<span>${escapeHtml(opt?.textContent ?? '–')}</span>`;
  b.disabled = sel.disabled;
}

const parseDashAttr = (s: string) => (s ? s.split(' ').map(Number).filter((n) => Number.isFinite(n)) : []);

/** Opacitetens fält bredvid ett färgfält (`input.rc-alpha` i samma förälder), om det finns. */
function alphaOf(inp: HTMLInputElement): HTMLInputElement | null {
  return inp.parentElement?.querySelector<HTMLInputElement>('input.rc-alpha') ?? null;
}

/** Skriv ett värde i fältet och skicka `change`, som om man ändrat det själv. */
function commit(src: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (src.value === value) return;
  src.value = value;
  src.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Panelen: en åt gången, utanför dialogen. */
class Popover {
  private el: HTMLElement | null = null;
  private key = '';
  private kind: Kind = 'text';
  private root: HTMLElement | null = null;
  private opts: RowControlOptions | null = null;
  private anchor: HTMLElement | null = null;
  /** Färgpanelens läge (HSV), så att dragningen i fältet inte hoppar när färgen avrundas. */
  private hsv: [number, number, number] = [0, 0, 0];
  private setIndex = 0;

  constructor() {
    document.addEventListener('pointerdown', (e) => {
      if (!this.el) return;
      const t = e.target as Node;
      if (this.el.contains(t) || this.anchor?.contains(t)) return;
      this.close();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (this.el && e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        const a = this.anchor;
        this.close();
        a?.focus();
      }
    }, true);
    window.addEventListener('resize', () => this.close());
  }

  get open(): boolean {
    return !!this.el;
  }

  close(): void {
    this.el?.remove();
    this.el = null;
    this.anchor?.classList.remove('open');
    this.anchor = null;
    this.key = '';
  }

  toggle(src: HTMLElement, kind: Kind, anchor: HTMLElement): void {
    const key = keyOf(kind === 'weight' ? src.querySelector('input[type="radio"]')! : src);
    if (this.el && this.key === key) {
      this.close();
      return;
    }
    this.close();
    const root = src.closest<HTMLElement>('.dialog-backdrop') ?? document.body;
    this.root = root;
    this.key = key;
    this.kind = kind;
    this.anchor = anchor;
    anchor.classList.add('open');
    this.el = document.createElement('div');
    this.el.className = `rc-pop rc-pop-${kind}`;
    this.el.setAttribute('role', 'dialog');
    document.body.append(this.el);
    if (kind === 'color') this.hsv = hexToHsv((src as HTMLInputElement).value);
    this.render(true);
  }

  /** Efter dialogens omritning: färgpanelen följer sitt fält, andra stängs. */
  reattach(root: HTMLElement, opts: RowControlOptions): void {
    this.opts = opts;
    if (!this.el || !this.root?.contains(root)) return;
    const src = this.source();
    if (!src || this.kind !== 'color') {
      this.close();
      return;
    }
    const b = BUTTON.get(src);
    if (!b) return this.close();
    this.anchor = b;
    b.classList.add('open');
    this.render(false);
  }

  /** Fältet panelen hör till, i dialogen som den ser ut nu. */
  private source(): HTMLElement | null {
    const hit = this.root?.querySelector<HTMLElement>(this.key) ?? null;
    if (hit && this.kind === 'weight') return hit.closest('details');
    return hit;
  }

  private place(): void {
    if (!this.el || !this.anchor) return;
    const r = this.anchor.getBoundingClientRect();
    const p = this.el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = this.kind === 'weight' ? r.left : r.left;
    if (left + p.width > vw - 8) left = Math.max(8, r.right - p.width);
    let top = r.bottom + 4;
    if (top + p.height > vh - 8) top = Math.max(8, r.top - 4 - p.height);
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
  }

  private render(first: boolean): void {
    const src = this.source();
    if (!this.el || !src) return this.close();
    if (this.kind === 'weight') this.weight(src as HTMLDetailsElement);
    else if (this.kind === 'color') this.color(src as HTMLInputElement, first);
    else this.list(src as HTMLSelectElement, this.kind === 'line');
    this.place();
  }

  /** Tjockleken: knapparna i en rad och ett fält för eget värde. */
  private weight(det: HTMLDetailsElement): void {
    const radios = [...det.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    const cur = radios.find((r) => r.checked)?.value;
    this.el!.innerHTML = `${radios
      .map((r) => `<button type="button" class="rc-chip${r.value === cur ? ' on' : ''}" data-w="${escapeHtml(r.value)}"${Number(r.value) ? '' : ' title="Ingen linje"'}>${Number(r.value) ? comma(Number(r.value)) : 'Ingen'}</button>`)
      .join('')}<span class="rc-sep" aria-hidden="true"></span><label class="rc-own"><span>Eget</span><input type="text" inputmode="decimal" autocomplete="off" placeholder="0,20" aria-label="Egen tjocklek"><i>mm</i></label>`;
    const choose = (v: number) => {
      const now = this.source() as HTMLDetailsElement | null;
      if (!now) return this.close();
      let radio = [...now.querySelectorAll<HTMLInputElement>('input[type="radio"]')].find((r) => Number(r.value) === v);
      if (!radio) {
        // Ett eget värde: en knapp till med samma attribut.
        const proto = now.querySelector<HTMLInputElement>('input[type="radio"]')!;
        radio = proto.cloneNode() as HTMLInputElement;
        radio.value = String(v);
        radio.checked = false;
        proto.parentElement!.append(radio);
      }
      this.close();
      if (radio.checked) return;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    };
    this.el!.querySelectorAll<HTMLElement>('[data-w]').forEach((b) => b.addEventListener('click', () => choose(Number(b.dataset.w))));
    const own = this.el!.querySelector<HTMLInputElement>('.rc-own input')!;
    own.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = Number(own.value.replace(',', '.').replace(/\s|mm/g, ''));
      if (v > 0 && v <= 10) choose(Math.round(v * 1000) / 1000);
      else own.select();
    });
  }

  /** En lista: textval, eller linjetyper med symbol, sök och *Lägg till egen…*. */
  private list(sel: HTMLSelectElement, lines: boolean): void {
    const items: string[] = [];
    let n = 0;
    for (const child of sel.children) {
      if (child instanceof HTMLOptGroupElement) {
        items.push(`<h5>${escapeHtml(child.label)}</h5>`);
        for (const o of child.querySelectorAll('option')) items.push(this.item(o, lines, n++));
      } else if (child instanceof HTMLOptionElement) items.push(this.item(child, lines, n++));
    }
    this.el!.innerHTML = `${lines ? '<input type="search" class="rc-search" placeholder="Sök linjetyp" aria-label="Sök linjetyp">' : ''}<div class="rc-items" role="listbox">${items.join('')}</div>${lines ? `<div class="rc-foot"><button type="button" class="btn rc-add">${icons.plus}<span>Lägg till egen…</span></button></div>` : ''}`;
    const options = [...sel.querySelectorAll('option')];
    this.el!.querySelectorAll<HTMLElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        const o = options[Number(b.dataset.i)];
        const now = this.source() as HTMLSelectElement | null;
        this.close();
        if (o && now) commit(now, o.value);
      }),
    );
    if (lines) {
      const search = this.el!.querySelector<HTMLInputElement>('.rc-search')!;
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        this.el!.querySelectorAll<HTMLElement>('[data-i]').forEach((b) => (b.hidden = !!q && !(b.textContent ?? '').toLowerCase().includes(q)));
        this.el!.querySelectorAll<HTMLElement>('h5').forEach((h) => {
          let s = h.nextElementSibling as HTMLElement | null;
          let any = false;
          while (s && s.tagName !== 'H5') {
            if (!s.hidden) any = true;
            s = s.nextElementSibling as HTMLElement | null;
          }
          h.hidden = !any;
        });
      });
      search.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        this.el!.querySelector<HTMLElement>('[data-i]:not([hidden])')?.click();
      });
      this.el!.querySelector('.rc-add')?.addEventListener('click', () => {
        this.close();
        this.opts?.addLineType();
      });
      requestAnimationFrame(() => search.focus());
    } else requestAnimationFrame(() => this.el?.querySelector<HTMLElement>('.rc-item.on, .rc-item')?.focus());
  }

  private item(o: HTMLOptionElement, lines: boolean, i: number): string {
    if (o.disabled && !o.value) return '';
    const sw = lines && o.dataset.dash !== undefined ? lineTypeSwatch(parseDashAttr(o.dataset.dash)) : '';
    return `<button type="button" class="rc-item${o.selected ? ' on' : ''}" role="option" aria-selected="${o.selected}" data-i="${i}"${o.disabled ? ' disabled' : ''}>${sw}<span>${escapeHtml(o.textContent ?? '')}</span></button>`;
  }

  /** Färgen: förval, favoriter i set, färgfält, hexkod och opacitet. */
  private color(inp: HTMLInputElement, first: boolean): void {
    const hex = inp.value.toLowerCase();
    if (!first && hsvToHex(this.hsv) !== hex) this.hsv = hexToHsv(hex);
    const alpha = alphaOf(inp);
    const sets = this.opts?.colorSets() ?? [];
    if (this.setIndex >= sets.length) this.setIndex = 0;
    const set = sets[this.setIndex];
    const sq = (c: string, title: string, attr: string) => `<button type="button" class="rc-sq${c === hex ? ' on' : ''}" style="background:${c}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" ${attr}></button>`;
    const setPick = `<select class="rc-native rc-set" aria-label="Set">${sets.map((s, i) => `<option value="${i}"${i === this.setIndex ? ' selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}<option value="new">Nytt set…</option>${set ? '<option value="rename">Byt namn på setet…</option><option value="delete">Ta bort setet</option>' : ''}</select>`;
    const [h] = this.hsv;
    this.el!.innerHTML = `<h5>Förval</h5>
      <div class="rc-sqs">${PRESET_COLORS.map((c) => sq(c.hex, c.name, `data-c="${c.hex}"`)).join('')}</div>
      <div class="rc-favhead"><h5>Favoriter</h5>${setPick}</div>
      <div class="rc-sqs">${(set?.colors ?? []).map((c) => sq(c, `${c.toUpperCase()} (högerklicka för att ta bort)`, `data-c="${c}" data-fav="${c}"`)).join('')}<button type="button" class="rc-sq rc-sq-add" title="Spara färgen som favorit${set ? ` i ${escapeHtml(set.name)}` : ''}" aria-label="Spara som favorit">+</button></div>
      <div class="rc-field">
        <div class="rc-sv" style="background-color:hsl(${h} 100% 50%)"><i class="rc-knob"></i></div>
        <div class="rc-hue"><i class="rc-knob"></i></div>
      </div>
      <div class="rc-hexrow"><input type="text" class="rc-hex" value="${hex.toUpperCase()}" aria-label="Hexkod" spellcheck="false" autocomplete="off">${
        alpha ? `<span>opacitet</span><input type="text" inputmode="decimal" class="rc-alpha-in" value="${escapeHtml(alpha.value)}" aria-label="Opacitet"${alpha.disabled ? ' disabled' : ''}><i>%</i>` : ''
      }</div>`;
    this.knobs();
    const set1 = (c: string) => {
      const now = this.source() as HTMLInputElement | null;
      if (!now) return this.close();
      this.hsv = hexToHsv(c);
      commit(now, c);
      this.render(false);
    };
    this.el!.querySelectorAll<HTMLElement>('[data-c]').forEach((b) => {
      b.addEventListener('click', () => set1(b.dataset.c!));
      if (b.dataset.fav)
        b.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.editSets((s) => s.map((x, i) => (i === this.setIndex ? { ...x, colors: x.colors.filter((c) => c !== b.dataset.fav) } : x)));
        });
    });
    this.el!.querySelector('.rc-sq-add')!.addEventListener('click', () => {
      const c = (this.source() as HTMLInputElement | null)?.value.toLowerCase();
      if (!c) return;
      this.editSets((s) => {
        if (!s.length) return [{ name: 'Favoriter', colors: [c] }];
        return s.map((x, i) => (i === this.setIndex && !x.colors.includes(c) ? { ...x, colors: [...x.colors, c] } : x));
      });
    });
    this.el!.querySelector<HTMLSelectElement>('.rc-set')!.addEventListener('change', async (e) => {
      const v = (e.target as HTMLSelectElement).value;
      if (v === 'new' || v === 'rename') {
        // Panelen stängs medan namnet skrivs (frågan är en egen dialog) och öppnas igen efteråt.
        const key = this.key;
        const root = this.root;
        this.close();
        const name = (await askText(v === 'new' ? 'Nytt set med favoritfärger' : 'Byt namn på setet', v === 'new' ? 'Bygglov' : (set?.name ?? '')))?.trim();
        if (name) {
          const all = structuredClone([...(this.opts?.colorSets() ?? [])]);
          if (v === 'new') this.setIndex = all.length;
          this.opts?.setColorSets(v === 'new' ? [...all, { name, colors: [] }] : all.map((x, i) => (i === this.setIndex ? { ...x, name } : x)));
        }
        const again = root?.querySelector<HTMLElement>(key);
        const b = again && BUTTON.get(again);
        if (again && b) this.toggle(again, 'color', b);
      } else if (v === 'delete') {
        this.editSets((s) => s.filter((_, i) => i !== this.setIndex));
        this.setIndex = 0;
      } else {
        this.setIndex = Number(v);
        this.render(false);
      }
    });
    const hexIn = this.el!.querySelector<HTMLInputElement>('.rc-hex')!;
    const hexCommit = () => {
      const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hexIn.value.trim());
      if (!m) return void (hexIn.value = hex.toUpperCase());
      const v = m[1].length === 3 ? m[1].replace(/./g, (d) => d + d) : m[1];
      set1(`#${v.toLowerCase()}`);
    };
    hexIn.addEventListener('change', hexCommit);
    hexIn.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), hexCommit()));
    const alphaIn = this.el!.querySelector<HTMLInputElement>('.rc-alpha-in');
    alphaIn?.addEventListener('change', () => {
      const v = Number(alphaIn.value.replace(',', '.').replace('%', ''));
      const now = this.source() as HTMLInputElement | null;
      const a = now && alphaOf(now);
      if (!a || !Number.isFinite(v)) return;
      commit(a, String(Math.round(Math.max(0, Math.min(100, v)))));
      this.render(false);
    });
    alphaIn?.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), alphaIn.dispatchEvent(new Event('change'))));
    this.drag(this.el!.querySelector('.rc-sv')!, (x, y) => {
      this.hsv = [this.hsv[0], x, 1 - y];
    });
    this.drag(this.el!.querySelector('.rc-hue')!, (_x, y) => {
      this.hsv = [Math.min(359.9, y * 360), this.hsv[1], this.hsv[2]];
    });
  }

  /** Ändra favoritseten i stilboken. */
  private editSets(fn: (s: ColorSet[]) => ColorSet[]): void {
    const sets = structuredClone([...(this.opts?.colorSets() ?? [])]);
    this.opts?.setColorSets(fn(sets));
    this.render(false);
  }

  /** Knopparna i färgfältet och tonskalan efter HSV. */
  private knobs(): void {
    const [h, s, v] = this.hsv;
    const sv = this.el?.querySelector<HTMLElement>('.rc-sv');
    const hue = this.el?.querySelector<HTMLElement>('.rc-hue .rc-knob');
    if (!sv || !hue) return;
    sv.style.backgroundColor = `hsl(${h} 100% 50%)`;
    const k = sv.querySelector<HTMLElement>('.rc-knob')!;
    k.style.left = `${s * 100}%`;
    k.style.top = `${(1 - v) * 100}%`;
    k.style.background = hsvToHex(this.hsv);
    hue.style.top = `${(h / 360) * 100}%`;
  }

  /** Dra i färgfältet eller tonskalan: förhandsvisning under draget, färgen sätts när knappen släpps. */
  private drag(area: HTMLElement, set: (x: number, y: number) => void): void {
    const at = (e: PointerEvent) => {
      const r = area.getBoundingClientRect();
      set(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
      this.knobs();
      const hexIn = this.el?.querySelector<HTMLInputElement>('.rc-hex');
      if (hexIn) hexIn.value = hsvToHex(this.hsv).toUpperCase();
      const b = this.anchor?.querySelector<HTMLElement>('.rc-sw');
      if (b) b.style.background = hsvToHex(this.hsv);
    };
    area.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      area.setPointerCapture(e.pointerId);
      at(e);
      const move = (m: PointerEvent) => at(m);
      const up = () => {
        area.removeEventListener('pointermove', move);
        area.removeEventListener('pointerup', up);
        area.removeEventListener('pointercancel', up);
        const now = this.source() as HTMLInputElement | null;
        if (now) commit(now, hsvToHex(this.hsv));
        this.render(false);
      };
      area.addEventListener('pointermove', move);
      area.addEventListener('pointerup', up);
      area.addEventListener('pointercancel', up);
    });
  }
}

/** Panelen skapas först när den behövs (lyssnarna på `document`). */
let shared: Popover | null = null;
const pop = { get it(): Popover { return (shared ??= new Popover()); } };

/** Stäng en öppen panel (när dialogen stängs). */
export function closeRowControl(): void {
  shared?.close();
}

