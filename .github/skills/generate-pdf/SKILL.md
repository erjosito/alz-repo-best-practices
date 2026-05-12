---
name: generate-pdf
description: "Generate a print-ready PDF of the full ALZ best-practices guide from the repository markdown. Renders Mermaid diagrams as images, preserves tables and code blocks, and adds a cover page with the current git commit and date. Use whenever the user asks to 'generate the PDF', 'build the PDF', 'create the guide PDF', 'update the PDF', or mentions the reMarkable/e-reader version of the guide."
---

# Generate PDF Skill

Build a single, print-ready **A4 PDF** of the entire Azure Landing Zones IaC
Best Practices guide from the markdown source in this repository.

## When to use

Invoke this skill when the user asks to generate, rebuild, or update the PDF
version of the guide — for example after new commits have landed.

## Prerequisites

The following **npm packages** are needed at runtime (install them if missing):

| Package | Purpose |
|---------|---------|
| `md-to-pdf` | Markdown → HTML → PDF via Chromium |
| `@mermaid-js/mermaid-cli` (`mmdc`) | Render Mermaid diagrams to PNG |
| `svgexport` | Convert the cover SVG to PNG |

Install if not already available:

```bash
npm install -g md-to-pdf @mermaid-js/mermaid-cli svgexport
```

## How to build the PDF

### Step 1 — Run the build script

```bash
node .github/skills/generate-pdf/scripts/build-pdf.mjs
```

This script:

1. Reads **git metadata** (short SHA + commit date) for the cover page.
2. Assembles all chapters in order (README intro → Ch 01–14 → references).
3. **Renders every Mermaid diagram** to a PNG and embeds it as a base64 data
   URI (protected `````-fenced` code examples are left alone).
4. Prepends a **cover page** with:
   - An illustrated SVG cover image (cloud with hard hat).
   - Title, repository name, commit SHA, and date.
5. Normalises line endings (CRLF → LF) and injects `<meta charset="utf-8">`.
6. Writes the combined markdown to `dist/alz-combined.md`.

### Step 2 — Convert to PDF

```bash
npx md-to-pdf dist/alz-combined.md --config-file .github/skills/generate-pdf/scripts/pdf-config.json
```

### Step 3 — Rename output

```bash
mv dist/alz-combined.pdf dist/ALZ-IaC-Best-Practices.pdf
```

The final PDF is at **`dist/ALZ-IaC-Best-Practices.pdf`** and should be
committed to the repository so that users get it on clone.

### One-liner

```bash
node .github/skills/generate-pdf/scripts/build-pdf.mjs \
  && npx md-to-pdf dist/alz-combined.md --config-file .github/skills/generate-pdf/scripts/pdf-config.json \
  && mv dist/alz-combined.pdf dist/ALZ-IaC-Best-Practices.pdf
```

## PDF styling notes

- **Font**: Georgia (serif) — optimised for e-ink / reMarkable devices.
- **Diagrams**: Rendered at `width=800, scale=1, max-width=65%` so every
  diagram fits on a single A4 page.
- **Tables**: Full-width with alternating row shading.
- **Code blocks**: Monospace, light grey background, word-wrap enabled.
- **Header/footer**: Guide title in header; page numbers in footer.
- **Cover page**: Auto-updated with the latest git SHA and date on each build.

## Output directory

The script writes intermediate files to `dist/` at the repo root.
The final PDF (`dist/ALZ-IaC-Best-Practices.pdf`) is **committed to the
repository** so that anyone cloning the repo gets the latest version
immediately — no build step required.

## Integrating with CI/CD

To auto-generate the PDF on every push to `main`, add a GitHub Actions
workflow that runs the one-liner above. The build script uses `npx` for
Mermaid CLI and svgexport, so no global installs are required in CI — just
Node.js 20+.
