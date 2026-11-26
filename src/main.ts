// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import './styles/app.css';
import { resolveBrand } from './brand';
import { registerBuiltInTypes } from './elements';
import { mountApp } from './ui/app';
import { installExpressionFields } from './ui/expr';
import { installTableSort } from './ui/tableSort';
import { showRescue } from './ui/app/setAside';

registerBuiltInTypes();
// Formler i sifferfält. Kopplas före appen, så att uträkningen hinner före
// programmets egna lyssnare.
installExpressionFields();
// Sortering per rubrik i alla tabeller (0.10.36).
installTableSort();

const brand = resolveBrand(import.meta.env.VITE_BRAND);
const root = document.getElementById('app')!;
// Går appen inte att starta (ett autospar som går att läsa men inte att rita)
// visas räddningsrutan i stället för en tom sida (0.12.5.9).
mountApp(root, brand).catch((err) => void showRescue(root, err, brand.fileExtension));

// Offline och installation. Förhandsvisningen (läget "artifact") är en enda
// fil utan service worker, så där hoppar vi över registreringen.
if (import.meta.env.PROD && import.meta.env.MODE !== 'artifact' && 'serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      // Finns en ny version på webbhotellet visas en rad som laddar om till den.
      const update = registerSW({
        immediate: true,
        onNeedRefresh() {
          const bar = document.createElement('div');
          bar.className = 'update-bar';
          bar.innerHTML = '<span>En ny version finns.</span><button class="btn btn-primary">Ladda om</button><button class="icon-mini" aria-label="Senare">×</button>';
          bar.querySelector('.btn')!.addEventListener('click', () => void update(true));
          bar.querySelector('.icon-mini')!.addEventListener('click', () => bar.remove());
          document.body.appendChild(bar);
        },
      });
    })
    .catch(() => {
      /* Appen fungerar utan service worker, bara inte offline. */
    });
}
