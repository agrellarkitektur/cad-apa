import { defaultSheet } from '../../core/viewCategories';
import { emptyProject, SITE_STOREY } from '../../core/model';
import { CONTOUR_STEPS, DEFAULT_CONTOURS, GROUND_DEFAULTS, groundAt, groundDefaults, terrainOf, toRh, type GroundDefaults } from '../../core/site';
import { finishedTerrain, groundObjects, m3, showsProposal } from '../../elements/ground';
import { applySitePackage, cropSite, parseSitePackage, removeSite, sameSite, siteProjectName, SitePackageError, updateSite, type Platspaket } from '../../core/siteImport';
import { DocStore } from '../../core/store';
import { buildingFootprint } from '../../elements/footprint';
import { createContext } from '../../repr/context';
import { meanGround } from '../../repr/terrain';
import { meanGroundLevel, northOf } from '../../core/site';
import { buildingHeight } from '../../repr/buildingHeight';
import { forgetProjectFile } from '../../storage/projectFile';
import { askChoice, askConfirm, dialog } from '../ask';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';
import { defaultState } from './helpers';
import { orthoFromWorld, orthoShowOf, orthoTouchesSite, parseWorldFile, setSiteOrtho } from '../../core/siteOrtho';
import { imageAsset, ORTHO_MAX_PX, pickFiles } from './imageFile';

/**
 * Platsen ur Höjdkurvor (0.10.3): ta emot platspaketet (fil, dra och släpp
 * eller meddelande från Höjdkurvors flik) och dialogen Platsen.
 */

/**
 * Höjdkurvors ursprung, som meddelanden tas emot från och skickas till.
 * Samma webbhotell som cad-apa (agrellarkitektur.se/terrang/) och senare
 * höjdkurvor.se.
 */
export const HOJDKURVOR_ORIGINS = ['https://agrellarkitektur.se', 'https://www.agrellarkitektur.se', 'https://xn--hjdkurvor-07a.se', 'https://www.xn--hjdkurvor-07a.se'];
/** Höjdkurvors adress, för skissen tillbaka (senare). */
export const HOJDKURVOR_URL = 'https://agrellarkitektur.se/terrang/';
const IMPORT_HASH = '#hojdkurvor-import';

/** Väderstrecket en riktning i modellen pekar åt, när norr ligger åt `north` (grader moturs från x-axeln). */
export function compass(dir: readonly [number, number], north: number): string {
  const a = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
  // Medurs från norr.
  const b = (((north - a) % 360) + 360) % 360;
  return ['norr', 'nordost', 'öster', 'sydost', 'söder', 'sydväst', 'väster', 'nordväst'][Math.round(b / 45) % 8];
}

const mf = (n: number, d = 3) => n.toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d });
const coord = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 3 });

export function installSite(app: AppContext) {
  /** Lägg in ett platspaket: fråga först om det öppna projektet ska ersättas. */
  async function receive(input: string | unknown): Promise<boolean> {
    let pkg: Platspaket;
    try {
      pkg = parseSitePackage(input);
    } catch (e) {
      app.hint(e instanceof SitePackageError ? e.message : 'Platsfilen gick inte att läsa.', 6000);
      return false;
    }
    const doc = app.store.doc;
    const name = siteProjectName(pkg);
    const choice = await askChoice(
      'Platsen ur Höjdkurvor',
      sameSite(doc, pkg)
        ? `${name} är samma plats som i ${doc.project.name}. Uppdatera platsen i projektet (huset står kvar), eller börja ett nytt projekt?`
        : doc.site
          ? `${doc.project.name} har redan en plats. Börja ett nytt projekt med ${name}, eller byt platsen i det öppna projektet (nollpunkten och ±0 behålls i samma koordinatsystem)?`
          : `Börja ett nytt projekt med ${name}, eller lägg platsen i ${doc.project.name}? Nollpunkten blir modellens origo.`,
      sameSite(doc, pkg)
        ? [
            { value: 'here', label: 'Uppdatera platsen' },
            { value: 'new', label: 'Nytt projekt' },
          ]
        : [
            { value: 'new', label: 'Nytt projekt' },
            { value: 'here', label: doc.site ? 'Byt platsen' : 'Lägg i det öppna' },
          ],
    );
    if (!choice) return false;
    if (choice === 'new') {
      const fields: Record<string, string> = {};
      const fresh = new DocStore(emptyProject(name, 'nybyggnad', fields));
      applySitePackage(fresh, pkg);
      forgetProjectFile();
      app.ui.state = defaultState(fresh.doc);
      // Platsen öppnas (0.10.25), med det som kom ur Höjdkurvor.
      app.ui.storey = SITE_STOREY;
      app.store.load(fresh.doc);
    } else {
      applySitePackage(app.store, pkg);
      app.goTo({ kind: 'storey', id: SITE_STOREY });
    }
    app.view.zoomToFit();
    const t = terrainOf(app.store.doc);
    const parts = [
      `Platsen är inlagd${t ? `, marken ${mf(t.min, 1)}–${mf(t.max, 1)} i RH 2000` : ' utan markmodell'}.`,
      `±0 är ${mf(app.store.doc.site!.datum)}; ändra i Platsens inställningar (högerklicka på Platsen i projektträdet).`,
      pkg.fastigheter?.varning ? 'Fastighetsgränserna är inte inmätta och kan avvika flera meter.' : '',
    ];
    app.hint(parts.filter(Boolean).join(' '), 8000);
    return true;
  }

  /** Välj en platsfil (.hkplats.json) att lägga in. */
  function chooseFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (f) await receive(await f.text());
    });
    input.click();
  }

  /**
   * Medelmarknivån längs husets kontur (mm från ±0) mot den befintliga och
   * (0.10.4) den färdiga marken i tillståndet som visas, om det finns ett hus,
   * och schakt och fyll för markobjekten.
   */
  function mmn(): { z: number | null; existing: number | null; finished: number | null; house: boolean; volumes: { cut: number; fill: number } | null; objects: number; bh: ReturnType<typeof buildingHeight> } {
    const doc = app.store.doc;
    const { ctx } = createContext(doc, doc.storeys[0].id, app.viewStates(), defaultSheet(doc.graphics), () => true);
    const f = showsProposal(ctx) ? finishedTerrain(ctx) : null;
    const existing = meanGround(ctx, true);
    const finished = f ? meanGroundLevel(f.terrain, buildingFootprint(ctx).map((poly) => poly[0])) : null;
    let volumes: { cut: number; fill: number } | null = null;
    if (f) {
      volumes = { cut: 0, fill: 0 };
      for (const v of f.volumes.values()) {
        volumes.cut += v.cut;
        volumes.fill += v.fill;
      }
    }
    return { z: meanGround(ctx), existing, finished, house: buildingFootprint(ctx).length > 0, volumes, objects: groundObjects(ctx).length, bh: buildingHeight(ctx) };
  }

  /**
   * Knapparna som sätter ±0 till medelmarknivån (0.10.8b): den nya markens
   * (med markobjekten), och den befintligas bredvid när de skiljer sig.
   */
  function mmnButtons(m: ReturnType<typeof mmn>): string {
    const site = app.store.doc.site!;
    const cm = (z: number) => mf(Math.round(toRh(site, z) * 100) / 100);
    const out: string[] = [];
    const main = m.finished ?? m.existing;
    if (main !== null) out.push(`<button type="button" class="btn" data-site-mmn="${cm(main)}" title="Sätt ±0 till ${m.finished !== null ? 'den nya markens' : 'markens'} medelmarknivå längs huset (+${cm(main)}), avrundad till centimeter">Medelmarknivån</button>`);
    if (m.finished !== null && m.existing !== null && cm(m.finished) !== cm(m.existing)) out.push(`<button type="button" class="btn" data-site-mmn="${cm(m.existing)}" title="Sätt ±0 till den befintliga markens medelmarknivå längs huset (+${cm(m.existing)})">Befintlig</button>`);
    return out.join('');
  }

  /** Dialogen Platsen: varifrån, koordinatsystem, ±0, höjdkurvor, beskärning, licens. */
  async function showDialog(over?: { datum?: number }): Promise<void> {
    const doc = app.store.doc;
    const site = doc.site;
    if (!site) {
      const r = await askChoice('Platsen', 'Projektet har ingen plats. Spara en platsfil i Höjdkurvor (Spara platsfil för cad-apa) och lägg in den här, eller välj Fortsätt rita i cad-apa där.', [{ value: 'file', label: 'Lägg in platsfil…' }]);
      if (r === 'file') chooseFile();
      return;
    }
    const t = terrainOf(doc);
    const m = mmn();
    const src = site.source;
    const interval = site.contours ?? DEFAULT_CONTOURS;
    const row = (k: string, v: string) => `<dt>${escapeHtml(k)}</dt><dd>${v}</dd>`;
    const html = `<header><h2>Platsen</h2></header>
      <div class="dialog-body site-dialog-body">
        <dl class="site-facts">
          ${row('Plats', escapeHtml([src.name, src.kommun].filter(Boolean).join(', ') || '–'))}
          ${row('Från', escapeHtml([src.kalla, src.created ? new Date(src.created).toLocaleDateString('sv-SE') : ''].filter(Boolean).join(', ') || 'Höjdkurvor'))}
          ${row('Koordinatsystem', `${escapeHtml(site.crs.name)} (EPSG:${site.crs.epsg}), ${escapeHtml(site.crs.height)}`)}
          ${row('Nollpunkt', `N ${coord(site.origin[1])}, E ${coord(site.origin[0])}`)}
          ${row('Vridning och sann nord', `${mf(site.rotation, 2)}°, sann nord ${mf(site.trueNorth, 3)}°`)}
          ${row('Markmodell', t ? `${t.grid.W} × ${t.grid.H} punkter, ${mf(t.grid.s, 2)} m mellan, ${mf(t.min, 2)}–${mf(t.max, 2)} m` : 'Ingen (skapa underlaget i Höjdkurvor)')}
          ${row('Medelmarknivå', m.z !== null ? `+${mf(toRh(site, m.z))} längs husets kontur (${m.z >= 0 ? '+' : '−'}${mf(Math.abs(m.z) / 1000)} från ±0)${m.finished !== null && m.existing !== null ? `; färdig mark +${mf(toRh(site, m.finished))}, befintlig +${mf(toRh(site, m.existing))}` : ''}` : m.house ? 'Ingen mark under huset' : 'Rita huset först')}
          ${m.bh && m.bh.height !== null ? row('Byggnadshöjd', `${mf(m.bh.height / 1000, 2)} m enligt PBF utan språng, på fasaden mot ${compass(m.bh.main.out, northOf(site))} (${m.bh.basis ? 'den beräkningsgrundande' : 'den längsta; rita en beräkningsgrundande fasad med verktyget Fasad'}), +${mf(toRh(site, m.bh.main.z))}. Nockhöjd ${mf((m.bh.ridge - (m.z ?? 0)) / 1000, 2)} m. Undantagen (kupor, allmän plats närmare än 6 m) bedöms för hand.`) : ''}
          ${row('Ortofoto', site.ortho ? `${site.ortho.year ? `Flygår ${site.ortho.year}, ` : ''}${mf(site.ortho.s, 2)} m per pixel, ${mf((site.ortho.W * site.ortho.s), 0)} × ${mf(site.ortho.H * site.ortho.s, 0)} m` : 'Inget')}
          ${m.volumes ? row('Schakt och fyll', `${m3(m.volumes.cut)} schakt, ${m3(m.volumes.fill)} fyll (${m.objects} markobjekt i tillståndet som visas)`) : ''}
        </dl>
        <label class="site-field"><span>±0, plan 1:s golv, i RH 2000 (m)</span><span class="site-datum"><input class="ask-input" data-site="datum" inputmode="decimal" value="${mf(over?.datum ?? site.datum)}">${t ? `<button type="button" class="btn" data-site-action="pick" title="Klicka på marken i planen; höjden där blir ±0, avrundad till centimeter. Den kan ändras här efteråt.">Klicka i planen</button>` : ''}${mmnButtons(m)}</span></label>
        ${t ? `<label class="site-field"><span>Höjdkurvor var</span><select data-site="contours">${CONTOUR_STEPS.map((c) => `<option value="${c}"${c === interval ? ' selected' : ''}>${mf(c / 1000, 2)} m</option>`).join('')}</select></label>` : ''}
        ${t ? `<div class="site-field site-crop"><span>Beskär markmodellen till</span><input class="ask-input" data-site="crop" inputmode="decimal" value="30"><span>m runt huset</span><button type="button" class="btn" data-site-action="crop"${m.house ? '' : ' disabled title="Rita huset först"'}>Beskär</button></div>` : ''}
        <div class="site-field site-ortho"><span>Ortofotot i 3D</span>${
          site.ortho
            ? `<select data-site="ortho"><option value="base"${orthoShowOf(site) === 'base' ? ' selected' : ''}>Där marken saknar material</option><option value="all"${orthoShowOf(site) === 'all' ? ' selected' : ''}>Över hela marken</option><option value="off"${orthoShowOf(site) === 'off' ? ' selected' : ''}>Av</option></select><button type="button" class="btn" data-site-action="ortho-remove">Ta bort</button>`
            : ''
        }<button type="button" class="btn" data-site-action="ortho" title="Bilden (JPG eller PNG) och dess världsfil (.jgw), t.ex. ur mappen ortofoto i Höjdkurvors zip. Välj båda filerna samtidigt.">${site.ortho ? 'Byt…' : 'Lägg in…'}</button></div>
        ${t ? groundSettings(site.ground, site.meanOnExisting, site.earthHatch ? 'hatch' : site.earthWhite ? 'white' : 'none') : ''}
        ${site.boundaryWarning ? `<p class="site-note">${escapeHtml(site.boundaryWarning)}</p>` : ''}
        ${site.licence ? `<p class="site-note">${escapeHtml(site.licence)} Skriv <code>{licens}</code> i en text på bladet eller mallbladet för att få med den.</p>` : ''}
        ${src.link ? `<p class="site-note"><a href="${escapeHtml(src.link)}" target="_blank" rel="noopener">Öppna platsen i Höjdkurvor</a></p>` : ''}
      </div>
      <footer><button type="button" class="btn" data-site-action="remove">Ta bort platsen</button><button type="button" class="btn" data-site-action="file">Uppdatera ur fil…</button><div class="spacer"></div><button type="button" class="btn" data-cancel>Avbryt</button><button type="submit" class="btn btn-primary">Spara</button></footer>`;
    const r = await dialog(html, (form, done) => {
      form.classList.add('site-dialog');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const datum = Number(form.querySelector<HTMLInputElement>('[data-site="datum"]')!.value.replace(/\s/g, '').replace(',', '.').replace('−', '-'));
        if (!Number.isFinite(datum)) {
          app.hint('±0 ska vara en höjd i meter, t.ex. 63,800.', 4000);
          return;
        }
        const c = form.querySelector<HTMLSelectElement>('[data-site="contours"]');
        const patch: Parameters<typeof updateSite>[1] = { datum: Math.round(datum * 1000) / 1000, ...(c ? { contours: Number(c.value) } : {}) };
        // Markobjektens förval (0.10.4): bara de som skiljer sig från programmets sparas.
        if (t) {
          const ground: Partial<GroundDefaults> = {};
          for (const k of Object.keys(GROUND_DEFAULTS) as (keyof GroundDefaults)[]) {
            const input = form.querySelector<HTMLInputElement>(`[data-ground="${k}"]`);
            const v = input ? Number(input.value.replace(/\s/g, '').replace(',', '.')) : NaN;
            if (Number.isFinite(v) && v > 0 && v !== GROUND_DEFAULTS[k]) ground[k] = v;
          }
          patch.ground = Object.keys(ground).length ? ground : undefined;
          patch.meanOnExisting = form.querySelector<HTMLSelectElement>('[data-site="mean"]')?.value === 'existing' || undefined;
          const earth = form.querySelector<HTMLSelectElement>('[data-site="earth"]')?.value;
          patch.earthHatch = earth === 'hatch' || undefined;
          patch.earthWhite = earth === 'white' || undefined;
        }
        // Ortofotot i 3D (0.10.31).
        const ortho = form.querySelector<HTMLSelectElement>('[data-site="ortho"]')?.value as 'base' | 'all' | 'off' | undefined;
        if (site.ortho && ortho && ortho !== orthoShowOf(site)) {
          const o = { ...site.ortho };
          if (ortho === 'base') delete o.show;
          else o.show = ortho;
          patch.ortho = o;
        }
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => JSON.stringify(patch[k]) !== JSON.stringify(site[k]));
        if (changed) updateSite(app.store, patch);
        done('saved');
      });
      form.querySelectorAll<HTMLButtonElement>('[data-site-mmn]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.preventDefault();
          form.querySelector<HTMLInputElement>('[data-site="datum"]')!.value = b.dataset.siteMmn!;
        }),
      );
      form.querySelectorAll<HTMLButtonElement>('[data-site-action]').forEach((b) =>
        b.addEventListener('click', () => {
          const a = b.dataset.siteAction;
          if (a === 'crop') {
            const margin = Number(form.querySelector<HTMLInputElement>('[data-site="crop"]')!.value.replace(',', '.')) * 1000;
            done(`crop:${Number.isFinite(margin) && margin > 0 ? margin : 30000}`);
          } else done(a!);
        }),
      );
    });
    if (r === 'remove') {
      if (await askConfirm('Ta bort platsen', 'Markmodellen, grannhusen, träden och fastighetsgränserna tas bort. Huset och norrpilen står kvar.')) removeSite(app.store);
    } else if (r === 'file') chooseFile();
    else if (r === 'ortho') await chooseOrtho();
    else if (r === 'ortho-remove') setSiteOrtho(app.store, null);
    else if (r === 'pick') pickDatum();
    else if (r?.startsWith('crop:')) {
      const margin = Number(r.slice(5));
      const d = app.store.doc;
      const { ctx } = createContext(d, d.storeys[0].id, app.viewStates(), defaultSheet(d.graphics), () => true);
      const pts = buildingFootprint(ctx).flatMap((poly) => poly[0]);
      if (!pts.length) return;
      const box = {
        minX: Math.min(...pts.map((p) => p[0])) - margin,
        minY: Math.min(...pts.map((p) => p[1])) - margin,
        maxX: Math.max(...pts.map((p) => p[0])) + margin,
        maxY: Math.max(...pts.map((p) => p[1])) + margin,
      };
      const ok = await askConfirm('Beskär markmodellen', `Markmodellen och det som kom med platsen beskärs till ${mf(margin / 1000, 0)} m runt huset. Det går att ångra, men inte att få tillbaka efter att projektet sparats utan att lägga in platsen igen.`, 'Beskär');
      if (ok && !cropSite(app.store, box)) app.hint('Rutan täcker inte markmodellen.', 4000);
    }
  }

  /**
   * Ortofotot för hand (0.10.31): bilden och världsfilen, valda samtidigt.
   * Världsfilen kan vara i zonens koordinater eller lokal (Höjdkurvors
   * `_lokal.jgw`, meter från nollpunkten).
   */
  async function chooseOrtho(): Promise<void> {
    const site = app.store.doc.site;
    if (!site) return;
    const files = await pickFiles('.jpg,.jpeg,.png,.jgw,.pgw,.wld,image/jpeg,image/png', true);
    if (!files.length) return;
    const image = files.find((f) => /\.(jpe?g|png)$/i.test(f.name) || f.type.startsWith('image/'));
    const world = files.find((f) => /\.(jgw|pgw|jpgw|pngw|wld)$/i.test(f.name));
    if (!image || !world) {
      app.hint('Välj både bilden och dess världsfil (.jgw) samtidigt, t.ex. ur mappen ortofoto i Höjdkurvors zip.', 6000);
      return;
    }
    const w = parseWorldFile(await world.text());
    if (!w) {
      app.hint(`${world.name} gick inte att läsa som världsfil, eller bilden är vriden.`, 5000);
      return;
    }
    try {
      const img = await imageAsset(image, ORTHO_MAX_PX, 'orto', `${site.source.name ?? 'Platsen'} – ortofoto`);
      const ortho = orthoFromWorld(w, img.width, img.height, site);
      if (!orthoTouchesSite(ortho, site)) {
        app.hint('Ortofotot ligger inte över platsen. Är världsfilen för samma koordinatsystem?', 6000);
        return;
      }
      setSiteOrtho(app.store, { asset: img.asset, ortho });
      app.hint('Ortofotot är inlagt och syns på marken i 3D.', 4000);
    } catch (e) {
      app.hint(`${image.name}: ${(e as Error).message}`, 5000);
    }
  }

  /**
   * ±0 med ett klick (0.10.8): ett tillfälligt verktyg i planen. Klicket
   * läser den befintliga marken där, och dialogen öppnas igen med höjden
   * ifylld, så att den kan ändras innan den sparas. Esc avbryter.
   */
  function pickDatum(): void {
    const t = terrainOf(app.store.doc);
    if (!t) return;
    if (app.ui.mode === '3d' || app.view.currentTool === app.sheets.tool) {
      app.hint('Öppna en plan för att klicka på marken.', 4000);
      return;
    }
    const back = (): void => {
      window.removeEventListener('keydown', onKey, true);
      app.view.setTool(app.toolFor(app.ui.tool));
      app.view.requestRender();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      back();
      app.hint('±0 är oförändrat.', 2500);
    };
    window.addEventListener('keydown', onKey, true);
    app.view.setTool({
      cursor: 'crosshair',
      down: () => 'capture',
      up: (p) => {
        const z = groundAt(t, p.model[0], p.model[1]);
        if (z === null) {
          app.hint('Ingen markmodell där. Klicka på marken, eller Esc.', 3000);
          return;
        }
        back();
        void showDialog({ datum: Math.round(toRh(t.site, z) * 100) / 100 });
      },
    });
    app.hint('Klicka på marken där ±0 ska ligga (den befintliga marken). Esc avbryter.', 5000);
  }

  // Från Höjdkurvor (Fortsätt rita i cad-apa): säg att vi är redo, ta emot platsen och kvittera.
  if (location.hash === IMPORT_HASH && window.opener) {
    history.replaceState(null, '', location.pathname + location.search);
    const allowed = new Set([location.origin, ...HOJDKURVOR_ORIGINS]);
    window.addEventListener('message', (e) => {
      if (!allowed.has(e.origin) || (e.data as { typ?: string })?.typ !== 'hojdkurvor:plats') return;
      const reply = (msg: object) => (e.source as Window | null)?.postMessage(msg, e.origin);
      try {
        parseSitePackage((e.data as { data?: unknown }).data);
        reply({ typ: 'cad-apa:mottaget', ok: true });
      } catch (err) {
        reply({ typ: 'cad-apa:mottaget', ok: false, fel: err instanceof Error ? err.message : 'Platsen gick inte att läsa.' });
        app.hint(err instanceof Error ? err.message : 'Platsen gick inte att läsa.', 6000);
        return;
      }
      void receive((e.data as { data: unknown }).data);
    });
    for (const o of allowed) {
      try {
        window.opener.postMessage({ typ: 'cad-apa:redo', version: 1 }, o);
      } catch {
        // Ett ursprung som inte går att skicka till: hoppa över.
      }
    }
  }

  return { receive, chooseFile, showDialog };
}

/** Markobjektens förval och valen för den färdiga marken (0.10.4) i dialogen Platsen. */
function groundSettings(own: Partial<GroundDefaults> | undefined, meanOnExisting: boolean | undefined, earth: 'none' | 'hatch' | 'white'): string {
  const d = groundDefaults({ ground: own });
  const field = (k: keyof GroundDefaults, label: string, unit: string) =>
    `<label class="site-field"><span>${label}</span><span class="input-unit"><input class="ask-input" data-ground="${k}" inputmode="decimal" value="${d[k].toLocaleString('sv-SE')}"><i>${unit}</i></span></label>`;
  return `<fieldset class="site-ground"><legend>Markobjekt</legend>
      <div class="site-ground-grid">
        ${field('slope', 'Slänt', '1:N')}${field('fall', 'Fall från huset', '1:N')}${field('fallLength', 'Fallet gäller ut', 'mm')}
        ${field('distance', 'Markyta runt huset ut', 'mm')}${field('sockel', 'Sockel', 'mm')}${field('margin', 'Arbetsutrymme', 'mm')}
        ${field('rampMax', 'Brantaste ramp/väg', '1:N')}${field('walkMax', 'Vilplan brantare än', '1:N')}${field('landingRise', 'Vilplan var', 'mm höjd')}
        ${field('blend', 'Höjdpunkt och brytlinje tonas', 'mm')}${field('wallThickness', 'Stödmurens tjocklek', 'mm')}${field('easeRadius', 'Rampens mjuka övergångar, radie', 'mm')}
        ${field('steepSlope', 'Branta slänter i befintlig mark från', '1:N')}
        ${field('markSpacing', 'Släntstreckens avstånd', 'mm på papper')}
      </div>
      <p class="site-note">Ramp 1:12 och gångväg 1:20 med vilplan var 0,5 m höjd är förval efter Boverkets regler om tillgänglighet (ALM och BBR); kontrollera mot det som gäller i projektet. De branta slänterna tänds per vy under Visa, Platsen. Litterats siffror och markhöjdernas decimaler står i stilboken under Allmänt.</p>
      <label class="site-field"><span>Medelmarknivån mot</span><select data-site="mean"><option value="finished">Färdig mark</option><option value="existing"${meanOnExisting ? ' selected' : ''}>Befintlig mark</option></select></label>
      <label class="site-field"><span>Jord under marklinjen i sektionerna</span><select data-site="earth">${(
        [
          ['none', 'Ingen'],
          ['hatch', 'Skrafferad'],
          ['white', 'Vit (bara snittlinjen)'],
        ] as const
      )
        .map(([v, l]) => `<option value="${v}"${v === earth ? ' selected' : ''}>${l}</option>`)
        .join('')}</select></label>
      <p class="site-note">Förvalen gäller markobjekt som inte har egna värden. Den färdiga marken räknas ur den befintliga och markobjekten i förslaget; den befintliga ändras aldrig.</p>
    </fieldset>`;
}
