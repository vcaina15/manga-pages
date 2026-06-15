# Manga Booklet Imposer (web)

Right-to-left booklet imposition with automatic double-page-spread splitting,
as a Next.js web app. **All processing runs client-side in the browser** via
`pdf-lib` — your PDF is never uploaded anywhere, and there's no backend, so it
deploys to Vercel's free tier as a plain static-ish Next.js app.

Two modes, each with every control exposed:

- **Glue / Viz** — fixed trim box (default 127×190 mm Viz), `MATCH_PAGE_ASPECT`,
  `fit`/`fill` with `FILL_ZOOM`, glue-sized gutter, trim box + crop-mark guides,
  landscape rotate/fit-width.
- **Punch + Fastener** — fill-the-cell sizing, 1.5″ fastener gutter, bleed +
  max-edge-crop, fold line + two punch ticks at your spacing.

Both auto-detect spreads (a page wider than `SPREAD_DETECT_ASPECT`), split them
into a facing pair, and insert an alignment blank when needed so the halves face.
The cover is pulled into its own PDF.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel (free)

Option A — Git:
1. Push this folder to a GitHub repo.
2. In Vercel, "Add New… → Project", import the repo.
3. Framework preset is auto-detected as **Next.js**. Leave defaults. Deploy.

Option B — CLI:
```bash
npm i -g vercel
vercel        # follow prompts; accept Next.js defaults
vercel --prod # promote to production
```

No environment variables, no serverless functions, nothing to configure — the
imposition is pure client-side JS.

## How to use

1. Pick a tab (Glue or Punch).
2. Choose your input PDF.
3. Adjust controls (units are noted on each field: mm, in, cm, or unitless).
4. Click **Impose booklet** → download the body PDF (and the cover PDF).
5. Print at **100% / actual size**. Body grayscale; cover in color on photo
   paper. Print odds, then evens **reversed**, short-edge flip. Then fold and
   bind (glue + stack-cut, or punch + fasteners).

## Notes

- Large volumes (150+ pages) take a few seconds to process in the browser; the
  button shows "Imposing…" while it works.
- Next is pinned to 14.2.5 for a stable Vercel build.
- The imposition logic lives in `lib/imposer.ts` and is framework-agnostic.
