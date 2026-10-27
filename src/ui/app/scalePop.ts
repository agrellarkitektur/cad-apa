import { parseScale } from '../uiSettings';
import { Camera } from '../../view2d/camera';
import type { AppContext } from './context';
import { formatScale, nf } from './helpers';

/**
 * Skärmskalan i statusraden (ur `showMenu.ts` i granskningen efter
 * 0.10.15): klick på skalan öppnar en ruta där man skriver en skala, t.ex.
 * 100 eller 1:50.
 */
export function installScalePop(app: AppContext) {
  // Klick på skalan i statusraden: skriv in en skala, t.ex. 100 eller 1:50.
  const scalePop = app.$<HTMLFormElement>('.scale-pop');
  const scaleBtn = app.$<HTMLButtonElement>('.scale-btn');
  function openScalePop(): void {
    const input = scalePop.elements.namedItem('scale') as HTMLInputElement;
    input.value = formatScale(app.view.camera.screenScaleDenominator(app.screenMm())).replace(/\s/g, '');
    app.out('scale-note').innerHTML = app.uiSettings.screenInches
      ? `Räknat på en skärm på ${nf.format(app.uiSettings.screenInches)}″ och 100 % zoom i webbläsaren. <button type="button" class="link" data-action="scale-settings">Ändra</button>`
      : 'Ungefärlig: räknat på en vanlig skärm. <button type="button" class="link" data-action="scale-settings">Ange skärmens storlek</button> under Gränssnitt för exakt skala.';
    scalePop.hidden = false;
    scaleBtn.setAttribute('aria-expanded', 'true');
    input.focus();
    input.select();
  }
  function closeScalePop(): void {
    scalePop.hidden = true;
    scaleBtn.setAttribute('aria-expanded', 'false');
  }
  scalePop.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = parseScale((scalePop.elements.namedItem('scale') as HTMLInputElement).value);
    if (!n) {
      app.hint('Skriv skalans nämnare, t.ex. 100 eller 1:50.');
      return;
    }
    if (app.ui.mode === '3d') void app.setMode('2d');
    app.view.zoomBy(Camera.scaleFor(n, app.screenMm()) / app.view.camera.scale);
    closeScalePop();
  });
  scalePop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeScalePop();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!scalePop.hidden && !(e.target as Element).closest('.scale-wrap')) closeScalePop();
  });

  return { closeScalePop, openScalePop, scalePop };
}
