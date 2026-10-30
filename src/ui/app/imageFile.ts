import { newId } from '../../core/ids';
import type { Asset } from '../../core/model';
import { setMaterialTexture } from '../../core/materials';
import type { DocStore } from '../../core/store';
import { askChoice } from '../ask';

/**
 * Bilder som blir filer i projektet (0.10.31): materialens texturer och
 * ortofotot. En stor bild skalas ned (längsta sidan högst `maxSide`), så
 * att projektfilen inte blir onödigt stor; annars sparas filen som den är.
 */

/** Bytes som base64 (som underlagens filer). */
function base64Of(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Låt användaren välja filer. Svarar med en tom lista om inget valdes. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve([...(input.files ?? [])]));
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  });
}

/** Bildfilerna som går att använda. */
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

/**
 * Bilden i `file` som en fil i projektet, och bildens storlek i pixlar
 * (originalets, också när den skalats ned). Kastar med en förklaring om
 * filen inte går att läsa som bild.
 */
export async function imageAsset(file: File, maxSide: number, prefix: string, name = file.name): Promise<{ asset: Asset; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('filen gick inte att läsa som bild.'));
      i.src = url;
    });
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error('bilden är tom.');
    const mime = /^image\/(jpeg|png|webp)$/.test(file.type) ? file.type : 'image/jpeg';
    const k = Math.min(1, maxSide / Math.max(width, height));
    if (k === 1 && file.type === mime) return { asset: { id: newId(prefix), name, mime, data: base64Of(new Uint8Array(await file.arrayBuffer())) }, width, height };
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * k));
    canvas.height = Math.max(1, Math.round(height * k));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG har kvar det genomskinliga; annat blir JPEG.
    const out = mime === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, out, 0.88));
    if (!blob) throw new Error('bilden kunde inte skalas ned.');
    return { asset: { id: newId(prefix), name, mime: out, data: base64Of(new Uint8Array(await blob.arrayBuffer())) }, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Texturens längsta sida i pixlar. */
export const TEXTURE_MAX_PX = 1024;
/** Ortofotots längsta sida i pixlar (de flesta grafikkort klarar 8192; 4096 räcker för ett utsnitt på några hundra meter). */
export const ORTHO_MAX_PX = 4096;

/** Välj en bild och gör den till en textur. Null om inget valdes; kastar om bilden inte går att läsa. */
export async function pickTexture(): Promise<Asset | null> {
  const [file] = await pickFiles(IMAGE_ACCEPT);
  if (!file) return null;
  return (await imageAsset(file, TEXTURE_MAX_PX, 'tex')).asset;
}

/**
 * Välj en bild till materialet `id` (0.10.31), i panelen och i
 * stilboken. Går bilden inte att läsa säger en ruta det.
 */
export async function chooseTexture(store: DocStore, id: string): Promise<void> {
  try {
    const asset = await pickTexture();
    if (asset) setMaterialTexture(store, id, asset);
  } catch (e) {
    await askChoice('Texturen', `Bilden gick inte att använda: ${(e as Error).message}`, [{ value: 'ok', label: 'Ok' }]);
  }
}
