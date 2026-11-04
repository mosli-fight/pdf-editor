# PDF Editor — Master Plan

**Goal:** A website where anyone can open any normal PDF, edit it, and download
the result. No signup, no watermark, no task cap for core editing.

**Repo:** https://github.com/mosli-fight/pdf-editor
**Status (2026-11-05):** Phase 0 started. Mosaic MCP Phase 4 continues in
parallel in its own repo — this project does not touch Mosaic.

## 1. The one-line differentiator

Every big competitor uploads your file to a server, or gates real text editing
behind pay. Ours does the opposite:

> **100% client-side. The PDF never leaves the user's browser.**

That is the privacy story, the cost story (no file-processing servers), and
the free-tier story (no per-hour task cap to enforce) in one line.

## 2. Competitor + open-source audit (Nov 2026, checked live)

### Sejda (sejda.com/pdf-editor) — the real-editor benchmark
- Free: up to 200 pages / 50 MB, 3 tasks per hour, files deleted after 2 hours.
- Best-in-class free feature: **edit existing text** (font/size/bold/italic),
  plus add text, images, links, forms, whiteout, shapes, find & replace,
  highlight/strikethrough annotation, type/draw/upload signature.
- Weakness to beat: server upload, hourly cap.
- **Take from Sejda:** the editor toolbar model (Text / Image / Forms /
  Sign / Annotate / Shape) and find & replace. Do not copy its server model.

### PDF24 Tools (tools.pdf24.org) — the utility-toolbox benchmark
- Free, no signup, no artificial limits, ~30 tools: merge, split, compress,
  convert, rotate, organise, OCR, sign.
- Weakness to beat: **cannot edit existing PDF text** — only overlay
  text boxes, images, drawings. Server-side processing.
- **Take from PDF24:** toolbox breadth and "just one thing, fast" tool pages.

### iLovePDF / Smallpdf — the polished, paywalled benchmark
- iLovePDF: broadest platform (web/desktop/mobile), generous batch limits,
  but content editing, OCR-to-Word and AI tools are Premium; free output
  sometimes watermarked depending on tool.
- Smallpdf: most polished, but free = 2 tasks/day, editor is Pro-only.
- **Take from them:** polish, drag-and-drop simplicity, batch limits UI.
  **Do not copy:** paywalling the core editor.

### Stirling PDF (open source, 50–60+ tools) — the scope benchmark
- Self-hosted (Docker), merge/split, convert (LibreOffice), compress,
  OCR (Tesseract), redact, sign, watermark, compare, REST API, MCP server.
- Privacy model matches ours (files stay put), but it is a heavy Java
  stack (Spring Boot + PDFBox + LibreOffice + Ghostscript) and its true
  text editing is alpha / paid in the 2.0 open-core split.
- **Take from Stirling:** the full tool catalogue as a Phase 3–5 checklist,
  the API/MCP idea for later, and the lesson: do not build a server farm
  for v1. Our v1 is browser-only; server tools come only if a feature
  genuinely cannot run in the browser.

### Open-source libraries — the build blocks (all MIT-style, free)
- **pdf.js (Mozilla):** rendering + text layer. The viewer. No editing UI.
- **pdf-lib:** create/modify PDFs in browser or Node, no dependencies.
  Add text/images/graphics, copy/merge/split/rotate/reorder pages, fill
  known form fields. Limits: no viewer, no text reflow (drawText paints
  glyphs at coordinates — it does not know a paragraph exists), no OCR,
  no encryption on save, basic annotation support only.
- **Polotno lesson (patch vs parse):** patching (pdf-lib) keeps everything
  you did not touch byte-identical; parsing a page into editable objects
  and regenerating it risks fidelity loss. **Decision: patch, don't parse,
  for v1.** Reflow-style redesign editing is explicitly out of v1 scope.
- **Tesseract.js (later):** client-side OCR for scanned PDFs, no server.

## 3. Architecture (v1: browser-only)

```
User drops PDF
  -> FileReader -> ArrayBuffer (kept in memory only, never uploaded)
  -> pdf.js renders each page to canvas + text layer
  -> Overlay layer (HTML/canvas) holds edits: text boxes, drawings,
     highlights, shapes, images, signature
  -> On Download: pdf-lib loads original bytes, applies overlay edits
     as new content + page operations, saves new PDF, browser downloads it
```

- Stack: Vite + React + TypeScript (same family as Mosaic's web stack,
  so the team already knows it). Deploy: static hosting (Vercel).
- No backend, no database, no account in v1. No file ever leaves the device.
- Suggested practical limit for v1: files up to ~100 MB (browser memory),
  shown honestly in the UI — not a paywall, a technical note.
- Fonts: standard PDF fonts first; custom font embedding via
  @pdf-lib/fontkit only where needed, to keep bundle small.

## 4. Phases (one branch per phase, merge only on green CI)

### Phase 1 — MVP website (BUILDING NOW)
Upload (drag-drop + picker) · page viewer with zoom + thumbnails ·
add text (size/color/font) · pen draw · highlight · rectangle/ellipse ·
add image · signature (draw/type/upload) · page delete / rotate /
reorder · undo/redo · download edited PDF · sample-PDF test page.
Acceptance: open a 1-page and a 10-page PDF, add text + signature,
delete a page, download opens correctly in a normal PDF reader.

### Phase 2 — Real editor
Edit existing text (whiteout + rewrite over it, best-effort font match —
honest UI label, not magic reflow) · fill AcroForm fields + overlay
fields on flat forms · find & replace · links (add/edit) · whiteout ·
true redaction (content removal, not just a black box) · merge PDFs ·
split / extract pages · page numbers, header/footer, watermark.

### Phase 3 — Toolbox
Compress (image downscale/re-encode) · images-to-PDF · PDF-to-images ·
flatten annotations · metadata edit · repair/linearize where feasible.
Password protection: research item — pdf-lib cannot encrypt on save,
so this needs a proven client-side library or an explicit optional
server step; do NOT promise it until a library is verified.

### Phase 4 — Scanned PDFs
Tesseract.js OCR: searchable text layer over scans, OCR + download,
auto-rotate/crop for scans. Scanned-text editing stays overlay-based.

### Phase 5 — Later, only after core is solid
Optional account + recent files (local-first, still no file upload) ·
batch tools · templates (invoice/CV/form overlays) · REST API / MCP
server in the Stirling spirit · PWA offline mode · i18n (incl. Bangla).

## 5. What this editor will NOT do (honest limits, shown in UI)
- Reflow a PDF like a Word document (no paragraph re-layout in v1).
- Edit text inside a scanned image without OCR (Phase 4).
- Crack or bypass password protection (password supplied by the owner
  only, where the format allows it).
- Guarantee pixel-perfect font matching on every existing-text edit —
  best-effort match, preview before download.

## 6. Testing + quality bar (same discipline as Mosaic)
- One branch per phase, PR merged only on green CI
  (typecheck + lint + test + build).
- Test PDFs, kept in-repo under `tests/fixtures/` (generated, not
  copyrighted material): 1-page text, 10-page mixed, scanned image PDF,
  AcroForm PDF, encrypted PDF (owner password in test env only).
- Every phase ends with a hands-on check: open the downloaded PDF in a
  standard reader and verify pages, text, signature and page order.
- Privacy test: with network blocked after page load, editing + download
  must still work (proves nothing is uploaded).

## 7. Roadmap order, in one line
Viewer + overlay edits -> real text/form editing -> toolbox ->
scanned OCR -> accounts/API/PWA. No phase starts until the previous
phase's download is verified in a real reader.
