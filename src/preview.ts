import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { PROFILE_CONFIG as cfg, type ShaderPreset } from './profile.config.js';
import { buildSvg, fetchGithubStats, type GithubStatsData } from './profile-fetch.js';

const PRESETS: { id: ShaderPreset; title: string; badge: string; dates: string }[] = [
  { id: 'plasma', title: 'Plasma (Default)', badge: '60×26 Hi-Res · Contour Wave', dates: 'Default' },
  { id: 'pumpkin', title: 'Pumpkin (Halloween)', badge: '60×26 Hi-Res · Candlelight', dates: 'Oct 29 – Nov 01' },
  { id: 'snow', title: 'Snow & Tree (New Year)', badge: '60×26 Hi-Res · Multi-Color', dates: 'Dec 20 – Jan 10' },
  { id: 'heart', title: "Heart (Valentine's)", badge: '60×26 Hi-Res · 3D Specular', dates: 'Feb 13 – Feb 15' },
  { id: 'matrix', title: 'Matrix (Programmer Day)', badge: '60×26 Hi-Res · Phosphor Rain', dates: 'Sep 12 – Sep 14' },
  { id: 'fireworks', title: 'Fireworks (Birthday)', badge: '60×26 Hi-Res · Multi-Burst', dates: 'Sep 01 – Sep 03' },
];

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

function buildPreviewHtml(stats: GithubStatsData | null, withLiveReload = false): string {
  const cardsHtml = PRESETS.map((p) => {
    const darkSvg = buildSvg(stats, { overridePreset: p.id, forceColorScheme: 'dark' });
    const lightSvg = buildSvg(stats, { overridePreset: p.id, forceColorScheme: 'light' });

    const darkUri = svgToDataUri(darkSvg);
    const lightUri = svgToDataUri(lightSvg);

    return `
      <div class="card" data-preset="${p.id}">
        <div class="card-header">
          <div>
            <h2>${p.title}</h2>
            <span class="dates">${p.dates}</span>
          </div>
          <span class="badge">${p.badge}</span>
        </div>
        <div class="svg-wrap theme-dark-svg">
          <img src="${darkUri}" alt="${p.title} (Dark)" />
        </div>
        <div class="svg-wrap theme-light-svg">
          <img src="${lightUri}" alt="${p.title} (Light)" />
        </div>
      </div>`;
  }).join('\n');

  const liveReloadScript = withLiveReload
    ? `<script>
        let bootId = null;
        const es = new EventSource('/__events');
        es.onmessage = (e) => {
          if (e.data === 'reload' || (bootId && bootId !== e.data)) {
            location.reload();
          }
          bootId = e.data;
        };
      </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Profile SVG Shader Preview — @${cfg.githubUsername}</title>
  <style>
    :root {
      --page-bg: #090d13;
      --card-bg: #111722;
      --border: #262c36;
      --text: #e6edf3;
      --muted: #8b949e;
      --accent: #2D68C4;
      --accent-2: #6E56CF;
    }
    html[data-theme="light"] {
      --page-bg: #f3f5f8;
      --card-bg: #ffffff;
      --border: #d0d7de;
      --text: #1f2328;
      --muted: #57606a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--page-bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 28px 32px 60px;
      transition: background 0.2s, color 0.2s;
    }
    header {
      max-width: 1740px;
      margin: 0 auto 28px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .brand h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .brand p {
      font-size: 13px;
      color: var(--muted);
      margin-top: 4px;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
    .btn-group {
      display: inline-flex;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 3px;
      gap: 3px;
    }
    button {
      background: transparent;
      color: var(--muted);
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    button:hover {
      color: var(--text);
    }
    button.active {
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      color: #ffffff;
    }
    .grid {
      max-width: 1740px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(760px, 1fr));
      gap: 24px;
    }
    .grid.single-col {
      grid-template-columns: minmax(0, 960px);
      justify-content: center;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .card.hidden {
      display: none;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-header h2 {
      font-size: 15px;
      font-weight: 600;
    }
    .dates {
      font-size: 12px;
      color: var(--muted);
    }
    .badge {
      font-size: 11.5px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 4px 8px;
      border-radius: 6px;
      background: rgba(110, 86, 207, 0.15);
      color: #a78bfa;
      border: 1px solid rgba(110, 86, 207, 0.3);
    }
    html[data-theme="light"] .badge {
      color: #5b21b6;
      background: rgba(110, 86, 207, 0.1);
    }
    .svg-wrap {
      width: 100%;
      overflow: hidden;
      border-radius: 10px;
    }
    .svg-wrap img {
      width: 100%;
      height: auto;
      display: block;
    }
    html[data-theme="dark"] .theme-light-svg { display: none; }
    html[data-theme="light"] .theme-dark-svg { display: none; }
    html[data-theme="both"] .theme-light-svg,
    html[data-theme="both"] .theme-dark-svg { display: block; }
    @media (max-width: 840px) {
      .grid { grid-template-columns: 1fr; }
      body { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>Terminal Shader Preview Gallery</h1>
      <p>All 6 presets rendered directly from <code>src/profile-fetch.ts</code></p>
    </div>
    <div class="controls">
      <div class="btn-group" id="preset-filter">
        <button class="active" data-filter="all">All (6)</button>
        <button data-filter="plasma">Plasma</button>
        <button data-filter="pumpkin">Pumpkin</button>
        <button data-filter="snow">Snow Tree</button>
        <button data-filter="heart">Heart</button>
        <button data-filter="matrix">Matrix</button>
        <button data-filter="fireworks">Fireworks</button>
      </div>
      <div class="btn-group" id="theme-switcher">
        <button class="active" data-set-theme="dark">Dark</button>
        <button data-set-theme="light">Light</button>
        <button data-set-theme="both">Compare Both</button>
      </div>
    </div>
  </header>

  <main class="grid" id="cards-grid">
    ${cardsHtml}
  </main>

  <script>
    const grid = document.getElementById('cards-grid');
    const cards = document.querySelectorAll('.card');

    document.getElementById('preset-filter').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('#preset-filter button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      grid.classList.toggle('single-col', filter !== 'all');
      cards.forEach((c) => {
        c.classList.toggle('hidden', filter !== 'all' && c.dataset.preset !== filter);
      });
    });

    document.getElementById('theme-switcher').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll('#theme-switcher button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.documentElement.setAttribute('data-theme', btn.dataset.setTheme);
    });
  </script>
  ${liveReloadScript}
</body>
</html>`;
}

async function run() {
  const once = process.argv.includes('--once');
  const port = Number(process.env.PORT ?? 3333);

  console.log('Fetching GitHub stats for preview...');
  const stats = await fetchGithubStats(cfg.githubUsername);

  const previewHtmlPath = path.resolve('dist/preview.html');
  fs.mkdirSync(path.dirname(previewHtmlPath), { recursive: true });
  fs.writeFileSync(previewHtmlPath, buildPreviewHtml(stats, false), 'utf-8');
  console.log(`Static preview saved to dist/preview.html`);

  if (once) {
    return;
  }

  const bootId = Date.now().toString();
  const clients = new Set<http.ServerResponse>();

  const server = http.createServer((req, res) => {
    if (req.url === '/__events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${bootId}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildPreviewHtml(stats, true));
  });

  // Watch src directory for changes when running via `tsx watch` or direct `tsx`
  fs.watch(path.resolve('src'), { recursive: true }, () => {
    for (const client of clients) {
      client.write('data: reload\n\n');
    }
  });

  server.listen(port, () => {
    console.log(`\n✨ Live Shader Preview running at http://localhost:${port}`);
    console.log(`   (Also saved standalone file at dist/preview.html)\n`);
  });
}

run();
