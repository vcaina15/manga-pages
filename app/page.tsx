'use client';

import { useEffect, useMemo, useState } from 'react';
import { impose, ImposeOptions, MM, CM, INCH } from '@/lib/imposer';

type Kind = 'float' | 'bool' | 'choice' | 'index' | 'index_opt';
interface Ctrl {
  g: string; label: string; kind: Kind; def: any;
  factor?: number; choices?: string[]; hint?: string; section?: string;
}

const GLUE: Ctrl[] = [
  { g: 'trimW', label: 'Trim width', kind: 'float', def: 127, factor: MM, hint: 'mm', section: 'Page & fit' },
  { g: 'trimH', label: 'Trim height', kind: 'float', def: 190, factor: MM, hint: 'mm (used if Match aspect off)' },
  { g: 'matchPageAspect', label: 'Match page aspect', kind: 'bool', def: true, hint: 'box height from your scans' },
  { g: 'fitMode', label: 'Fit mode', kind: 'choice', def: 'fit', choices: ['fit', 'fill'], hint: 'fit = inside; fill = cover+crop' },
  { g: 'fillZoom', label: 'Fill zoom', kind: 'float', def: 1.02, factor: 1, hint: 'fill only; >1 crops more' },
  { g: 'gutter', label: 'Gutter', kind: 'float', def: 14, factor: MM, hint: 'mm (glue)' },
  { g: 'vOffset', label: 'Vertical offset', kind: 'float', def: 0, factor: MM, hint: 'mm (+up/-down)' },
  { g: 'splitSpreads', label: 'Split spreads', kind: 'bool', def: true, hint: 'detect + split spreads', section: 'Spreads' },
  { g: 'spreadDetectAspect', label: 'Spread detect aspect', kind: 'float', def: 1.2, factor: 1, hint: 'w/h cutoff' },
  { g: 'landscapeMode', label: 'Landscape mode', kind: 'choice', def: 'rotate', choices: ['rotate', 'fit_width', 'none'], hint: 'wide pages when split off' },
  { g: 'landscapeRotate', label: 'Landscape rotate', kind: 'choice', def: 'cw', choices: ['cw', 'ccw'] },
  { g: 'coverAsSeparate', label: 'Separate cover', kind: 'bool', def: true, hint: 'cover -> own PDF', section: 'Cover' },
  { g: 'coverSrcIndex', label: 'Front cover page #', kind: 'index', def: 1, hint: '1-based' },
  { g: 'backCoverSrcIndex', label: 'Back cover page #', kind: 'index_opt', def: '', hint: 'blank = blank back' },
  { g: 'appendCoverEnd', label: 'Append end splash', kind: 'bool', def: false },
  { g: 'drawGuides', label: 'Draw guides', kind: 'bool', def: true, section: 'Guides' },
  { g: 'foldCutLine', label: 'Fold/cut line', kind: 'bool', def: true },
  { g: 'trimGuides', label: 'Trim box + crop marks', kind: 'bool', def: true },
  { g: 'cropMarkLen', label: 'Crop mark length', kind: 'float', def: 4, factor: MM, hint: 'mm' },
  { g: 'cropMarkGap', label: 'Crop mark gap', kind: 'float', def: 1.5, factor: MM, hint: 'mm' },
  { g: 'guideGray', label: 'Guide gray', kind: 'float', def: 0.6, factor: 1, hint: '0..1' },
  { g: 'guideWidth', label: 'Guide width', kind: 'float', def: 0.5, factor: 1, hint: 'pt' },
];

const PUNCH: Ctrl[] = [
  { g: 'gutter', label: 'Gutter', kind: 'float', def: 1.5, factor: INCH, hint: 'in (fastener)', section: 'Layout' },
  { g: 'bleed', label: 'Bleed', kind: 'float', def: 0.04, factor: INCH, hint: 'in' },
  { g: 'maxEdgeCrop', label: 'Max edge crop', kind: 'float', def: 0, factor: INCH, hint: 'in; 0 = none' },
  { g: 'vOffset', label: 'Vertical offset', kind: 'float', def: 0, factor: INCH, hint: 'in (+up/-down)' },
  { g: 'splitSpreads', label: 'Split spreads', kind: 'bool', def: true, hint: 'detect + split spreads', section: 'Spreads' },
  { g: 'spreadDetectAspect', label: 'Spread detect aspect', kind: 'float', def: 1.2, factor: 1, hint: 'w/h cutoff' },
  { g: 'coverAsSeparate', label: 'Separate cover', kind: 'bool', def: true, hint: 'cover -> own PDF', section: 'Cover' },
  { g: 'coverSrcIndex', label: 'Front cover page #', kind: 'index', def: 1, hint: '1-based' },
  { g: 'backCoverSrcIndex', label: 'Back cover page #', kind: 'index_opt', def: '', hint: 'blank = blank back' },
  { g: 'appendCoverEnd', label: 'Append end splash', kind: 'bool', def: false },
  { g: 'drawGuides', label: 'Draw guides', kind: 'bool', def: true, section: 'Guides' },
  { g: 'foldCutLine', label: 'Fold/cut line', kind: 'bool', def: true },
  { g: 'punchSpacing', label: 'Punch spacing', kind: 'float', def: 12, factor: CM, hint: 'cm between holes' },
  { g: 'guideGray', label: 'Guide gray', kind: 'float', def: 0.6, factor: 1, hint: '0..1' },
  { g: 'guideWidth', label: 'Guide width', kind: 'float', def: 0.5, factor: 1, hint: 'pt' },
];

function defaults(ctrls: Ctrl[]) {
  const o: Record<string, any> = {};
  ctrls.forEach(c => (o[c.g] = c.kind === 'bool' ? c.def : String(c.def)));
  return o;
}

function coerce(c: Ctrl, raw: any) {
  switch (c.kind) {
    case 'bool': return !!raw;
    case 'choice': return String(raw);
    case 'index': return Math.round(parseFloat(raw)) - 1;
    case 'index_opt': return String(raw).trim() === '' ? null : Math.round(parseFloat(raw)) - 1;
    default: return parseFloat(raw) * (c.factor ?? 1);
  }
}

function PdfPreview({ title, src }: { title: string; src?: string }) {
  if (!src) return null;
  return (
    <div className="preview-card">
      <div className="preview-title">{title}</div>
      <iframe className="preview-frame" src={src} title={title} />
    </div>
  );
}

function Tab({ mode, ctrls }: { mode: 'glue' | 'punch'; ctrls: Ctrl[] }) {
  const [vals, setVals] = useState<Record<string, any>>(() => defaults(ctrls));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ body?: string; cover?: string; text?: string; err?: string }>({});
  const [inputUrl, setInputUrl] = useState<string>();

  const set = (g: string, v: any) => setVals(s => ({ ...s, [g]: v }));

  useEffect(() => {
    if (!file) {
      setInputUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setInputUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (out.body) URL.revokeObjectURL(out.body);
      if (out.cover) URL.revokeObjectURL(out.cover);
    };
  }, [out.body, out.cover]);

  async function run() {
    if (!file) { setOut({ err: 'Choose an input PDF first.' }); return; }
    setBusy(true); setOut({});
    try {
      const opts: any = { mode };
      ctrls.forEach(c => (opts[c.g] = coerce(c, vals[c.g])));
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = await impose(bytes, opts as ImposeOptions);

      const mk = (b: Uint8Array) => {
        const pdfBytes = b.slice();
        return URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
      };
      const s = r.summary;
      const sp = s.spreads.length
        ? `Spreads: ${s.spreads.length} split -> pages ${s.spreads.join(', ')}` +
          (s.alignBlanks ? `\n         ${s.alignBlanks} alignment blank(s) inserted` : '')
        : 'Spreads: none detected';
      const text =
        `Source: ${s.sourcePages} pages\n` + sp + '\n' +
        `Layout: box ${(s.trimW / MM).toFixed(0)} x ${(s.trimH / MM).toFixed(0)} mm, ` +
        `gutter ${(s.gutter / MM).toFixed(1)} mm, mode ${s.mode}\n` +
        `Body: ${s.sheets} folded sheets (${s.sides} sheet sides, ${s.imposedPages} pages, ${s.blanks} blank)\n` +
        (r.splashPage ? `Closing splash on body PDF page ${r.splashPage} (print in color)\n` : '') +
        (mode === 'glue'
          ? 'Print: odds, then evens REVERSED, short-edge flip. Fold, glue spine, stack-cut to box.'
          : 'Print: odds, then evens REVERSED, short-edge flip. Fold, punch the two ticks, bind with fasteners.');

      if (out.body) URL.revokeObjectURL(out.body);
      if (out.cover) URL.revokeObjectURL(out.cover);
      setOut({ body: mk(r.bodyBytes), cover: r.coverBytes ? mk(r.coverBytes) : undefined, text });
    } catch (e: any) {
      setOut({ err: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  const base = file ? file.name.replace(/\.pdf$/i, '') : 'booklet';

  // group controls by section for headers
  const rows = useMemo(() => {
    const out: { section?: string; items: Ctrl[] }[] = [];
    let cur: { section?: string; items: Ctrl[] } | null = null;
    for (const c of ctrls) {
      if (c.section || !cur) { cur = { section: c.section, items: [] }; out.push(cur); }
      cur.items.push(c);
    }
    return out;
  }, [ctrls]);

  return (
    <div className="panel">
      <div className="filerow">
        <label>Input PDF</label>
        <input type="file" accept="application/pdf"
          onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>

      <PdfPreview title="Input preview" src={inputUrl} />

      {rows.map((grp, i) => (
        <div key={i}>
          {grp.section && <div className="section-title">{grp.section}</div>}
          <div className="grid">
            {grp.items.map(c => (
              <div key={c.g} className={'ctrl' + (c.kind === 'bool' ? ' bool' : '')}>
                {c.kind === 'bool' ? (
                  <>
                    <input type="checkbox" checked={!!vals[c.g]}
                      onChange={e => set(c.g, e.target.checked)} />
                    <label>{c.label}</label>
                  </>
                ) : c.kind === 'choice' ? (
                  <>
                    <label>{c.label}</label>
                    <select value={vals[c.g]} onChange={e => set(c.g, e.target.value)}>
                      {c.choices!.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <label>{c.label}</label>
                    <input type="text" value={vals[c.g]}
                      onChange={e => set(c.g, e.target.value)} />
                  </>
                )}
                {c.hint && <span className="hint">{c.hint}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button className="run" onClick={run} disabled={busy}>
        {busy ? 'Imposing…' : 'Impose booklet'}
      </button>

      {(out.text || out.err) && (
        <div className="result">
          {out.err
            ? <p className="err">Error: {out.err}</p>
            : <>
                <h3>Done</h3>
                <pre>{out.text}</pre>
                <div className="downloads">
                  <a className="dl" href={out.body} download={`${base}_booklet.pdf`}>Download body PDF</a>
                  {out.cover && <a className="dl" href={out.cover} download={`${base}_cover.pdf`}>Download cover PDF</a>}
                </div>
                <div className="preview-grid">
                  <PdfPreview title="Body preview" src={out.body} />
                  <PdfPreview title="Cover preview" src={out.cover} />
                </div>
                <p className="note">Tip: print at 100% / actual size. Body grayscale, cover in color on photo paper.</p>
              </>}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [tab, setTab] = useState<'glue' | 'punch'>('glue');
  return (
    <div className="wrap">
      <h1>Manga Booklet Imposer</h1>
      <p className="sub">
        Right-to-left booklet imposition with automatic double-page-spread splitting.
        Everything runs in your browser — your PDF never leaves your device.
      </p>
      <div className="tabs">
        <div className={'tab' + (tab === 'glue' ? ' active' : '')} onClick={() => setTab('glue')}>Glue / Viz</div>
        <div className={'tab' + (tab === 'punch' ? ' active' : '')} onClick={() => setTab('punch')}>Punch + Fastener</div>
      </div>
      {tab === 'glue'
        ? <Tab key="glue" mode="glue" ctrls={GLUE} />
        : <Tab key="punch" mode="punch" ctrls={PUNCH} />}
    </div>
  );
}
