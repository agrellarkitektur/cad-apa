/**
 * Hjälp för cacharna i planen (0.8.3). Dokumentet ändras aldrig på plats: ett
 * ändrat element blir ett nytt objekt, och `resolveParams` ger samma
 * parametrar så länge elementet och dess definition är desamma. Därför räcker
 * det att jämföra med === för att veta att något är oförändrat.
 */

/** Samma längd och samma objekt på varje plats. */
export function sameItems(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Ett räknat värde som återanvänds så länge indata är samma objekt. Sparar de
 * senaste `size` svaren, t.ex. för planen och en kalkerad vy samtidigt.
 */
export function lastResults<T>(size = 4): (inputs: readonly unknown[], compute: () => T) => T {
  const saved: { inputs: readonly unknown[]; value: T }[] = [];
  return (inputs, compute) => {
    const i = saved.findIndex((s) => sameItems(s.inputs, inputs));
    if (i >= 0) {
      const hit = saved[i];
      saved.splice(i, 1);
      saved.unshift(hit);
      return hit.value;
    }
    const value = compute();
    saved.unshift({ inputs, value });
    if (saved.length > size) saved.pop();
    return value;
  };
}
