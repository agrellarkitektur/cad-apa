import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * Kamerastyrningen i 3D (0.10.27, 0.10.28.1), som i ArchiCAD: mittenknappen
 * panorerar och Shift + mittenknappen snurrar vyn; dubbelklick med
 * mittenknappen visar hela modellen. Utan mus: Mellanslag + vänsterknappen
 * gör samma sak som mittenknappen. Vänsterknappen markerar och
 * högerknappen öppnar menyn (de sköts i `Edit3D`).
 */
export interface Navigation {
  /** Mellanslaget hålls ned: vänsterknappen panorerar. */
  spaceDown(): boolean;
}

export function setupNavigation(
  controls: OrbitControls,
  canvas: HTMLCanvasElement,
  frameAll: () => void,
): Navigation {
  let spaceDown = false;
  controls.enableDamping = false;
  controls.screenSpacePanning = true;
  // Kameran får gå under marken, så att man ser undersidor. Strax före
  // rakt nedifrån stannar den, annars vänder sig bilden.
  controls.maxPolarAngle = Math.PI * 0.98;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  // Som i ArchiCAD (0.10.27): mittenknappen panorerar och Shift +
  // mittenknappen orbitar (kamerastyrningen byter själv med Shift).
  // Vänsterknappen markerar och högerknappen öppnar menyn. Mellanslag +
  // vänsterknappen gör samma sak som mittenknappen, utan mus.
  controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: null };
  const typing = (t: EventTarget | null) =>
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable);
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || typing(e.target) || spaceDown) return;
    spaceDown = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    canvas.style.cursor = "grab";
  });
  window.addEventListener("keyup", (e) => {
    if (e.code !== "Space") return;
    spaceDown = false;
    controls.mouseButtons.LEFT = null;
    canvas.style.cursor = "";
  });
  window.addEventListener("blur", () => {
    spaceDown = false;
    controls.mouseButtons.LEFT = null;
    canvas.style.cursor = "";
  });
  // Shift i valfri ordning (0.10.28.1): trycks eller släpps Shift mitt i ett
  // drag byter kamerastyrningen mellan att panorera och att snurra från
  // där pekaren står (OrbitControls läser annars Shift bara när knappen
  // trycks ned).
  let last: { clientX: number; clientY: number } | null = null;
  canvas.addEventListener(
    "pointermove",
    (e) => (last = { clientX: e.clientX, clientY: e.clientY }),
  );
  const shiftSwitch = (shift: boolean) => {
    const c = controls as unknown as {
      state: number;
      _handleMouseDownRotate(e: object): void;
      _handleMouseDownPan(e: object): void;
    };
    if (!last || (c.state !== 0 && c.state !== 2)) return;
    if (shift && c.state === 2) {
      c._handleMouseDownRotate(last);
      c.state = 0;
    } else if (!shift && c.state === 0) {
      c._handleMouseDownPan(last);
      c.state = 2;
    }
  };
  window.addEventListener(
    "keydown",
    (e) => e.key === "Shift" && !e.repeat && shiftSwitch(true),
  );
  window.addEventListener(
    "keyup",
    (e) => e.key === "Shift" && shiftSwitch(false),
  );
  // Dubbelklick med mittenknappen visar hela modellen, som i planen.
  let lastMiddle = 0;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 1) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastMiddle < 350) {
      lastMiddle = 0;
      frameAll();
    } else lastMiddle = now;
  });
  return { spaceDown: () => spaceDown };
}
