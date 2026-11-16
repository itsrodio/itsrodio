import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { PROFILE_CONFIG as cfg, type ShaderPreset } from './profile.config.js';
import {
  SHADER_PRESETS,
  buildSvg,
  fetchGithubStats,
  getShaderPresetConfig,
  type GithubStatsData,
} from './profile-fetch.js';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatMonthDay(mmdd: string): string {
  const [mStr, dStr] = mmdd.split('-');
  const monthIdx = (Number(mStr) || 1) - 1;
  const month = MONTH_NAMES[monthIdx] ?? 'Jan';
  const day = String(Number(dStr) || 1).padStart(2, '0');
  return `${month} ${day}`;
}

function getPresetScheduleLabel(preset: ShaderPreset): string {
  const rule = cfg.shader.schedule.find((r) => r.shader === preset);
  if (!rule) {
    return preset === cfg.shader.default ? 'Default' : 'Custom';
  }
  return `${formatMonthDay(rule.from)} – ${formatMonthDay(rule.to)}`;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
}

function buildPreviewCardsHtml(stats: GithubStatsData | null): string {
  const presetIds = Object.keys(SHADER_PRESETS) as ShaderPreset[];

  return presetIds
    .map((id) => {
      const meta = getShaderPresetConfig(id);
      const dates = getPresetScheduleLabel(id);
      const darkSvg = buildSvg(stats, { overridePreset: id, forceColorScheme: 'dark' });
      const lightSvg = buildSvg(stats, { overridePreset: id, forceColorScheme: 'light' });

      const darkUri = svgToDataUri(darkSvg);
      const lightUri = svgToDataUri(lightSvg);

      return `
      <div class="card" data-preset="${id}">
        <div class="card-header">
          <div>
            <h2>${meta.title}</h2>
            <span class="dates">${dates}</span>
          </div>
          <span class="badge">${meta.badge}</span>
        </div>
        <div class="svg-wrap theme-dark-svg">
          <img src="${darkUri}" alt="${meta.title} (Dark)" />
        </div>
        <div class="svg-wrap theme-light-svg">
          <img src="${lightUri}" alt="${meta.title} (Light)" />
        </div>
      </div>`;
    })
    .join('\n');
}

function buildPreviewHtml(cardsHtml: string, withLiveReload = false): string {
  const presetIds = Object.keys(SHADER_PRESETS) as ShaderPreset[];
  const filterButtonsHtml = [
    `<button class="active" data-filter="all">All (${presetIds.length})</button>`,
    ...presetIds.map((id) => {
      const shortLabel = getShaderPresetConfig(id).title.split(' (')[0] ?? id;
      return `<button data-filter="${id}">${shortLabel}</button>`;
    }),
  ].join('\n        ');

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
      <p>All ${presetIds.length} presets rendered directly from <code>src/profile-fetch.ts</code></p>
    </div>
    <div class="controls">
      <div class="btn-group" id="preset-filter">
        ${filterButtonsHtml}
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
  const cardsHtml = buildPreviewCardsHtml(stats);

  const previewHtmlPath = path.resolve('dist/preview.html');
  fs.mkdirSync(path.dirname(previewHtmlPath), { recursive: true });
  fs.writeFileSync(previewHtmlPath, buildPreviewHtml(cardsHtml, false), 'utf-8');
  console.log('Static preview saved to dist/preview.html');

  if (once) {
    return;
  }

  const liveHtml = buildPreviewHtml(cardsHtml, true);
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

    if (req.url === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(liveHtml);
  });

  // Debounced watcher for changes in src/
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  fs.watch(path.resolve('src'), { recursive: true }, () => {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const client of clients) {
        client.write('data: reload\n\n');
      }
    }, 100);
  });

  server.listen(port, () => {
    console.log(`\n✨ Live Shader Preview running at http://localhost:${port}`);
    console.log('   (Also saved standalone file at dist/preview.html)\n');
  });
}

run();
