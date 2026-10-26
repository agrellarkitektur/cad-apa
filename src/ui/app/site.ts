import { emptyProject } from '../../core/model';
import { CONTOUR_STEPS, DEFAULT_CONTOURS, GROUND_DEFAULTS, groundDefaults, terrainOf, toRh, type GroundDefaults } from '../../core/site';
import { finishedTerrain, groundObjects, m3, showsProposal } from '../../elements/ground';
import { applySitePackage, cropSite, parseSitePackage, removeSite, sameSite, siteProjectName, SitePackageError, updateSite, type Platspaket } from '../../core/siteImport';
import { DocStore } from '../../core/store';
import { buildingFootprint } from '../../elements/footprint';
import { createContext } from '../../repr/context';
import { meanGround } from '../../repr/terrain';
import { meanGroundLevel } from '../../core/site';
import { forgetProjectFile } from '../../storage/projectFile';
import { askChoice, askConfirm, dialog } from '../ask';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';
import { defaultState } from './helpers';

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
      app.ui.storey = fresh.doc.storeys[0].id;
      app.store.load(fresh.doc);
    } else applySitePackage(app.store, pkg);
    app.view.zoomToFit();
    const t = terrainOf(app.store.doc);
    const parts = [
      `Platsen är inlagd${t ? `, marken ${mf(t.min, 1)}–${mf(t.max, 1)} i RH 2000` : ' utan markmodell'}.`,
      `±0 är ${mf(app.store.doc.site!.datum)}; ändra under Platsen i menyn.`,
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
  function mmn(): { z: number | null; existing: number | null; finished: number | null; house: boolean; volumes: { cut: number; fill: number } | null; objects: number } {
    const doc = app.store.doc;
    const { ctx } = createContext(doc, doc.storeys[0].id, app.viewStates(), doc.graphics, () => true);
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
    return { z: meanGround(ctx), existing, finished, house: buildingFootprint(ctx).length > 0, volumes, objects: groundObjects(ctx).length };
  }

  /** Dialogen Platsen: varifrån, koordinatsystem, ±0, höjdkurvor, beskärning, licens. */
  async function showDialog(): Promise<void> {
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
          ${m.volumes ? row('Schakt och fyll', `${m3(m.volumes.cut)} schakt, ${m3(m.volumes.fill)} fyll (${m.objects} markobjekt i tillståndet som visas)`) : ''}
        </dl>
        <label class="site-field"><span>±0, plan 1:s golv, i RH 2000 (m)</span><span class="site-datum"><input class="ask-input" data-site="datum" inputmode="decimal" value="${mf(site.datum)}">${m.existing !== null ? `<button type="button" class="btn" data-site-mmn="${mf(Math.round(toRh(site, m.existing) * 100) / 100)}" title="Sätt ±0 till den befintliga markens medelmarknivå längs huset, avrundad till centimeter">Medelmarknivån</button>` : ''}</span></label>
        ${t ? `<label class="site-field"><span>Höjdkurvor var</span><select data-site="contours">${CONTOUR_STEPS.map((c) => `<option value="${c}"${c === interval ? ' selected' : ''}>${mf(c / 1000, 2)} m</option>`).join('')}</select></label>` : ''}
        ${t ? `<div class="site-field site-crop"><span>Beskär markmodellen till</span><input class="ask-input" data-site="crop" inputmode="decimal" value="30"><span>m runt huset</span><button type="button" class="btn" data-site-action="crop"${m.house ? '' : ' disabled title="Rita huset först"'}>Beskär</button></div>` : ''}
        ${t ? groundSettings(site.ground, site.meanOnExisting, site.earthHatch) : ''}
        ${site.boundaryWarning ? `<p class="site-note">${escapeHtml(site.boundaryWarning)}</p>` : ''}
        ${site.licence ? `<p class="site-note">${escapeHtml(site.licence)}</p>` : ''}
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
          patch.earthHatch = form.querySelector<HTMLInputElement>('[data-site="earth"]')?.checked || undefined;
        }
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => JSON.stringify(patch[k]) !== JSON.stringify(site[k]));
        if (changed) updateSite(app.store, patch);
        done('saved');
      });
      form.querySelector<HTMLButtonElement>('[data-site-mmn]')?.addEventListener('click', (e) => {
        e.preventDefault();
        form.querySelector<HTMLInputElement>('[data-site="datum"]')!.value = (e.currentTarget as HTMLButtonElement).dataset.siteMmn!;
      });
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
    else if (r?.startsWith('crop:')) {
      const margin = Number(r.slice(5));
      const d = app.store.doc;
      const { ctx } = createContext(d, d.storeys[0].id, app.viewStates(), d.graphics, () => true);
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
function groundSettings(own: Partial<GroundDefaults> | undefined, meanOnExisting: boolean | undefined, earth: boolean | undefined): string {
  const d = groundDefaults({ ground: own });
  const field = (k: keyof GroundDefaults, label: string, unit: string) =>
    `<label class="site-field"><span>${label}</span><span class="input-unit"><input class="ask-input" data-ground="${k}" inputmode="decimal" value="${d[k].toLocaleString('sv-SE')}"><i>${unit}</i></span></label>`;
  return `<fieldset class="site-ground"><legend>Markobjekt</legend>
      <div class="site-ground-grid">
        ${field('slope', 'Slänt', '1:N')}${field('fall', 'Fall från huset', '1:N')}${field('fallLength', 'Fallet gäller ut', 'mm')}
        ${field('distance', 'Platå runt huset ut', 'mm')}${field('sockel', 'Sockel', 'mm')}${field('margin', 'Arbetsutrymme', 'mm')}
      </div>
      <label class="site-field"><span>Medelmarknivån mot</span><select data-site="mean"><option value="finished">Färdig mark</option><option value="existing"${meanOnExisting ? ' selected' : ''}>Befintlig mark</option></select></label>
      <label class="check"><input type="checkbox" data-site="earth"${earth ? ' checked' : ''}> Jord under marklinjen i sektionerna</label>
      <p class="site-note">Förvalen gäller markobjekt som inte har egna värden. Den färdiga marken räknas ur den befintliga och markobjekten i förslaget; den befintliga ändras aldrig.</p>
    </fieldset>`;
}
