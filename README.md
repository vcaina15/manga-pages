# Manga Pages

**Turn any manga PDF into a print-ready booklet — right in your browser.**

No uploads. No backend. No account. Just open the page, drop your PDF, and download a press-ready imposed booklet in seconds.

Built by [vcaina15](https://github.com/vcaina15) · [Live app](https://manga-pages.vercel.app) · MIT License

---

## What it does

Manga Pages reorders your source PDF pages into the correct right-to-left signature order for physical booklet printing. It handles the math so you don't have to.

- **Automatic spread detection** — wide double-page spreads are split and paired correctly
- **Two binding modes** — Glue / Viz for perfect-bound or saddle-stitch, Punch + Fastener for ring or screw-post binding
- **Standalone cover PDF** — front and back cover pulled into a separate sheet
- **Configurable signatures** — 4, 8, 12, or 16 pages per signature
- **Print guides** — fold/cut lines, trim boxes, and crop marks baked in
- **100% client-side** — `pdf-lib` runs entirely in your browser; your files never leave your device

---

## Modes

### Glue / Viz
Fixed trim box (default 127 × 190 mm Viz Media size). Controls for fit/fill, fill zoom, landscape handling, and per-sheet signatures. Outputs a body PDF and a cover PDF ready for fold-and-glue binding.

### Punch + Fastener
Full-bleed cell sizing with a 1.5″ gutter for ring or screw-post fasteners. Controls for bleed, max edge crop, and punch guide spacing.

---

## How to print

1. Load your manga PDF and click **Impose booklet**
2. Download the **body PDF** and (if enabled) the **cover PDF**
3. Print at **100% / actual size** — do not scale to fit
4. **Body:** print odds first, then evens in reverse order, short-edge flip (duplex)
5. **Cover:** print on photo paper or card stock, color if available
6. Fold, then glue the spine and stack-cut to trim — or punch the guide ticks and fasten

---

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel (free)

**Option A — Git (recommended):**
1. Push to a GitHub repo
2. In Vercel, click **Add New → Project** and import the repo
3. Framework is auto-detected as Next.js — leave defaults and deploy

**Option B — CLI:**
```bash
npm i -g vercel
vercel
vercel --prod
```

No environment variables, no serverless functions, nothing to configure.

---

## Notes

- Large volumes (150+ pages) take a few seconds — the button shows "Imposing…" while it works
- Imposition logic lives in `lib/imposer.ts` and is framework-agnostic
- Next.js is pinned to 14.2.5 for a stable Vercel build
