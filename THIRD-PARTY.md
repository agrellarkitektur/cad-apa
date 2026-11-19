# Det som kommer från andra

cad-apa är fri programvara under GNU AGPL-3.0 eller senare (se `LICENSE`).
Här står allt i appen och repot som andra har gjort, med licens. Alla
licenserna är förenliga med AGPL-3.0. Licenstexterna ligger i `LICENSES/`
och, för typsnitten, i `src/fonts/`.

Ett kommersiellt undantag från Agrell Arkitektur gäller bara Agrell
Arkitekturs egen kod, aldrig det som står här.

Gås igenom när ett beroende eller en tillgång läggs till eller tas bort
(senast 0.12.5.4, 19 november 2026).

## Bibliotek som följer med appen

| Bibliotek | Version | Används till | Licens | Upphov | Licenstext |
|---|---|---|---|---|---|
| three.js | 0.170.0 | 3D-vyn | MIT | three.js authors | `LICENSES/three.js-MIT.txt` |
| pdf.js (pdfjs-dist) | 6.4.299 | PDF-underlag | Apache-2.0 | Mozilla och pdf.js-bidragsgivarna | `LICENSES/pdf.js-Apache-2.0.txt` |
| earcut | 3.0.1 | Triangulering av ytor | ISC | Mapbox | `LICENSES/earcut-ISC.txt` |
| polygon-clipping | 0.15.7 | Booleska operationer på polygoner | MIT | Mike Fogel, Alexander Milevski | `LICENSES/polygon-clipping-MIT.txt` |
| splaytree | 3.2.3 | (via polygon-clipping) | MIT | Alexander Milevski | `LICENSES/splaytree-MIT.txt` |
| robust-predicates | 3.0.3 | (via polygon-clipping) | Unlicense (allmän egendom) | Vladimir Agafonkin | `LICENSES/robust-predicates-Unlicense.txt` |
| Workbox (workbox-window, -core, -precaching, -routing, -strategies) | 7.4.1 | Offline (service worker, via vite-plugin-pwa) | MIT | Google LLC | `LICENSES/workbox-MIT.txt` |

Verktygen som bara används när appen byggs och testas (Vite, TypeScript,
Vitest, vite-plugin-pwa, vite-plugin-singlefile med flera, se
`devDependencies` i `package.json`) följer inte med appen.

## Typsnitt

| Typsnitt | Används till | Licens | Upphov | Licenstext |
|---|---|---|---|---|
| osifont (delmängd) | Ritningens text, ISO 3098 (skärm och PDF) | GPL-3.0 med typsnittsundantag | hikikomori82 och bidragsgivarna, https://github.com/hikikomori82/osifont | `src/fonts/LICENSE-osifont.txt`, `LICENSES/GPL-3.0.txt` |
| Archivo | Gränssnittet | SIL OFL 1.1 | The Archivo Project Authors | `src/fonts/LICENSE-archivo.txt` |
| IBM Plex Mono | Gränssnittet | SIL OFL 1.1 | IBM Corp. | `src/fonts/LICENSE-ibm-plex-mono.txt` |
| Arimo (delmängd) | Text i PDF (valbart typsnitt) | SIL OFL 1.1 | The Arimo Project Authors | `src/fonts/OFL-arimo.txt` |
| Josefin Sans (delmängd) | Text i PDF (valbart typsnitt) | SIL OFL 1.1, reserverat namn "Josefin Sans" | The Josefin Sans Project Authors | `src/fonts/OFL-josefin.txt` |

**osifont och ritningarna:** typsnittsundantaget gör att dokument där
typsnittet bäddas in, som PDF:er och utskrifter, inte blir GPL. Användarnas
ritningar påverkas inte.

**osifont och kommersiella undantag:** osifont är en egen fil som appen
läser in och ingår inte i ett sålt undantag. En köpare skickar med osifont
oförändrat under dess egen licens eller byter typsnitt.

## Underlag i repot (följer inte med appen)

| Fil | Vad | Licens | Upphov |
|---|---|---|---|
| `docs/ifc/pset_definitions.csv` | Egenskapsuppsättningarna i IFC4, för `docs/ifc/strikt.py` | MIT | buildingSMART International Ltd (`docs/ifc/pset_definitions.LICENSE.txt`) |
