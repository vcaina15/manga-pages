// Manga booklet imposer — pdf-lib port (client-side capable).
import { PDFDocument, rgb, degrees } from 'pdf-lib';

export const MM = 72 / 25.4;
export const CM = 72 / 2.54;
export const INCH = 72;

export interface ImposeOptions {
  mode: 'glue' | 'punch';
  sheetW?: number; sheetH?: number;
  // glue
  trimW?: number; trimH?: number; matchPageAspect?: boolean;
  fitMode?: 'fit' | 'fill'; fillZoom?: number;
  coverFitMode?: 'fit' | 'fill'; coverFillZoom?: number;
  landscapeMode?: 'rotate' | 'fit_width' | 'none'; landscapeRotate?: 'cw' | 'ccw';
  // punch
  bleed?: number; maxEdgeCrop?: number;
  // shared
  gutter: number; vOffset: number;
  splitSpreads: boolean; spreadDetectAspect: number;
  coverAsSeparate: boolean; coverSrcIndex: number;
  backCoverSrcIndex: number | null; appendCoverEnd: boolean;
  // guides
  drawGuides: boolean; foldCutLine: boolean; guideGray: number; guideWidth: number;
  trimGuides?: boolean; cropMarkLen?: number; cropMarkGap?: number;
  punchSpacing?: number;
}

export interface ImposeResult {
  bodyBytes: Uint8Array;
  coverBytes: Uint8Array | null;
  splashPage: number | null;
  summary: {
    sourcePages: number; sheets: number; sides: number; imposedPages: number;
    blanks: number; spreads: number[]; alignBlanks: number;
    trimW: number; trimH: number; gutter: number; mode: string;
  };
}

type SequenceItem =
  | { kind: 'blank' }
  | { kind: 'page'; idx: number }
  | { kind: 'half'; idx: number; which: 'left' | 'right' };

type SheetSlot = number | null;
type SheetSide = [SheetSlot, SheetSlot];
type SheetLayout = [SheetSide, SheetSide];

// Build the reading sequence with spread splitting + facing alignment.
function buildSequence(sizes: Array<{ w: number; h: number }>, o: ImposeOptions) {
  const bodyFirst = o.coverAsSeparate ? 1 : 0;
  const seq: SequenceItem[] = [];
  const stats: { spreads: number[]; alignBlanks: number; padBlanks: number } = {
    spreads: [],
    alignBlanks: 0,
    padBlanks: 0,
  };
  for (let idx = bodyFirst; idx < sizes.length; idx++) {
    const { w, h } = sizes[idx];
    if (o.splitSpreads && h > 0 && w / h >= o.spreadDetectAspect) {
      if ((seq.length + 1) % 2 === 1) { seq.push({ kind: 'blank' }); stats.alignBlanks++; }
      seq.push({ kind: 'half', idx, which: 'right' });
      seq.push({ kind: 'half', idx, which: 'left' });
      stats.spreads.push(idx + 1);
    } else {
      seq.push({ kind: 'page', idx });
    }
  }
  const beforePad = seq.length;
  while (seq.length % 4 !== 0) seq.push({ kind: 'blank' });
  stats.padBlanks = seq.length - beforePad;

  let coverPos: number | null = null;
  if (o.appendCoverEnd) {
    coverPos = seq.length + 2;
    seq.push({ kind: 'blank' }, { kind: 'blank' },
             { kind: 'page', idx: o.coverSrcIndex }, { kind: 'blank' });
  }
  return { seq, stats, coverPos };
}

// RTL single-sheet signatures: side A = [p0|p3], side B = [p2|p1] (left|right)
function rtlSheets(total: number): SheetLayout[] {
  const sheets: SheetLayout[] = [];
  for (let s = 0; s < total; s += 4) {
    const p = [0, 1, 2, 3].map(i => (s + i < total ? s + i : null));
    sheets.push([[p[0], p[3]], [p[2], p[1]]]);
  }
  return sheets;
}

function boxRect(half, S) {
  const cx = S.sheetW / 2;
  const y0 = (S.sheetH - S.effTrimH) / 2 + S.vOffset;
  let x0, x1;
  if (half === 'left') { x1 = cx - S.gutter / 2; x0 = x1 - S.trimW; }
  else { x0 = cx + S.gutter / 2; x1 = x0 + S.trimW; }
  return { x0, y0, x1, y1: y0 + S.effTrimH, w: S.trimW, h: S.effTrimH };
}

// Glue/Viz placement (fixed box). emb has .width/.height.
function placeGlue(page, emb, half, S) {
  const b = boxRect(half, S);
  const tw = emb.width, th = emb.height;

  // landscape tile (only when not split): rotate or fit width
  if (tw > th && S.landscapeMode !== 'none') {
    if (S.landscapeMode === 'fit_width') {
      const s = b.w / tw, nh = th * s;
      page.drawPage(emb, { x: b.x0, y: (b.y0 + b.y1) / 2 - nh / 2, xScale: s, yScale: s });
      return;
    }
    // rotate
    const rotW = th, rotH = tw;                       // dims after 90° turn
    const s = S.fitMode === 'fit'
      ? Math.min(b.w / rotW, b.h / rotH)
      : Math.max(b.w / rotW, b.h / rotH) * S.fillZoom;
    const cw = rotW * s, ch = rotH * s;
    const cxb = (b.x0 + b.x1) / 2, cyb = (b.y0 + b.y1) / 2;
    if (S.landscapeRotate === 'ccw') {
      page.drawPage(emb, { x: cxb - cw / 2, y: cyb - ch / 2, xScale: s, yScale: s, rotate: degrees(90) });
    } else {
      page.drawPage(emb, { x: cxb - cw / 2, y: cyb - ch / 2, xScale: s, yScale: s, rotate: degrees(-90) });
    }
    return;
  }

  const scale = S.fitMode === 'fit'
    ? Math.min(b.w / tw, b.h / th)
    : Math.max(b.w / tw, b.h / th) * S.fillZoom;
  const nw = tw * scale, nh = th * scale;
  const ty = b.y0 + (b.h - nh) / 2;
  const tx = half === 'left' ? b.x1 - nw : b.x0;
  page.drawPage(emb, { x: tx, y: ty, xScale: scale, yScale: scale });
}

// Punch/fill-cell placement.
function placePunch(page, emb, half, S) {
  const halfW = S.sheetW / 2;
  const cellW = halfW - S.gutter / 2, cellH = S.sheetH;
  const tw = emb.width, th = emb.height;
  const fitWidth = (cellW + S.bleed) / tw;
  const fillHeight = (cellH + 2 * S.bleed) / th;
  const budgeted = (cellW + S.bleed + S.maxEdgeCrop) / tw;
  const scale = fillHeight > fitWidth
    ? Math.min(Math.max(fitWidth, Math.min(budgeted, fillHeight)), fillHeight)
    : fitWidth;
  const nw = tw * scale, nh = th * scale;
  const ty = (cellH - nh) / 2 + S.vOffset;
  let cx0, cx1;
  if (half === 'left') { cx0 = -S.bleed; cx1 = halfW - S.gutter / 2; }
  else { cx0 = halfW + S.gutter / 2; cx1 = S.sheetW + S.bleed; }
  let tx = cx0 + ((cx1 - cx0) - nw) / 2;
  if (nw > cx1 - cx0) tx = half === 'left' ? cx1 - nw : cx0;
  page.drawPage(emb, { x: tx, y: ty, xScale: scale, yScale: scale });
}

function drawGuides(page, S) {
  if (!S.drawGuides) return;
  const g = rgb(S.guideGray, S.guideGray, S.guideGray);
  const cx = S.sheetW / 2;
  if (S.foldCutLine)
    page.drawLine({ start: { x: cx, y: 0 }, end: { x: cx, y: S.sheetH }, thickness: S.guideWidth, color: g });
  if (S.mode === 'glue' && S.trimGuides) {
    for (const half of ['left', 'right']) {
      const b = boxRect(half, S);
      page.drawRectangle({ x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0,
        borderColor: g, borderWidth: S.guideWidth, opacity: 0 });
      const m = S.cropMarkLen, gap = S.cropMarkGap;
      for (const [px, py, sx, sy] of [[b.x0, b.y0, -1, -1], [b.x1, b.y0, 1, -1], [b.x0, b.y1, -1, 1], [b.x1, b.y1, 1, 1]]) {
        page.drawLine({ start: { x: px + sx * gap, y: py }, end: { x: px + sx * (gap + m), y: py }, thickness: S.guideWidth, color: g });
        page.drawLine({ start: { x: px, y: py + sy * gap }, end: { x: px, y: py + sy * (gap + m) }, thickness: S.guideWidth, color: g });
      }
    }
  }
  if (S.mode === 'punch') {
    const cy = S.sheetH / 2, hw = S.gutter / 2;
    for (const y of [cy - S.punchSpacing / 2, cy + S.punchSpacing / 2])
      page.drawLine({ start: { x: cx - hw, y }, end: { x: cx + hw, y }, thickness: S.guideWidth, color: g });
  }
}

export async function impose(inputBytes: Uint8Array, opts: ImposeOptions): Promise<ImposeResult> {
  const o = { sheetW: 842, sheetH: 595, ...opts };
  const src = await PDFDocument.load(inputBytes);
  const n = src.getPageCount();
  const sizes = src.getPages().map(p => ({ w: p.getWidth(), h: p.getHeight() }));

  // effective trim height (glue + match aspect)
  let effTrimH = o.trimH ?? 0;
  if (o.mode === 'glue' && o.matchPageAspect) {
    const bodyFirst = (o.coverAsSeparate && n > 1) ? 1 : 0;
    const rep =
      sizes.slice(bodyFirst).find(({ w, h }) => h >= w && w > 0) ??
      sizes[bodyFirst];
    effTrimH = (o.trimW ?? 0) * rep.h / rep.w;
  }
  const S = { ...o, effTrimH };

  const { seq, stats, coverPos } = buildSequence(sizes, o);
  const padded = seq.length;

  const place = o.mode === 'glue' ? placeGlue : placePunch;

  // embed cache: key -> embedded page (per output doc)
  async function embedFor(doc, item, cache) {
    const key = item.kind === 'half' ? `h${item.idx}${item.which}` : `p${item.idx}`;
    if (cache.has(key)) return cache.get(key);
    const sp = src.getPage(item.idx);
    const { w, h } = sizes[item.idx];
    let emb;
    if (item.kind === 'half') {
      const clip = item.which === 'right'
        ? { left: w / 2, bottom: 0, right: w, top: h }
        : { left: 0, bottom: 0, right: w / 2, top: h };
      emb = await doc.embedPage(sp, clip);
    } else {
      emb = await doc.embedPage(sp);
    }
    cache.set(key, emb);
    return emb;
  }

  // ---- body ----
  const body = await PDFDocument.create();
  const bodyCache = new Map();
  let splashPage: number | null = null;
  const sheets = rtlSheets(padded);
  for (const [[aL, aR], [bL, bR]] of sheets) {
    for (const [lpos, rpos] of [[aL, aR], [bL, bR]]) {
      const page = body.addPage([S.sheetW, S.sheetH]);
      for (const [pos, half] of [[lpos, 'left'], [rpos, 'right']]) {
        if (pos === null) continue;
        const item = seq[pos];
        if (item.kind === 'blank') continue;
        const emb = await embedFor(body, item, bodyCache);
        place(page, emb, half, S);
        if (coverPos !== null && pos === coverPos) splashPage = body.getPageCount();
      }
      drawGuides(page, S);
    }
  }
  const bodyBytes = await body.save();

  // ---- cover ----
  let coverBytes: Uint8Array | null = null;
  if (o.coverAsSeparate) {
    const cov = await PDFDocument.create();
    const cache = new Map();
    const page = cov.addPage([S.sheetW, S.sheetH]);
    const covS = o.mode === 'glue'
      ? { ...S, fitMode: o.coverFitMode ?? S.fitMode, fillZoom: o.coverFillZoom ?? S.fillZoom }
      : S;
    const coverPlace = o.mode === 'glue' ? placeGlue : placePunch;
    const front = await embedFor(cov, { kind: 'page', idx: o.coverSrcIndex }, cache);
    coverPlace(page, front, 'left', covS);
    if (o.backCoverSrcIndex !== null && o.backCoverSrcIndex !== undefined) {
      const back = await embedFor(cov, { kind: 'page', idx: o.backCoverSrcIndex }, cache);
      coverPlace(page, back, 'right', covS);
    }
    drawGuides(page, S);
    coverBytes = await cov.save();
  }

  const sides = body.getPageCount();
  return {
    bodyBytes, coverBytes, splashPage,
    summary: {
      sourcePages: n, sheets: padded / 4, sides, imposedPages: padded,
      blanks: stats.padBlanks + stats.alignBlanks,
      spreads: stats.spreads, alignBlanks: stats.alignBlanks,
      trimW: S.trimW ?? 0, trimH: effTrimH, gutter: S.gutter, mode: o.mode,
    },
  };
}
