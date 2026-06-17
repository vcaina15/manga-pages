'use client';

import { useEffect, useMemo, useState } from 'react';
import { impose, ImposeOptions, ImposeResult, MM, CM, INCH } from '@/lib/imposer';

type Kind = 'float' | 'bool' | 'choice' | 'index' | 'index_opt';

interface Ctrl {
  g: string;
  label: string;
  kind: Kind;
  def: any;
  factor?: number;
  choices?: string[];
  hint?: string;
  section?: string;
}

type OutputState = {
  body?: string;
  cover?: string;
  err?: string;
  summary?: ImposeResult['summary'];
  splashPage?: number | null;
  mode?: 'glue' | 'punch';
};

const GLUE: Ctrl[] = [
  { g: 'pagesPerSig', label: 'Pages per signature', kind: 'choice', def: '4', choices: ['4', '8', '12', '16'], hint: 'sheets nested per group', section: 'Signature' },
  { g: 'trimW', label: 'Trim width', kind: 'float', def: 127, factor: MM, hint: 'mm', section: 'Page & fit' },
  { g: 'trimH', label: 'Trim height', kind: 'float', def: 190, factor: MM, hint: 'mm' },
  { g: 'matchPageAspect', label: 'Match page aspect', kind: 'bool', def: true, hint: 'Auto height from source pages' },
  { g: 'fitMode', label: 'Fit mode', kind: 'choice', def: 'fit', choices: ['fit', 'fill'], hint: 'Inside box or cover + crop' },
  { g: 'fillZoom', label: 'Fill zoom', kind: 'float', def: 1.02, factor: 1, hint: 'Fill only' },
  { g: 'gutter', label: 'Gutter', kind: 'float', def: 14, factor: MM, hint: 'mm' },
  { g: 'vOffset', label: 'Vertical offset', kind: 'float', def: 0, factor: MM, hint: 'mm' },
  { g: 'splitSpreads', label: 'Split spreads', kind: 'bool', def: true, hint: 'Detect and split wide pages', section: 'Spreads' },
  { g: 'spreadDetectAspect', label: 'Spread detect aspect', kind: 'float', def: 1.2, factor: 1, hint: 'w/h cutoff' },
  { g: 'landscapeMode', label: 'Landscape mode', kind: 'choice', def: 'rotate', choices: ['rotate', 'fit_width', 'none'], hint: 'For wide pages when not split' },
  { g: 'landscapeRotate', label: 'Landscape rotate', kind: 'choice', def: 'cw', choices: ['cw', 'ccw'] },
  { g: 'coverAsSeparate', label: 'Separate cover', kind: 'bool', def: true, hint: 'Generate a standalone cover PDF', section: 'Cover' },
  { g: 'coverSpineW', label: 'Spine width', kind: 'float', def: 13, factor: MM, hint: 'mm — measured with calipers after printing body' },
  { g: 'coverTrimW', label: 'Cover trim width', kind: 'float', def: 130, factor: MM, hint: 'mm — wider than body to wrap around spine' },
  { g: 'coverFitMode', label: 'Cover fit mode', kind: 'choice', def: 'fill', choices: ['fit', 'fill'], hint: 'Cover sheet only' },
  { g: 'coverFillZoom', label: 'Cover fill zoom', kind: 'float', def: 1.02, factor: 1, hint: 'Cover fill only' },
  { g: 'coverSrcIndex', label: 'Front cover page #', kind: 'index', def: 1, hint: '1-based' },
  { g: 'backCoverSrcIndex', label: 'Back cover page #', kind: 'index_opt', def: '', hint: 'Blank leaves it empty' },
  { g: 'appendCoverEnd', label: 'Append end splash', kind: 'bool', def: false },
  { g: 'drawGuides', label: 'Draw guides', kind: 'bool', def: true, hint: 'Stamp print guides', section: 'Guides' },
  { g: 'foldCutLine', label: 'Fold/cut line', kind: 'bool', def: true },
  { g: 'trimGuides', label: 'Trim box + crop marks', kind: 'bool', def: true },
  { g: 'cropMarkLen', label: 'Crop mark length', kind: 'float', def: 4, factor: MM, hint: 'mm' },
  { g: 'cropMarkGap', label: 'Crop mark gap', kind: 'float', def: 1.5, factor: MM, hint: 'mm' },
  { g: 'guideGray', label: 'Guide gray', kind: 'float', def: 0.6, factor: 1, hint: '0..1' },
  { g: 'guideWidth', label: 'Guide width', kind: 'float', def: 0.5, factor: 1, hint: 'pt' },
];

const PUNCH: Ctrl[] = [
  { g: 'pagesPerSig', label: 'Pages per signature', kind: 'choice', def: '4', choices: ['4', '8', '12', '16'], hint: 'sheets nested per group', section: 'Signature' },
  { g: 'gutter', label: 'Gutter', kind: 'float', def: 1.5, factor: INCH, hint: 'in', section: 'Layout' },
  { g: 'bleed', label: 'Bleed', kind: 'float', def: 0.04, factor: INCH, hint: 'in' },
  { g: 'maxEdgeCrop', label: 'Max edge crop', kind: 'float', def: 0, factor: INCH, hint: 'in' },
  { g: 'vOffset', label: 'Vertical offset', kind: 'float', def: 0, factor: INCH, hint: 'in' },
  { g: 'splitSpreads', label: 'Split spreads', kind: 'bool', def: true, hint: 'Detect and split wide pages', section: 'Spreads' },
  { g: 'spreadDetectAspect', label: 'Spread detect aspect', kind: 'float', def: 1.2, factor: 1, hint: 'w/h cutoff' },
  { g: 'coverAsSeparate', label: 'Separate cover', kind: 'bool', def: true, hint: 'Generate a standalone cover PDF', section: 'Cover' },
  { g: 'coverSrcIndex', label: 'Front cover page #', kind: 'index', def: 1, hint: '1-based' },
  { g: 'backCoverSrcIndex', label: 'Back cover page #', kind: 'index_opt', def: '', hint: 'Blank leaves it empty' },
  { g: 'appendCoverEnd', label: 'Append end splash', kind: 'bool', def: false },
  { g: 'drawGuides', label: 'Draw guides', kind: 'bool', def: true, hint: 'Stamp print guides', section: 'Guides' },
  { g: 'foldCutLine', label: 'Fold/cut line', kind: 'bool', def: true },
  { g: 'punchSpacing', label: 'Punch spacing', kind: 'float', def: 12, factor: CM, hint: 'cm' },
  { g: 'guideGray', label: 'Guide gray', kind: 'float', def: 0.6, factor: 1, hint: '0..1' },
  { g: 'guideWidth', label: 'Guide width', kind: 'float', def: 0.5, factor: 1, hint: 'pt' },
];

function defaults(ctrls: Ctrl[]) {
  const output: Record<string, any> = {};
  ctrls.forEach((ctrl) => {
    output[ctrl.g] = ctrl.kind === 'bool' ? ctrl.def : String(ctrl.def);
  });
  return output;
}

function coerce(ctrl: Ctrl, raw: any) {
  switch (ctrl.kind) {
    case 'bool':
      return !!raw;
    case 'choice':
      return String(raw);
    case 'index':
      return Math.round(parseFloat(raw)) - 1;
    case 'index_opt':
      return String(raw).trim() === '' ? null : Math.round(parseFloat(raw)) - 1;
    default:
      return parseFloat(raw) * (ctrl.factor ?? 1);
  }
}


function Field({
  ctrl,
  value,
  onChange,
}: {
  ctrl: Ctrl;
  value: any;
  onChange: (value: any) => void;
}) {
  if (ctrl.kind === 'bool') {
    return (
      <label className="toggle-field">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-copy">
          <span className="field-label">{ctrl.label}</span>
          {ctrl.hint && <span className="field-hint">{ctrl.hint}</span>}
        </span>
      </label>
    );
  }

  return (
    <label className="field-row">
      <span className="field-copy">
        <span className="field-label">{ctrl.label}</span>
        {ctrl.hint && <span className="field-hint">{ctrl.hint}</span>}
      </span>
      <span className="field-input-wrap">
        {ctrl.kind === 'choice' ? (
          <select className="field-input field-select" value={value} onChange={(e) => onChange(e.target.value)}>
            {ctrl.choices!.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        ) : (
          <input className="field-input" type="text" value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </span>
    </label>
  );
}

function Tab({ mode, ctrls }: { mode: 'glue' | 'punch'; ctrls: Ctrl[] }) {
  const [vals, setVals] = useState<Record<string, any>>(() => defaults(ctrls));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<OutputState>({});
  const [inputUrl, setInputUrl] = useState<string>();
  const [previewTab, setPreviewTab] = useState<'input' | 'body' | 'cover'>('input');

  const set = (group: string, value: any) => setVals((current) => ({ ...current, [group]: value }));

  useEffect(() => {
    if (!file) {
      setInputUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setInputUrl(url);
    setPreviewTab('input');
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      if (out.body) URL.revokeObjectURL(out.body);
      if (out.cover) URL.revokeObjectURL(out.cover);
    };
  }, [out.body, out.cover]);

  async function run() {
    if (!file) {
      setOut({ err: 'Choose an input PDF first.' });
      return;
    }

    setBusy(true);
    setOut({});

    try {
      const opts: any = { mode };
      ctrls.forEach((ctrl) => {
        opts[ctrl.g] = coerce(ctrl, vals[ctrl.g]);
      });

      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await impose(bytes, opts as ImposeOptions);
      const toUrl = (chunk: Uint8Array) => URL.createObjectURL(new Blob([chunk.slice()], { type: 'application/pdf' }));

      if (out.body) URL.revokeObjectURL(out.body);
      if (out.cover) URL.revokeObjectURL(out.cover);

      setOut({
        body: toUrl(result.bodyBytes),
        cover: result.coverBytes ? toUrl(result.coverBytes) : undefined,
        summary: result.summary,
        splashPage: result.splashPage,
        mode,
      });
      setPreviewTab('body');
    } catch (error: any) {
      setOut({ err: error?.message || String(error) });
    } finally {
      setBusy(false);
    }
  }

  const base = file ? file.name.replace(/\.pdf$/i, '') : 'booklet';
  const rows = useMemo(() => {
    const output: { section?: string; items: Ctrl[] }[] = [];
    let current: { section?: string; items: Ctrl[] } | null = null;

    for (const ctrl of ctrls) {
      if (ctrl.section || !current) {
        current = { section: ctrl.section, items: [] };
        output.push(current);
      }
      current.items.push(ctrl);
    }

    return output;
  }, [ctrls]);

  return (
    <div className="workspace">
      <section className="config-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Configure</div>
            <h2>Source &amp; layout</h2>
          </div>
        </div>

        <div className="upload-row">
          <div className="upload-copy">
            <span className="field-label">Input PDF</span>
            <span className="field-hint">{file ? file.name : 'No file selected'}</span>
          </div>
          <input
            className="upload-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="tool-notice">
          {vals['pagesPerSig'] === '4'
            ? 'Single-sheet signatures: 1 folded sheet per group, 4 pages.'
            : `${vals['pagesPerSig']}-page signatures: ${Number(vals['pagesPerSig']) / 4} sheets nested per group — fold innermost first.`}
        </div>

        {rows.map((group, index) => (
          <section key={index} className="control-section">
            {group.section && <div className="section-kicker">{group.section}</div>}
            <div className="field-grid">
              {group.items.map((ctrl) => (
                <Field key={ctrl.g} ctrl={ctrl} value={vals[ctrl.g]} onChange={(value) => set(ctrl.g, value)} />
              ))}
            </div>
          </section>
        ))}

        <div className="action-bar">
          <button className="run" onClick={run} disabled={busy}>
            {busy ? 'Imposing…' : 'Impose booklet'}
          </button>
          <span className="action-note">{mode === 'glue' ? 'Glue binding' : 'Punch + fastener'}</span>
        </div>
      </section>

      <section className="results-panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Output</div>
            <h2>Preview &amp; export</h2>
          </div>
        </div>

        {out.err ? (
          <div className="empty-state error-state">
            <div className="empty-title">Could not impose this file</div>
            <p>{out.err}</p>
          </div>
        ) : out.summary ? (
          <div className="results-meta">
            <div className="metrics">
              <div className="metric">
                <span className="metric-value">{out.summary.sourcePages}</span>
                <span className="metric-label">Source pages</span>
              </div>
              <div className="metric">
                <span className="metric-value">{out.summary.sheets}</span>
                <span className="metric-label">Folded sheets</span>
              </div>
              <div className="metric">
                <span className="metric-value">{out.summary.spreads.length}</span>
                <span className="metric-label">Detected spreads</span>
              </div>
              <div className="metric">
                <span className="metric-value">{out.summary.blanks}</span>
                <span className="metric-label">Blank pages</span>
              </div>
            </div>

            <div className="downloads">
              <a className="dl" href={out.body} download={`${base}_booklet.pdf`}>
                Download body PDF
              </a>
              {out.cover ? (
                <a className="dl secondary" href={out.cover} download={`${base}_cover.pdf`}>
                  Download cover PDF
                </a>
              ) : null}
            </div>

            <div className="instruction-banner">
              {out.mode === 'glue'
                ? 'Print odds, then evens reversed, short-edge flip. Fold, glue spine, stack-cut to trim.'
                : 'Print odds, then evens reversed, short-edge flip. Fold, punch the guide ticks, then fasten.'}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-title">Ready for a source PDF</div>
            <p>Load a manga PDF, tune the layout, and generate press-ready output with a live preview.</p>
          </div>
        )}

        {(inputUrl || out.body) && (
          <div className="preview-viewer">
            <div className="preview-tabs">
              <button
                className={'preview-tab' + (previewTab === 'input' ? ' active' : '')}
                onClick={() => setPreviewTab('input')}
                disabled={!inputUrl}
              >
                Input
              </button>
              <button
                className={'preview-tab' + (previewTab === 'body' ? ' active' : '')}
                onClick={() => setPreviewTab('body')}
                disabled={!out.body}
              >
                Body PDF
              </button>
              <button
                className={'preview-tab' + (previewTab === 'cover' ? ' active' : '')}
                onClick={() => setPreviewTab('cover')}
                disabled={!out.cover}
              >
                Cover PDF
              </button>
            </div>
            <iframe
              className="preview-frame"
              src={previewTab === 'input' ? inputUrl : previewTab === 'body' ? out.body : out.cover}
              title={previewTab}
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default function Page() {
  const [tab, setTab] = useState<'glue' | 'punch'>('glue');

  return (
    <>
    <header className="hero">
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="wordmark">
            <span className="wordmark-glyph" aria-hidden="true">
              {/* Book spine icon */}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="2" width="2" height="14" rx="1" fill="white" opacity="0.9"/>
                <rect x="6" y="2" width="9" height="14" rx="1.5" fill="white" opacity="0.7"/>
                <line x1="6" y1="5" x2="15" y2="5" stroke="rgba(0,0,0,0.25)" strokeWidth="0.75"/>
                <line x1="6" y1="8" x2="15" y2="8" stroke="rgba(0,0,0,0.25)" strokeWidth="0.75"/>
                <line x1="6" y1="11" x2="13" y2="11" stroke="rgba(0,0,0,0.25)" strokeWidth="0.75"/>
              </svg>
            </span>
            <span className="wordmark-text">Manga Pages</span>
          </div>
          <div className="hero-title-row">
            <h1>Print-ready manga booklets — right in your browser.</h1>
            <p className="sub">
              RTL imposition, spread splitting, and standalone covers. Built for glue and fastener binding.
            </p>
          </div>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Binding mode">
          <button
            type="button"
            className={'mode-tab' + (tab === 'glue' ? ' active' : '')}
            onClick={() => setTab('glue')}
          >
            Glue / Viz
          </button>
          <button
            type="button"
            className={'mode-tab' + (tab === 'punch' ? ' active' : '')}
            onClick={() => setTab('punch')}
          >
            Punch + Fastener
          </button>
        </div>
      </div>
    </header>

    <main className="app-shell">
      {tab === 'glue' ? <Tab key="glue" mode="glue" ctrls={GLUE} /> : <Tab key="punch" mode="punch" ctrls={PUNCH} />}

      <footer className="app-footer">
        <p className="app-footer-copy">
          All processing runs locally in your browser — no files are uploaded.
          Built for manga collectors and DIY bookbinders.
        </p>
        <p className="app-footer-author">
          Authored by{' '}
          <a className="app-footer-link" href="https://github.com/vcaina15" target="_blank" rel="noopener noreferrer">
            vcaina15
          </a>
          {' '}·{' '}
          <a className="app-footer-link" href="https://github.com/vcaina15/manga-pages" target="_blank" rel="noopener noreferrer">
            View on GitHub
          </a>
        </p>
        <span className="app-footer-badge">綴じる — Bind &amp; Print</span>
      </footer>
    </main>
    </>
  );
}
