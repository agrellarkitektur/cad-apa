import type { Element, ProjectDoc } from '../core/model';
import { resolveParams } from '../elements/registry';
import { dimensionSegments, type DimensionParams, type TextParams } from '../elements/annotation';
import type { ScaleBarParams } from '../elements/scaleBar';
import type { StampParams } from '../elements/stamp';
import { stampsOf } from '../core/sheets';
import { viewSource } from '../repr/sheet';
import { escapeHtml } from './labels';
import { numberField } from './fieldMarkup';

/**
 * Egenskaperna för mått, text, skalstock och stämpel (granskningen efter
 * 0.10.12, förut i `selectionFields.ts`). Bara HTML; ändringarna görs i
 * `selectionEdits.ts`.
 */
export function annotationFields(doc: ProjectDoc, el: Element): string {
  switch (el.type) {
    case 'Dimension': {
      const p = resolveParams<DimensionParams>(doc, el);
      const segs = dimensionSegments(doc, p);
      const linked = p.points.some((q) => !Array.isArray(q));
      return `<div class="fields">${segs.map((sg, k) => numberField(`dimseg:${k}`, segs.length > 1 ? `Mått ${k + 1}` : 'Mått', sg.value, 'mm')).join('')}</div>
        <p class="note">${linked ? 'Måttet följer väggar och öppningar. Skriv ett nytt värde så flyttas det som måttet pekar på.' : 'Fritt mått. Skriv ett nytt värde så flyttas måttpunkten.'}</p>`;
    }
    case 'Text': {
      const p = resolveParams<TextParams>(doc, el);
      const opt = (cur: string, v: string, label: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
      const align = p.align ?? 'start';
      const anchor = p.anchor ?? '';
      return `<label class="field" for="f-text-text"><span>Text</span><textarea id="f-text-text" data-key="text:text" rows="2">${escapeHtml(p.text)}</textarea></label>
        <div class="fields">${numberField('param:height', 'Texthöjd på papper', p.height, 'mm', 2)}${numberField('param:angle', 'Vridning', p.angle, '°')}
        <label class="field"><span>Justering</span><select data-key="text:align">${opt(align, 'start', 'Vänster')}${opt(align, 'middle', 'Mitten')}${opt(align, 'end', 'Höger')}</select></label>
        <label class="field"><span>Förankring</span><select data-key="text:anchor">${opt(anchor, '', 'Första radens baslinje')}${opt(anchor, 'top', 'Överkant')}${opt(anchor, 'middle', 'Mitt')}${opt(anchor, 'bottom', 'Underkant')}</select></label></div>
        <label class="check"><input type="checkbox" data-key="param:bold"${p.bold ? ' checked' : ''}> Fet stil</label>
        <h3>Textruta</h3>
        <div class="fields">${numberField('param:maxWidth', 'Största bredd', p.maxWidth ?? 0, 'mm', 1)}${numberField('param:maxHeight', 'Största höjd', p.maxHeight ?? 0, 'mm', 1)}</div>
        <p class="note">Mått på papperet; 0 är ingen gräns. Raderna bryts vid ord. Ryms texten inte i höjden visas en röd ram på skärmen, som inte skrivs ut.</p>`;
    }
    case 'ScaleBar': {
      const p = resolveParams<ScaleBarParams>(doc, el);
      const sheet = doc.sheets.find((s) => s.id === el.space);
      const vps = sheet?.viewports ?? [];
      const current = p.view && vps.some((v) => v.id === p.view) ? p.view : '';
      const opt = (v: string, label: string) => `<option value="${escapeHtml(v)}"${v === current ? ' selected' : ''}>${escapeHtml(label)}</option>`;
      const vpName = (vp: (typeof vps)[number]) => `${vp.title?.trim() || viewSource(doc, vp.view)?.name || 'Vyn'} · 1:${vp.scale}`;
      return `<label class="field"><span>Skala från</span><select data-key="scalebar:view">${vps.map((vp) => opt(vp.id, vpName(vp))).join('')}${opt('', 'Egen skala')}</select></label>
        ${current ? '' : `<div class="fields">${numberField('scalebar:scale', 'Skala 1:', p.scale, '')}</div>`}
        <p class="note">${current ? 'Skalstocken följer vyns skala, också när den ändras.' : 'Skriv skalans nämnare, t.ex. 100 för 1:100.'} Skalstocken är 100 mm lång och delas in som Agrell Arkitekturs skalstockar. Dra den dit den ska; den går att flytta när som helst.</p>`;
    }
    case 'Stamp': {
      const p = resolveParams<StampParams>(doc, el);
      const stamps = stampsOf(doc);
      const known = stamps.some((w) => w.id === p.stamp);
      return `<label class="field"><span>Stämpel</span><select data-key="stamp:stamp">${known ? '' : '<option selected>Finns inte längre</option>'}${stamps.map((w) => `<option value="${w.id}"${w.id === p.stamp ? ' selected' : ''}>${escapeHtml(w.name)}</option>`).join('')}</select></label>
        <div class="row"><button class="btn" data-action="open-stamp"${known ? '' : ' disabled'}>Öppna stämpeln</button></div>
        <p class="note">Stämpeln ritas en gång och ändras på alla blad den ligger på. Dra den dit den ska.</p>`;
    }
    default:
      return '';
  }
}
