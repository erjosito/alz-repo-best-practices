import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// --- Paths -----------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..', '..');
const docsDir = join(repoRoot, 'docs');
const outDir = join(repoRoot, 'dist');
const mermaidDir = join(outDir, 'mermaid-images');
const outPath = join(outDir, 'alz-combined.md');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
if (!existsSync(mermaidDir)) mkdirSync(mermaidDir, { recursive: true });

// --- Git metadata ----------------------------------------------------
function gitMeta() {
  const sha = execSync('git rev-parse --short HEAD', { cwd: repoRoot }).toString().trim();
  const date = execSync('git log -1 --format=%ci HEAD', { cwd: repoRoot }).toString().trim();
  const prettyDate = new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  return { sha, prettyDate };
}

// --- Mermaid rendering -----------------------------------------------
const mermaidConfig = join(outDir, 'mermaid-config.json');
writeFileSync(mermaidConfig, JSON.stringify({
  theme: 'default',
  themeVariables: { fontSize: '13px', fontFamily: 'arial,sans-serif' },
}));

// Puppeteer config for mermaid-cli: required on Ubuntu 23.10+ GitHub
// runners where unprivileged user namespaces are restricted by AppArmor,
// causing the bundled Chromium to fail with "No usable sandbox".
const puppeteerConfig = join(outDir, 'puppeteer-config.json');
writeFileSync(puppeteerConfig, JSON.stringify({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
}));

let diagramIndex = 0;

function renderMermaidBlocks(content, sourceFile) {
  // Protect mermaid blocks inside ```` fences (documentation examples)
  const savedBlocks = [];
  content = content.replace(/````[\s\S]*?````/g, (match) => {
    savedBlocks.push(match);
    return `__PROTECTED_BLOCK_${savedBlocks.length - 1}__`;
  });

  content = content.replace(/```mermaid\r?\n([\s\S]*?)```/g, (match, mermaidCode) => {
    diagramIndex++;
    const mmdFile = join(mermaidDir, `diagram-${diagramIndex}.mmd`);
    const pngFile = join(mermaidDir, `diagram-${diagramIndex}.png`);
    writeFileSync(mmdFile, mermaidCode.trim());

    try {
      execSync(
        `npx --yes @mermaid-js/mermaid-cli -i "${mmdFile}" -o "${pngFile}" -c "${mermaidConfig}" -p "${puppeteerConfig}" -w 800 -b white --scale 1`,
        { timeout: 60_000, cwd: repoRoot },
      );
      const b64 = readFileSync(pngFile).toString('base64');
      console.log(`  ✓ diagram-${diagramIndex} from ${sourceFile}`);
      return `<img src="data:image/png;base64,${b64}" alt="Diagram ${diagramIndex}" style="max-width:65%;display:block;margin:1em auto;" />`;
    } catch (err) {
      console.error(`  ✗ diagram-${diagramIndex} from ${sourceFile}: ${err.message}`);
      return `> **[Diagram ${diagramIndex}]** — render failed; see source for Mermaid code\n\n${match}`;
    }
  });

  content = content.replace(/__PROTECTED_BLOCK_(\d+)__/g, (_, idx) => savedBlocks[Number(idx)]);
  return content;
}

// --- Cover page SVG --------------------------------------------------
function buildCoverImageDataUri() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500" width="600" height="500">
  <rect width="600" height="500" fill="#f0f7ff" rx="20"/>
  <rect x="0" y="380" width="600" height="120" fill="#e8f5e9"/>
  <rect x="50" y="380" width="500" height="4" fill="#66bb6a" rx="2"/>
  <rect x="160" y="390" width="60" height="8" fill="#fff" rx="2"/>
  <rect x="260" y="390" width="60" height="8" fill="#fff" rx="2"/>
  <rect x="360" y="390" width="60" height="8" fill="#fff" rx="2"/>
  <text x="300" y="430" text-anchor="middle" font-family="Arial" font-size="14" fill="#388e3c" font-weight="bold">LANDING ZONE</text>
  <ellipse cx="300" cy="200" rx="130" ry="80" fill="#fff" stroke="#90caf9" stroke-width="3"/>
  <ellipse cx="210" cy="220" rx="70" ry="55" fill="#fff" stroke="#90caf9" stroke-width="3"/>
  <ellipse cx="390" cy="220" rx="70" ry="55" fill="#fff" stroke="#90caf9" stroke-width="3"/>
  <ellipse cx="250" cy="170" rx="60" ry="50" fill="#fff" stroke="#90caf9" stroke-width="3"/>
  <ellipse cx="350" cy="170" rx="60" ry="50" fill="#fff" stroke="#90caf9" stroke-width="3"/>
  <ellipse cx="300" cy="200" rx="127" ry="77" fill="#fff"/>
  <ellipse cx="210" cy="220" rx="67" ry="52" fill="#fff"/>
  <ellipse cx="390" cy="220" rx="67" ry="52" fill="#fff"/>
  <ellipse cx="250" cy="170" rx="57" ry="47" fill="#fff"/>
  <ellipse cx="350" cy="170" rx="57" ry="47" fill="#fff"/>
  <ellipse cx="300" cy="145" rx="55" ry="12" fill="#f9a825"/>
  <path d="M250,145 Q250,105 300,100 Q350,105 350,145" fill="#fbc02d" stroke="#f57f17" stroke-width="2"/>
  <rect x="290" y="95" width="20" height="10" fill="#f57f17" rx="5"/>
  <circle cx="275" cy="200" r="8" fill="#1565c0"/>
  <circle cx="325" cy="200" r="8" fill="#1565c0"/>
  <circle cx="278" cy="197" r="3" fill="#fff"/>
  <circle cx="328" cy="197" r="3" fill="#fff"/>
  <path d="M275,230 Q300,255 325,230" fill="none" stroke="#1565c0" stroke-width="3" stroke-linecap="round"/>
  <rect x="380" y="230" width="80" height="16" fill="#bbdefb" stroke="#1565c0" stroke-width="1.5" rx="3" transform="rotate(-15,420,238)"/>
  <circle cx="383" cy="234" r="8" fill="#90caf9" stroke="#1565c0" stroke-width="1.5" transform="rotate(-15,420,238)"/>
  <rect x="140" y="235" width="45" height="7" fill="#78909c" rx="2" transform="rotate(20,162,238)"/>
  <circle cx="140" cy="237" r="10" fill="none" stroke="#78909c" stroke-width="4" transform="rotate(20,162,238)"/>
  <polygon points="300,165 285,190 315,190" fill="#0078d4" opacity="0.3"/>
  <text x="130" y="130" font-family="monospace" font-size="16" fill="#7b1fa2" opacity="0.5" transform="rotate(-10,130,130)">{ }</text>
  <text x="440" y="140" font-family="monospace" font-size="14" fill="#e65100" opacity="0.5" transform="rotate(8,440,140)">*.tf</text>
  <text x="470" y="170" font-family="monospace" font-size="12" fill="#1565c0" opacity="0.5">main.bicep</text>
  <text x="100" y="165" font-family="monospace" font-size="12" fill="#2e7d32" opacity="0.5">CI/CD</text>
  <ellipse cx="80" cy="80" rx="40" ry="20" fill="#e3f2fd" opacity="0.6"/>
  <ellipse cx="60" cy="85" rx="25" ry="15" fill="#e3f2fd" opacity="0.6"/>
  <ellipse cx="520" cy="60" rx="35" ry="18" fill="#e3f2fd" opacity="0.6"/>
  <ellipse cx="540" cy="65" rx="25" ry="13" fill="#e3f2fd" opacity="0.6"/>
  <path d="M490,280 Q490,260 480,260 Q470,260 470,280" fill="#ef5350" stroke="#c62828" stroke-width="1"/>
  <path d="M470,280 Q470,260 460,260 Q450,260 450,280" fill="#fff" stroke="#c62828" stroke-width="1"/>
  <path d="M450,280 Q450,260 440,260 Q430,260 430,280" fill="#ef5350" stroke="#c62828" stroke-width="1"/>
  <line x1="430" y1="280" x2="455" y2="320" stroke="#795548" stroke-width="1"/>
  <line x1="460" y1="280" x2="460" y2="320" stroke="#795548" stroke-width="1"/>
  <line x1="490" y1="280" x2="465" y2="320" stroke="#795548" stroke-width="1"/>
  <rect x="450" y="320" width="20" height="15" fill="#42a5f5" stroke="#1565c0" stroke-width="1" rx="2"/>
  <text x="460" y="332" text-anchor="middle" font-family="Arial" font-size="7" fill="#fff" font-weight="bold">SUB</text>
  <path d="M130,300 Q130,283 122,283 Q114,283 114,300" fill="#66bb6a" stroke="#2e7d32" stroke-width="1"/>
  <path d="M114,300 Q114,283 106,283 Q98,283 98,300" fill="#fff" stroke="#2e7d32" stroke-width="1"/>
  <line x1="98" y1="300" x2="110" y2="335" stroke="#795548" stroke-width="1"/>
  <line x1="114" y1="300" x2="114" y2="335" stroke="#795548" stroke-width="1"/>
  <line x1="130" y1="300" x2="118" y2="335" stroke="#795548" stroke-width="1"/>
  <rect x="104" y="335" width="20" height="15" fill="#42a5f5" stroke="#1565c0" stroke-width="1" rx="2"/>
  <text x="114" y="347" text-anchor="middle" font-family="Arial" font-size="7" fill="#fff" font-weight="bold">SUB</text>
  <text x="300" y="470" text-anchor="middle" font-family="Georgia" font-size="13" fill="#555" font-style="italic">"Don't worry, I've read the best practices guide."</text>
</svg>`;

  const svgPath = join(outDir, 'cover.svg');
  const pngPath = join(outDir, 'cover.png');
  writeFileSync(svgPath, svg);

  try {
    execSync(`npx --yes svgexport "${svgPath}" "${pngPath}" 2x`, {
      timeout: 120_000, cwd: repoRoot,
    });
    return `data:image/png;base64,${readFileSync(pngPath).toString('base64')}`;
  } catch {
    console.warn('  ⚠ svgexport unavailable — embedding SVG directly');
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }
}

// --- Chapter manifest ------------------------------------------------
const chapters = [
  '01-repository-topology.md', '02-iac-tooling.md', '03-modules-and-registries.md',
  '04-branching-and-environments.md', '05-authentication.md', '06-security.md',
  '07-state-management.md', '08-cicd-pipelines.md', '09-testing-and-policy.md',
  '10-code-quality.md', '11-manageability.md', '12-naming-and-tagging.md',
  '13-documentation.md', '14-anti-patterns.md', 'references.md',
];

// --- Unicode normalisation -------------------------------------------
// Replace multi-byte Unicode punctuation with ASCII equivalents so the
// PDF renderer never produces mojibake, regardless of charset detection.
function normaliseUnicode(text) {
  return text
    .replace(/\u2014/g, '--')   // em-dash —
    .replace(/\u2013/g, '-')    // en-dash –
    .replace(/\u2011/g, '-')    // non-breaking hyphen ‑
    .replace(/\u2018/g, "'")    // left single quote '
    .replace(/\u2019/g, "'")    // right single quote '
    .replace(/\u201C/g, '"')    // left double quote "
    .replace(/\u201D/g, '"')    // right double quote "
    .replace(/\u2026/g, '...')  // ellipsis …
    .replace(/\u00A0/g, ' ')    // non-breaking space
    .replace(/\u200B/g, '');    // zero-width space
}

// --- Assemble --------------------------------------------------------
const { sha, prettyDate } = gitMeta();
console.log(`Building PDF for ${sha} (${prettyDate})\n`);

const coverImg = buildCoverImageDataUri();
const parts = [];

// UTF-8 declaration
parts.push('<meta charset="utf-8">\n\n');

// Cover page
parts.push(`
<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center;">
<div style="margin-bottom:2em;">
  <img src="${coverImg}" alt="Cover" style="max-width:55%;display:block;margin:0 auto;" />
</div>
<h1 style="font-size:28pt;border:none;margin-bottom:0.2em;padding-bottom:0;">Azure Landing Zones</h1>
<h2 style="font-size:18pt;border:none;color:#555;margin-top:0;font-weight:normal;">Infrastructure-as-Code Repository Best Practices</h2>
<div style="margin-top:2em;color:#777;font-size:11pt;">
  <p><strong>Repository:</strong> erjosito/alz-repo-best-practices</p>
  <p><strong>Version:</strong> ${sha} &middot; ${prettyDate}</p>
  <p style="margin-top:1.5em;font-size:10pt;">A field guide for DevOps architects and platform engineers</p>
</div>
</div>
<div class="page-break"></div>
`);

// README (trimmed before "Contributing")
const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
parts.push(normaliseUnicode(readme.split('## Contributing')[0].trim()));
parts.push('\n\n<div class="page-break"></div>\n\n');

// Chapters
for (const file of chapters) {
  console.log(`Processing ${file}...`);
  let content = readFileSync(join(docsDir, file), 'utf8').replace(/\r\n/g, '\n');
  content = normaliseUnicode(content);
  content = content.replace(/\]\((\d{2}-[^)]+)\.md\)/g, '](#$1)');
  content = renderMermaidBlocks(content, file);
  parts.push(content);
  parts.push('\n\n<div class="page-break"></div>\n\n');
}

writeFileSync(outPath, parts.join('\n'), 'utf8');
console.log(`\n✅ Combined markdown ready — ${diagramIndex} diagrams, version ${sha}`);
console.log(`   → ${outPath}`);
