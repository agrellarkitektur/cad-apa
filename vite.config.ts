/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolveBrand } from './src/brand/index.ts';

/**
 * Två byggen:
 *  - `npm run build`    → dist/ för webbhotellet (PWA, kan installeras, fungerar offline)
 *  - `npm run preview:artifact` → en enda HTML-fil för snabb förhandsvisning
 *
 * `base: './'` gör att appen fungerar i vilken mapp som helst på servern,
 * t.ex. agrellarkitektur.se/cad-apa/.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const brand = resolveBrand(env.VITE_BRAND);
  const artifact = mode === 'artifact';

  const brandHtml: Plugin = {
    name: 'brand-html',
    transformIndexHtml: (html) =>
      html
        .replace('%BRAND_TITLE%', brand.badge ? `${brand.name} · ${brand.badge}` : brand.name)
        .replace('%BRAND_DESCRIPTION%', brand.description),
  };

  return {
    base: './',
    plugins: [
      brandHtml,
      artifact
        ? viteSingleFile()
        : VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['icon.svg'],
            manifest: {
              name: brand.name,
              short_name: brand.shortName,
              description: brand.description,
              lang: 'sv',
              theme_color: brand.themeColor,
              background_color: brand.themeColor,
              display: 'standalone',
              start_url: './',
              scope: './',
              icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,woff2}'],
              // pdf.js med sin arbetare är större än förvalet på 2 MB (0.8 del 2).
              maximumFileSizeToCacheInBytes: 6_000_000,
            },
          }),
    ],
    build: {
      outDir: artifact ? 'dist-artifact' : 'dist',
      assetsInlineLimit: artifact ? 100_000_000 : 4096,
      // three.js och pdf.js laddas separat när de behövs (3D-vyn, PDF-underlag).
      chunkSizeWarningLimit: 1300,
    },
    test: {
      // Testen som mäter tid körs ensamma efter de andra, så att de inte
      // delar processorn med andra testfiler (på GitHub körs flera samtidigt).
      // De andra delar process utan att läsa in koden igen för varje fil
      // (isolate: false, 0.8.32): hela körningen tar halva tiden. De går
      // igenom i slumpad ordning (--sequence.shuffle), så att inget test
      // beror på ett annat; ett test som ändrar något för alla (som
      // snapIndex.from) återställer det.
      projects: [
        { extends: true, test: { name: 'tester', include: ['tests/**/*.test.ts'], exclude: ['tests/prestanda.test.ts'], isolate: false, sequence: { groupOrder: 0 } } },
        { extends: true, test: { name: 'prestanda', include: ['tests/prestanda.test.ts'], sequence: { groupOrder: 1 } } },
      ],
    },
  };
});
