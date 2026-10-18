/**
 * Formler i sifferfält. Alla sifferfält i programmet tar ett uttryck:
 *
 *   2700          ett tal
 *   +300  -50     räknas från värdet som stod i fältet: 2700 → 3000
 *   *2  /2  ×2    likaså
 *   2400+2*120    ett helt uttryck, med parenteser
 *   2,4m  60cm    enheter räknas om till fältets enhet (oftast mm)
 *   3 620         mellanslag mellan siffror är tusentalsavgränsare
 *
 * Uttrycket räknas med en egen liten räknare, aldrig genom att köra texten
 * som kod. Ogiltiga uttryck ger null och lämnar fältet som det var.
 */

/** Fältets enhet. Längder i mm, vinklar i grader, eller ett rent tal. */
export type ExprUnit = 'mm' | 'deg' | '';

const LENGTH: Record<string, number> = { mm: 1, cm: 10, dm: 100, m: 1000, km: 1_000_000 };
const ANGLE: Record<string, number> = { '°': 1, deg: 1, grad: 1, gon: 0.9 };

type Tok = { k: 'num'; v: number } | { k: 'op'; v: string } | { k: 'unit'; v: string };

function tokenize(src: string): Tok[] | null {
  const s = src
    .trim()
    .replace(/(\d)[\s  ]+(?=\d)/g, '$1') // 3 620 → 3620
    .replace(/[×xX]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–]/g, '-');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const num = /^(\d+(?:[.,]\d*)?|[.,]\d+)/.exec(s.slice(i));
    if (num) {
      out.push({ k: 'num', v: Number(num[1].replace(',', '.')) });
      i += num[1].length;
      continue;
    }
    const unit = /^(mm|cm|dm|km|m|°|deg|grad|gon)/i.exec(s.slice(i));
    if (unit) {
      out.push({ k: 'unit', v: unit[1].toLowerCase() });
      i += unit[1].length;
      continue;
    }
    if ('+-*/()'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
      continue;
    }
    return null;
  }
  return out;
}

/**
 * Räkna ut ett uttryck. `base` är värdet som stod i fältet, för uttryck som
 * börjar med ett räknesätt. Svarar null om uttrycket inte går att läsa.
 */
export function evaluate(text: string, base: number | null = null, unit: ExprUnit = 'mm'): number | null {
  const toks = tokenize(text);
  if (!toks || toks.length === 0) return null;
  // "+300", "*2": räkna från det som stod i fältet.
  const first = toks[0];
  if (first.k === 'op' && '+-*/'.includes(first.v) && base !== null && Number.isFinite(base)) {
    toks.unshift({ k: 'num', v: base });
  }
  let pos = 0;
  const peek = () => toks[pos];
  const scaleOf = (u: string): number | null => {
    if (unit === 'mm') return LENGTH[u] ?? null;
    if (unit === 'deg') return ANGLE[u] ?? null;
    return null;
  };

  // uttryck := term (('+'|'-') term)*
  // term    := faktor (('*'|'/') faktor)*
  // faktor  := '-' faktor | tal enhet? | '(' uttryck ')' enhet?
  const factor = (): number | null => {
    const t = peek();
    if (!t) return null;
    if (t.k === 'op' && t.v === '-') {
      pos++;
      const v = factor();
      return v === null ? null : -v;
    }
    if (t.k === 'op' && t.v === '+') {
      pos++;
      return factor();
    }
    let v: number | null = null;
    if (t.k === 'num') {
      pos++;
      v = t.v;
    } else if (t.k === 'op' && t.v === '(') {
      pos++;
      v = expr();
      const close = peek();
      if (v === null || !close || close.k !== 'op' || close.v !== ')') return null;
      pos++;
    } else return null;
    const u = peek();
    if (u && u.k === 'unit') {
      const s = scaleOf(u.v);
      if (s === null) return null;
      pos++;
      v *= s;
    }
    return v;
  };
  const term = (): number | null => {
    let v = factor();
    while (v !== null) {
      const t = peek();
      if (!t || t.k !== 'op' || (t.v !== '*' && t.v !== '/')) break;
      pos++;
      const r = factor();
      if (r === null) return null;
      if (t.v === '/' && r === 0) return null;
      v = t.v === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v !== null) {
      const t = peek();
      if (!t || t.k !== 'op' || (t.v !== '+' && t.v !== '-')) break;
      pos++;
      const r = term();
      if (r === null) return null;
      v = t.v === '+' ? v + r : v - r;
    }
    return v;
  };
  const v = expr();
  if (v === null || pos !== toks.length || !Number.isFinite(v)) return null;
  return v;
}

/** Är texten bara ett tal, så att ingen förhandsvisning behövs? */
export function isPlainNumber(text: string): boolean {
  return /^\s*-?\d+(?:[.,]\d+)?\s*$/.test(text.replace(/(\d)[\s  ]+(?=\d)/g, '$1'));
}

/** Värdet som text i fältet: punkt som decimaltecken, högst tre decimaler. */
export function formatResult(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });

function unitOf(el: HTMLInputElement): ExprUnit {
  const u = el.dataset.unit;
  return u === 'deg' || u === '' ? u : 'mm';
}

function baseOf(el: HTMLInputElement): number | null {
  const raw = el.dataset.exprBase ?? '';
  if (raw.trim() === '') {
    const ph = Number(el.placeholder?.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(ph) && el.placeholder.trim() !== '' && /\d/.test(el.placeholder) ? ph : null;
  }
  return evaluate(raw, null, unitOf(el));
}

/**
 * Räkna ut fältets uttryck och skriv in resultatet, så att resten av
 * programmet bara ser ett tal. Ett tomt eller ogiltigt fält lämnas orört.
 */
export function resolveField(el: HTMLInputElement): void {
  if (!el.matches('input[data-expr]')) return;
  const text = el.value;
  if (text.trim() === '' || isPlainNumber(text)) {
    if (isPlainNumber(text)) el.value = text.replace(/(\d)[\s  ]+(?=\d)/g, '$1').replace(',', '.').trim();
    return;
  }
  const v = evaluate(text, baseOf(el), unitOf(el));
  if (v !== null) el.value = formatResult(v);
}

/**
 * Kopplar formelfälten i hela dokumentet: förhandsvisning medan man skriver,
 * uträkning innan programmets egna lyssnare läser fältet (Enter, ändring,
 * tryck någon annanstans), piltangenter som stegar, och på pekskärm en rad
 * med räknesätt och enheter ovanför tangentbordet.
 */
export function installExpressionFields(): void {
  const preview = document.createElement('div');
  preview.className = 'expr-preview';
  preview.hidden = true;
  preview.setAttribute('aria-live', 'polite');
  document.body.appendChild(preview);

  const keys = document.createElement('div');
  keys.className = 'expr-keys';
  keys.hidden = true;
  keys.setAttribute('role', 'group');
  keys.setAttribute('aria-label', 'Räknesätt och enheter');
  const keyDefs: [string, string][] = [
    ['+', '+'],
    ['−', '-'],
    ['×', '*'],
    ['÷', '/'],
    ['(', '('],
    [')', ')'],
    ['m', 'm'],
    ['cm', 'cm'],
  ];
  keys.innerHTML = keyDefs.map(([label, ins]) => `<button type="button" data-ins="${ins}" tabindex="-1">${label}</button>`).join('');
  document.body.appendChild(keys);

  let active: HTMLInputElement | null = null;
  const coarse = () => window.matchMedia('(pointer: coarse)').matches;

  const showPreview = () => {
    if (!active) return void (preview.hidden = true);
    const text = active.value;
    if (text.trim() === '' || isPlainNumber(text)) return void (preview.hidden = true);
    const v = evaluate(text, baseOf(active), unitOf(active));
    const unit = unitOf(active) === 'deg' ? '°' : unitOf(active) === 'mm' ? ' mm' : '';
    preview.textContent = v === null ? 'Går inte att räkna ut' : `= ${nf.format(v)}${unit}`;
    preview.classList.toggle('bad', v === null);
    const r = active.getBoundingClientRect();
    preview.style.left = `${Math.round(r.left)}px`;
    preview.style.top = `${Math.round(r.bottom + 4)}px`;
    preview.hidden = false;
  };

  const placeKeys = () => {
    if (!active || !coarse()) return void (keys.hidden = true);
    keys.hidden = false;
    const vv = window.visualViewport;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    keys.style.top = `${Math.round(bottom - keys.offsetHeight)}px`;
    keys.style.left = `${Math.round(vv?.offsetLeft ?? 0)}px`;
    keys.style.width = `${Math.round(vv?.width ?? window.innerWidth)}px`;
  };
  window.visualViewport?.addEventListener('resize', placeKeys);
  window.visualViewport?.addEventListener('scroll', placeKeys);

  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    if (el instanceof HTMLInputElement && el.matches('input[data-expr]')) {
      active = el;
      el.dataset.exprBase = el.value;
      showPreview();
      placeKeys();
      // Tangentbordet hinner komma upp först.
      setTimeout(placeKeys, 350);
    }
  });
  document.addEventListener('focusout', (e) => {
    if (e.target !== active) return;
    setTimeout(() => {
      if (document.activeElement === active) return;
      active = null;
      preview.hidden = true;
      keys.hidden = true;
    }, 0);
  });
  document.addEventListener('input', (e) => {
    if (e.target === active) showPreview();
  });

  // Räkna ut innan programmets egna lyssnare läser värdet.
  document.addEventListener(
    'keydown',
    (e) => {
      const el = e.target as HTMLElement;
      if (!(el instanceof HTMLInputElement) || !el.matches('input[data-expr]')) return;
      if (e.key === 'Enter') {
        resolveField(el);
        preview.hidden = true;
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.altKey) {
        const step = Number(el.dataset.step) || 1;
        const cur = evaluate(el.value, baseOf(el), unitOf(el));
        if (cur === null) return;
        e.preventDefault();
        el.value = formatResult(cur + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    true,
  );
  document.addEventListener(
    'change',
    (e) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement) resolveField(el);
    },
    true,
  );
  document.addEventListener(
    'pointerdown',
    (e) => {
      // Ett tryck på räknesätten är en del av inmatningen: inga andra
      // lyssnare får tro att man tryckt utanför fältet och stänga det.
      if (keys.contains(e.target as Node)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      if (active && e.target !== active) resolveField(active);
    },
    true,
  );
  keys.addEventListener('mousedown', (e) => e.preventDefault());

  // Räknesätten på pekskärm: skriv in tecknet där markören står.
  keys.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ins]');
    if (!b || !active) return;
    const ins = b.dataset.ins!;
    const el = active;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    // Är hela värdet markerat (som när fältet just fått fokus) börjar ett
    // räknesätt räkna från det.
    const replaceAll = start === 0 && end === el.value.length && el.value !== '';
    if (replaceAll && '+-*/'.includes(ins)) {
      el.value = ins;
      el.setSelectionRange(1, 1);
    } else {
      el.setRangeText(ins, start, end, 'end');
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  });
}
