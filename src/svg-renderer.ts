import { formatGithubStats } from './github-stats.js';
import { PROFILE_CONFIG as cfg } from './profile.config.js';
import { generateShaderFrame, resolveActiveShader } from './shaders.js';
import type {
  ActiveShaderInfo,
  Cell,
  GithubStatsData,
  InfoItemValue,
  ShaderPreset,
  UptimeValue,
} from './types.js';

const HIRES_LINE_HEIGHT = 12.5;
const INFO_ROW_HEIGHT = 22;

// Format Uptime in UTC so GitHub Actions runner timezone never shifts the date
export function formatUptime(
  { birthDate, units = ['y', 'm', 'd'], short = false }: UptimeValue,
  now = new Date()
): string {
  const partsDate = birthDate.split('-').map(Number);
  const birthYear = partsDate[0] ?? 2006;
  const birthMonth = (partsDate[1] ?? 1) - 1;
  const birthDay = partsDate[2] ?? 1;

  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const nowDay = now.getUTCDate();

  let years = nowYear - birthYear;
  let months = nowMonth - birthMonth;
  let days = nowDay - birthDay;

  if (days < 0) {
    months--;
    const daysInPrevMonth = new Date(Date.UTC(nowYear, nowMonth, 0)).getUTCDate();
    days += daysInPrevMonth;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (!units.includes('y') && units.includes('m')) {
    months += years * 12;
  }
  if (!units.includes('y') && !units.includes('m') && units.includes('d')) {
    const birthUtc = Date.UTC(birthYear, birthMonth, birthDay);
    const nowUtc = Date.UTC(nowYear, nowMonth, nowDay);
    days = Math.floor((nowUtc - birthUtc) / (1000 * 60 * 60 * 24));
  }

  const parts: string[] = [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  if (units.includes('y') && (years > 0 || units.length === 1)) {
    parts.push(short ? `${years}y` : plural(years, 'year'));
  }
  if (units.includes('m') && (months > 0 || units.length === 1)) {
    parts.push(short ? `${months}m` : plural(months, 'month'));
  }
  if (units.includes('d') && (days > 0 || units.length === 1)) {
    parts.push(short ? `${days}d` : plural(days, 'day'));
  }

  return parts.join(short ? ' ' : ', ');
}

export function formatTimezone(tz: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC+1';
    const utcOffset = offsetPart.replace('GMT', 'UTC');
    return `${tz} (${utcOffset})`;
  } catch {
    return `${tz} (UTC+1)`;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatInfoValue(
  value: InfoItemValue,
  stats: GithubStatsData | null,
  activeShader: ActiveShaderInfo,
  now: Date
): string {
  if (typeof value === 'string') {
    return value;
  }
  switch (value.type) {
    case 'github':
      return formatGithubStats(value, stats);
    case 'shader':
      return activeShader.eventName
        ? `${activeShader.preset} (${activeShader.eventName})`
        : activeShader.preset;
    case 'timezone':
      return formatTimezone(value.timeZone, now);
    case 'uptime':
    default:
      return formatUptime(value, now);
  }
}

// Convert a row of Cell[] into run-length encoded <tspan> segments to keep SVG compact
function renderRowTspans(row: Cell[], rowIndex: number, lineHeight: number): string {
  const dy = rowIndex === 0 ? 0 : lineHeight;

  interface Run {
    c: number | undefined;
    text: string;
  }
  const runs: Run[] = [];

  let initialColor: number | undefined;
  for (const cell of row) {
    if (cell.ch !== ' ' && cell.c !== undefined) {
      initialColor = cell.c;
      break;
    }
  }

  let currentColor = initialColor;
  let currentText = '';

  for (const cell of row) {
    const nextColor = cell.ch === ' ' ? currentColor : cell.c;
    if (nextColor !== currentColor && currentText.length > 0) {
      runs.push({ c: currentColor, text: currentText });
      currentColor = nextColor;
      currentText = cell.ch;
    } else {
      currentText += cell.ch;
    }
  }
  if (currentText.length > 0) {
    runs.push({ c: currentColor, text: currentText });
  }

  return runs
    .map((run, idx) => {
      const posAttr = idx === 0 ? ` x="28" dy="${dy}"` : '';
      const clsAttr = run.c !== undefined ? ` class="c${run.c}"` : '';
      return `<tspan${posAttr}${clsAttr}>${escapeXml(run.text)}</tspan>`;
    })
    .join('');
}

export function buildSvg(
  stats: GithubStatsData | null,
  options?: {
    overridePreset?: ShaderPreset;
    forceColorScheme?: 'light' | 'dark';
    now?: Date;
  }
): string {
  const now = options?.now ?? new Date();
  const { width, rightColX, rows: activeRows, frames, fps } = cfg.layout;
  const { terminal, info, theme } = cfg;
  const duration = Number((frames / fps).toFixed(3));
  const activeShader = resolveActiveShader(now, options?.overridePreset);

  const activeLineHeight = HIRES_LINE_HEIGHT;
  const shaderStartY = 84;
  const shaderClass = 'mono-hires shader-text';

  const lightPaletteVars = activeShader.colorsLight
    .map((col, i) => `--c${i}: ${col};`)
    .join('\n      ');
  const darkPaletteVars = activeShader.colorsDark
    .map((col, i) => `--c${i}: ${col};`)
    .join('\n        ');
  const paletteClassesCss = activeShader.colorsLight
    .map((_, i) => `.c${i} { fill: var(--c${i}); }`)
    .join('\n    ');

  const displayInfo: typeof info = activeShader.greeting
    ? [...info, { label: 'Event', value: activeShader.greeting }]
    : info;

  const shaderBottom = shaderStartY + activeRows * activeLineHeight;
  const paletteY = 112 + displayInfo.length * INFO_ROW_HEIGHT + 8;
  const bottomPromptY = Math.max(shaderBottom, paletteY + 14) + 28;
  const height =
    (terminal.showBottomCursor ? bottomPromptY : Math.max(shaderBottom, paletteY + 14)) + 24;

  const stepPct = (100 / frames).toFixed(4);
  const frameDelaysCss = Array.from({ length: frames }, (_, i) => {
    const delay = ((i / frames) * duration).toFixed(4);
    return `.f-${i} { animation-delay: ${delay}s; }`;
  }).join('\n      ');

  const shaderLayers = Array.from({ length: frames }, (_, f) => {
    const rows = generateShaderFrame(activeShader.preset, f);
    const tspans = rows
      .map((row, idx) => renderRowTspans(row, idx, activeLineHeight))
      .join('');
    return `<g class="frame f-${f}"><text y="${shaderStartY}" class="${shaderClass}" xml:space="preserve">${tspans}</text></g>`;
  }).join('\n  ');

  const infoLines = displayInfo
    .map((item, idx) => {
      const y = 112 + idx * INFO_ROW_HEIGHT;
      if ('type' in item) {
        const lineText = item.title
          ? `── ${item.title} ${'─'.repeat(Math.max(0, terminal.dividerLength - item.title.length - 4))}`
          : '─'.repeat(terminal.dividerLength);
        return `
  <text x="${rightColX}" y="${y}" class="mono muted">${escapeXml(lineText)}</text>`;
      }
      const textValue = formatInfoValue(item.value, stats, activeShader, now);
      return `
  <text x="${rightColX}" y="${y}" class="mono">
    <tspan class="accent bold">${escapeXml(item.label)}:</tspan>
    <tspan class="fg" dx="6">${escapeXml(textValue)}</tspan>
  </text>`;
    })
    .join('');

  const paletteBoxes = activeShader.swatches
    .map(
      (color, i) =>
        `<rect x="${rightColX + i * 24}" y="${paletteY}" width="18" height="12" rx="3" fill="${color}" />`
    )
    .join('\n  ');

  const divider = '─'.repeat(terminal.dividerLength);

  const bottomPromptSvg = terminal.showBottomCursor
    ? `
  <text x="28" y="${bottomPromptY}" class="mono">
    <tspan class="prompt bold">${escapeXml(terminal.prompt)}</tspan>
    <tspan class="cursor" dx="6">█</tspan>
  </text>`
    : '';

  const activeTheme = options?.forceColorScheme;
  const rootThemeVars = (mode: 'light' | 'dark') => `
      --bg: ${theme[mode].bg};
      --header-bg: ${theme[mode].headerBg};
      --border: ${theme[mode].border};
      --fg: ${theme[mode].fg};
      --muted: ${theme[mode].muted};
      --accent: ${theme[mode].accent};
      --prompt: ${theme[mode].prompt};
      ${mode === 'light' ? lightPaletteVars : darkPaletteVars}`;

  const themeCss = activeTheme
    ? `:root {${rootThemeVars(activeTheme)}\n    }`
    : `:root {${rootThemeVars('light')}\n    }\n    @media (prefers-color-scheme: dark) {\n      :root {${rootThemeVars('dark')}\n      }\n    }`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    ${themeCss}
    .window-bg { fill: var(--bg); stroke: var(--border); stroke-width: 1.5; }
    .header-bg { fill: var(--header-bg); }
    .mono { font-family: 'SF Mono', Menlo, Monaco, 'JetBrains Mono', Consolas, monospace; font-size: 13.5px; }
    .mono-hires { font-family: 'SF Mono', Menlo, Monaco, 'JetBrains Mono', Consolas, monospace; font-size: 9.8px; font-weight: 600; }
    .title { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif; font-size: 12.5px; font-weight: 500; }
    .bold { font-weight: 700; }
    .fg { fill: var(--fg); }
    .muted { fill: var(--muted); }
    .accent { fill: var(--accent); }
    .prompt { fill: var(--prompt); }
    .shader-text { letter-spacing: 0.35px; }
    ${paletteClassesCss}
    .cursor { fill: var(--prompt); animation: blink 1.1s steps(2, start) infinite; }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    .frame {
      opacity: 0;
      animation: frame-vis ${duration}s steps(1, end) infinite;
    }
    @keyframes frame-vis {
      0%, ${stepPct}% { opacity: 1; }
      ${stepPct}%, 100% { opacity: 0; }
    }
    ${frameDelaysCss}
  </style>

  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10" class="window-bg" />
  <path d="M 2 11 Q 2 2 11 2 L ${width - 11} 2 Q ${width - 2} 2 ${width - 2} 11 L ${width - 2} 36 L 2 36 Z" class="header-bg" />
  <line x1="1" y1="36" x2="${width - 1}" y2="36" stroke="var(--border)" stroke-width="1" />

  <circle cx="20" cy="19" r="6" fill="#ff5f56" />
  <circle cx="40" cy="19" r="6" fill="#ffbd2e" />
  <circle cx="60" cy="19" r="6" fill="#27c93f" />

  <text x="${width / 2}" y="23" text-anchor="middle" class="title muted">${escapeXml(terminal.windowTitle)}</text>

  <text x="28" y="62" class="mono">
    <tspan class="prompt bold">${escapeXml(terminal.prompt)}</tspan>
    <tspan class="fg" dx="6">${escapeXml(terminal.command)}</tspan>
  </text>

  ${shaderLayers}

  <text x="${rightColX}" y="88" class="mono bold accent">${escapeXml(terminal.userHeader)}</text>
  <text x="${rightColX}" y="100" class="mono muted">${divider}</text>${infoLines}
  ${paletteBoxes}${bottomPromptSvg}
</svg>`;
}
