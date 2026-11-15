import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROFILE_CONFIG as cfg,
  type GithubStatsValue,
  type InfoItemValue,
  type ShaderPreset,
  type ShaderScheduleRule,
  type UptimeValue,
} from './profile.config.js';

const HIRES_LINE_HEIGHT = 12.5;
const INFO_ROW_HEIGHT = 22;

export interface GithubStatsData {
  repos: number;
  stars: number;
  commits: number;
  followers: number;
}

export interface Cell {
  ch: string;
  /** Semantic color class index (0..9) */
  c?: number;
}

// 1. Format Uptime in UTC so GitHub Actions runner timezone never shifts the date
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

// 2. Proper XML escaping
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 3. Date-based shader resolution (supports cross-year ranges like 12-20 to 01-10)
function parseMonthDay(mmdd: string): number {
  const [m, d] = mmdd.split('-').map(Number);
  return (m ?? 1) * 100 + (d ?? 1);
}

export interface ActiveShaderInfo {
  preset: ShaderPreset;
  eventName: string | null;
  greeting: string | null;
  swatches: readonly string[];
  colorsLight: readonly string[];
  colorsDark: readonly string[];
}

function buildShaderInfo(preset: ShaderPreset, matchedRule?: ShaderScheduleRule): ActiveShaderInfo {
  const presetCfg = cfg.shader.presets[preset];
  const presetGreeting = 'greeting' in presetCfg ? presetCfg.greeting : null;
  return {
    preset,
    eventName: matchedRule?.name ?? null,
    greeting: matchedRule?.greeting ?? presetGreeting ?? null,
    swatches: presetCfg.swatches,
    colorsLight: presetCfg.colorsLight,
    colorsDark: presetCfg.colorsDark,
  };
}

export function resolveActiveShader(now = new Date(), overridePreset?: ShaderPreset): ActiveShaderInfo {
  if (overridePreset) {
    const matchedRule = cfg.shader.schedule.find((r) => r.shader === overridePreset);
    return buildShaderInfo(overridePreset, matchedRule);
  }

  if (cfg.shader.mode !== 'auto') {
    const preset = cfg.shader.mode;
    const matchedRule = cfg.shader.schedule.find((r) => r.shader === preset);
    return buildShaderInfo(preset, matchedRule);
  }

  const currentMd = (now.getUTCMonth() + 1) * 100 + now.getUTCDate();

  for (const rule of cfg.shader.schedule) {
    const startMd = parseMonthDay(rule.from);
    const endMd = parseMonthDay(rule.to);

    const isMatch =
      startMd <= endMd
        ? currentMd >= startMd && currentMd <= endMd
        : currentMd >= startMd || currentMd <= endMd;

    if (isMatch) {
      return buildShaderInfo(rule.shader, rule);
    }
  }

  return buildShaderInfo(cfg.shader.default);
}

// 4. ASCII Shader Generators
function sampleAscii(value01: number): string {
  const { asciiRamp } = cfg.layout;
  const clamped = Math.max(0, Math.min(0.9999, value01));
  const idx = Math.floor(clamped * asciiRamp.length);
  return asciiRamp[idx] ?? ' ';
}

// 4a. Plasma (High-Res 60x26 grid with dynamic 6-stop contour & energy core coloring)
// Palette: c0=deep navy trough, c1=primary blue, c2=royal indigo, c3=amethyst violet, c4=bright periwinkle crest, c5=glowing lavender core
function generatePlasmaFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const t = (frameIndex / frames) * Math.PI * 2;
  const grid: Cell[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) {
      const nx = (x / cols - 0.5) * 2.2;
      const ny = (y / rows - 0.5) * 2.2 * 1.5;

      const v1 = Math.sin(nx * 2.8 + t);
      const v2 = Math.sin(ny * 2.8 + t);
      const v3 = Math.sin((nx + ny) * 2.4 - t);
      const dist = Math.sqrt(nx * nx + ny * ny);
      const v4 = Math.sin(dist * 4.2 - t * 2);

      const value = (v1 + v2 + v3 + v4 + 4) / 8;
      const ch = sampleAscii(value);

      // Color follows wave energy + subtle phase shift so colors flow organically with the plasma
      const colorIdx =
        value > 0.80
          ? 5
          : value > 0.66
            ? 4
            : value > 0.52
              ? 3
              : value > 0.38
                ? 2
                : value > 0.24
                  ? 1
                  : 0;

      row.push({ ch, c: colorIdx });
    }
    grid.push(row);
  }
  return grid;
}

// 4b. Halloween Jack-o'-lantern Pumpkin (High-Res 60x26, stationary with realistic flickering candlelight)
// Palette: c0=stem, c1=dark contour/ribs, c2=mid orange, c3=bright orange, c4=inner rim/amber, c5=flame gold, c6=flame hot core
function generatePumpkinFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const t = (frameIndex / frames) * Math.PI * 2;

  // Smooth candlelight physics (swaying flame + multi-harmonic flicker, zero vertical jitter)
  const flameSway = 0.09 * Math.sin(t) + 0.04 * Math.cos(t * 2);
  const candlePower = 0.86 + 0.14 * (0.6 * Math.sin(t * 2) + 0.4 * Math.cos(t * 3));

  const grid: Cell[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) {
      const nx = (x / (cols - 1) - 0.5) * 2.3;
      const ny = (y / (rows - 1) - 0.54) * 2.1;

      // 1. Curved green pumpkin stem at top
      const stemCurve = 0.09 * Math.pow((ny + 0.65) * 2.2, 2) - 0.03;
      const stemHalfW = 0.085 + 0.05 * (ny + 1.0);
      if (ny >= -1.02 && ny <= -0.63 && Math.abs(nx - stemCurve) <= stemHalfW) {
        const isStemEdge = Math.abs(nx - stemCurve) > stemHalfW * 0.55;
        row.push({ ch: isStemEdge ? '|' : '#', c: 0 });
        continue;
      }

      // 2. Scalloped pumpkin body with 5 distinct vertical ribs
      const ribFreq = 7.2;
      const ribCos = Math.cos(nx * ribFreq);
      const scallop = 0.038 * ribCos;
      const rx = 0.94;
      const ry = 0.75 + scallop;
      const dy = ny - 0.07;
      const bodyDist = (nx * nx) / (rx * rx) + (dy * dy) / (ry * ry);

      if (bodyDist <= 1.0) {
        // Carved triangular eyes
        const leftEyeDist = Math.max(
          -(ny - -0.34),
          ny - 0.01,
          Math.abs(nx - -0.38) * 1.42 - (ny - -0.35)
        );
        const rightEyeDist = Math.max(
          -(ny - -0.34),
          ny - 0.01,
          Math.abs(nx - 0.38) * 1.42 - (ny - -0.35)
        );

        // Carved triangular nose
        const noseDist = Math.max(
          -(ny - -0.01),
          ny - 0.21,
          Math.abs(nx) * 1.45 - (ny - -0.02)
        );

        // Carved grinning mouth with blocky teeth
        const smileCenterY = 0.35 + 0.16 * (1 - nx * nx * 1.75);
        const toothNotch =
          (Math.abs(nx - -0.36) < 0.07 && ny < smileCenterY) ||
          (Math.abs(nx - 0.0) < 0.07 && ny > smileCenterY) ||
          (Math.abs(nx - 0.36) < 0.07 && ny < smileCenterY);
        const mouthHalfH = 0.135 * (1 - Math.pow(nx / 0.72, 2));
        const inMouthOpening =
          Math.abs(nx) < 0.68 &&
          !toothNotch &&
          Math.abs(ny - smileCenterY) < mouthHalfH;

        const isEye = leftEyeDist < 0 || rightEyeDist < 0;
        const isNose = noseDist < 0;

        if (isEye || isNose || inMouthOpening) {
          // Check if we're on the thin carved inner rind bevel
          const isEyeRim = (leftEyeDist > -0.055 && leftEyeDist < 0) || (rightEyeDist > -0.055 && rightEyeDist < 0);
          const isNoseRim = noseDist > -0.05 && noseDist < 0;
          const isMouthRim = inMouthOpening && Math.abs(ny - smileCenterY) > mouthHalfH - 0.04;

          if (isEyeRim || isNoseRim || isMouthRim) {
            row.push({ ch: ':', c: 4 });
          } else {
            // Dynamic rising candle flame inside the carved cavity
            const localSway = flameSway * (1 - ny * 0.6);
            const flameWave =
              Math.sin((nx - localSway) * 10 + ny * 6 - t * 2) * 0.22 +
              Math.cos((nx + localSway) * 7 - t) * 0.15;
            // Brighter near the center of each feature & pulsing with candlePower
            const radialHeat = (1 - Math.abs(nx - localSway) * 0.55 + flameWave) * candlePower;

            if (radialHeat > 0.76) {
              row.push({ ch: '@', c: 6 }); // White-hot flame core
            } else if (radialHeat > 0.58) {
              row.push({ ch: '#', c: 5 }); // Bright gold flame
            } else if (radialHeat > 0.42) {
              row.push({ ch: '*', c: 5 }); // Warm yellow flame
            } else {
              row.push({ ch: '+', c: 4 }); // Deep amber cavity glow
            }
          }
        } else {
          // Pumpkin outer contour & vertical rib grooves
          const isOuterContour = bodyDist > 0.85;
          const isRibGroove = ribCos < -0.68 && bodyDist < 0.88;

          if (isOuterContour) {
            // Crisp outline silhouette
            const edgeChar = Math.abs(nx) > 0.75 ? (nx < 0 ? '(' : ')') : '#';
            row.push({ ch: edgeChar, c: 1 });
          } else if (isRibGroove) {
            // Vertical dark rib crease
            row.push({ ch: '|', c: 1 });
          } else {
            // 3D shaded orange rib segments + warm candlelight reflection
            const sphereZ = Math.sqrt(Math.max(0, 1 - bodyDist));
            const ribRoundness = (ribCos + 1) * 0.5;
            const candleWarmth = Math.max(0, (0.6 - Math.sqrt(nx * nx + dy * dy)) * 0.35 * candlePower);
            const lum = sphereZ * (0.45 + 0.55 * ribRoundness) + candleWarmth;

            if (lum > 0.78) {
              row.push({ ch: '@', c: 3 });
            } else if (lum > 0.58) {
              row.push({ ch: '#', c: 3 });
            } else if (lum > 0.38) {
              row.push({ ch: '*', c: 2 });
            } else {
              row.push({ ch: '+', c: 2 });
            }
          }
        }
      } else {
        // Gentle rising candle embers floating upward on the sides
        row.push({ ch: ' ' });
      }
    }
    grid.push(row);
  }

  // Add 10 smoothly rising warm embers around the pumpkin
  for (let i = 0; i < 10; i++) {
    const progress = (frameIndex / frames + i / 10) % 1;
    const ey = Math.floor((1 - progress) * (rows - 2)) + 1;
    const side = i % 2 === 0 ? -1 : 1;
    const baseCol = side < 0 ? 4 + (i % 7) : cols - 5 - (i % 7);
    const ex = Math.round(baseCol + Math.sin(progress * Math.PI * 2 + i) * 1.5);
    if (ey >= 0 && ey < rows && ex >= 0 && ex < cols && grid[ey]?.[ex]?.ch === ' ') {
      const fade = Math.sin(progress * Math.PI);
      if (fade > 0.3) {
        grid[ey]![ex] = { ch: fade > 0.7 ? '*' : '.', c: fade > 0.7 ? 5 : 4 };
      }
    }
  }

  return grid;
}

// 4c. New Year Decorated Tree under Natural Snowfall (High-Res 60x26)
// Palette: c0=snow white, c1=ice blue, c2=pine dark, c3=pine mid, c4=pine light, c5=gold star/garland, c6=red orn, c7=cyan orn, c8=pink orn, c9=trunk
function generateSnowFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const t = (frameIndex / frames) * Math.PI * 2;
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ch: ' ' }))
  );
  const cx = Math.floor(cols / 2);

  // 1. Layered Pine Tree Tiers (scaled for 60x26 grid)
  const tiers = [
    { startY: 3, endY: 8, topW: 1, spread: 1.5 },
    { startY: 7, endY: 13, topW: 2, spread: 1.7 },
    { startY: 11, endY: 18, topW: 3, spread: 1.9 },
    { startY: 16, endY: 22, topW: 4, spread: 2.1 },
  ];

  for (const tier of tiers) {
    for (let y = tier.startY; y <= tier.endY; y++) {
      const progress = y - tier.startY;
      const halfW = Math.floor(tier.topW + progress * tier.spread);
      for (let dx = -halfW; dx <= halfW; dx++) {
        const x = cx + dx;
        if (x < 1 || x >= cols - 1) continue;

        const isEdge = Math.abs(dx) === halfW;
        const isBottomTip = y === tier.endY && Math.abs(dx) >= halfW - 1;

        if (isBottomTip) {
          // Snow-dusted branch tips
          grid[y]![x] = { ch: '*', c: 0 };
        } else if (isEdge) {
          grid[y]![x] = { ch: dx < 0 ? '/' : '\\', c: dx < 0 ? 4 : 2 };
        } else {
          // Golden tinsel garland draped in gentle wave
          const garlandWave = Math.sin(dx * 0.42 + y * 0.78);
          if (Math.abs(garlandWave) < 0.19) {
            grid[y]![x] = { ch: '~', c: 5 };
          } else {
            // 3D shaded pine needles (lit from top-left)
            const normX = (dx + halfW) / (2 * halfW || 1);
            const needleTex = (x * 3 + y * 5) % 3;
            if (normX < 0.35) {
              grid[y]![x] = { ch: needleTex === 0 ? '*' : '#', c: 4 };
            } else if (normX < 0.72) {
              grid[y]![x] = { ch: needleTex === 0 ? '%' : '#', c: 3 };
            } else {
              grid[y]![x] = { ch: '#', c: 2 };
            }
          }
        }
      }
    }
  }

  // 2. Fixed Festive Ornaments that twinkle in Red (c6), Cyan (c7), Gold (c5), Pink (c8)
  const ornaments = [
    { x: cx - 2, y: 5, c: 6 },
    { x: cx + 2, y: 6, c: 7 },
    { x: cx - 4, y: 9, c: 5 },
    { x: cx + 1, y: 10, c: 8 },
    { x: cx + 5, y: 11, c: 6 },
    { x: cx - 6, y: 13, c: 7 },
    { x: cx - 1, y: 14, c: 6 },
    { x: cx + 4, y: 15, c: 5 },
    { x: cx + 8, y: 16, c: 8 },
    { x: cx - 10, y: 18, c: 6 },
    { x: cx - 4, y: 19, c: 7 },
    { x: cx + 2, y: 19, c: 8 },
    { x: cx + 8, y: 20, c: 6 },
    { x: cx - 7, y: 21, c: 5 },
    { x: cx + 4, y: 21, c: 7 },
  ];

  for (let i = 0; i < ornaments.length; i++) {
    const orn = ornaments[i]!;
    const twinkle = Math.sin(t * 2 + i * 1.3) > 0.15;
    if (grid[orn.y]?.[orn.x]) {
      grid[orn.y]![orn.x] = {
        ch: twinkle ? '@' : 'o',
        c: orn.c,
      };
    }
  }

  // 3. Glowing Star on top of the tree (rows 0..2)
  const starPulse = Math.sin(t * 2) > 0;
  grid[0]![cx] = { ch: starPulse ? '|' : '·', c: 5 };
  grid[1]![cx - 2] = { ch: starPulse ? '·' : ' ', c: 5 };
  grid[1]![cx - 1] = { ch: '—', c: 5 };
  grid[1]![cx] = { ch: '@', c: 5 };
  grid[1]![cx + 1] = { ch: '—', c: 5 };
  grid[1]![cx + 2] = { ch: starPulse ? '·' : ' ', c: 5 };
  grid[2]![cx] = { ch: '^', c: 5 };

  // 4. Tree Trunk (rows 23..24)
  for (let y = rows - 3; y <= rows - 2; y++) {
    for (let dx = -2; dx <= 2; dx++) {
      grid[y]![cx + dx] = { ch: Math.abs(dx) === 2 ? '|' : '#', c: 9 };
    }
  }

  // 5. Snowy Groundhills at bottom (rows 24..25)
  for (let x = 0; x < cols; x++) {
    const hill = Math.sin(x * 0.18) + Math.cos(x * 0.11);
    grid[rows - 1]![x] = { ch: '#', c: 0 };
    if (hill > -0.2 && Math.abs(x - cx) > 3) {
      grid[rows - 2]![x] = { ch: '=', c: 1 };
    }
  }

  // 6. Natural Diagonal & Swirling Snowflakes (no vertical column lines!)
  const numFlakes = 38;
  for (let i = 0; i < numFlakes; i++) {
    // Each flake smoothly progresses from y=0 (sky) to y=rows-2 (snowbank) over the cycle
    const phase = ((i * 29) % numFlakes) / numFlakes;
    const progress = (frameIndex / frames + phase) % 1;

    const yPos = Math.floor(progress * (rows - 1));
    const startX = (i * 41 + 9) % cols;
    // Diagonal breeze + gentle sine wave flutter so flakes never fall in straight vertical lines
    const breeze = (i % 3 === 0 ? 9 : i % 3 === 1 ? 14 : 6) * progress;
    const flutter = Math.sin(progress * Math.PI * 2 + i * 1.7) * 1.8;
    const xPos = Math.floor((startX + breeze + flutter + cols * 2) % cols);

    if (yPos >= 0 && yPos < rows - 1 && xPos >= 0 && xPos < cols) {
      const currentCell = grid[yPos]![xPos]!;
      // Draw snow in empty sky or softly in front of dark foliage
      if (currentCell.ch === ' ') {
        const isForegroundFlake = i % 3 === 0;
        const ch = isForegroundFlake ? '*' : i % 2 === 0 ? '+' : '·';
        grid[yPos]![xPos] = { ch, c: isForegroundFlake ? 0 : 1 };
      }
    }
  }

  return grid;
}

// 4d. High-Res 3D Beating Heart with Full Top Padding & Specular Highlight (High-Res 60x26)
// Palette: c0=deep contour, c1=dark crimson, c2=vibrant ruby, c3=rose highlight, c4=specular shine, c5=pulse wave
function generateHeartFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const t = (frameIndex / frames) * Math.PI * 2;

  // Double-beat lub-dub cardiac rhythm
  const beat =
    1 +
    0.095 * Math.pow(Math.max(0, Math.sin(t)), 4) +
    0.055 * Math.pow(Math.max(0, Math.sin(t + 0.65)), 6);

  const grid: Cell[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) {
      // Unscaledny ranges from +1.50 at y=0 to -1.22 at y=rows-1 so top lobes (at y~1.23) are NEVER clipped
      const rawX = (x / (cols - 1) - 0.5) * 3.0;
      const rawY = 1.50 - (y / (rows - 1)) * 2.72;

      const nx = rawX / beat;
      const ny = rawY / beat;

      // Exact algebraic heart surface: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
      const a = nx * nx + ny * ny - 1;
      const f = a * a * a - nx * nx * ny * ny * ny * 1.18;

      if (f <= 0) {
        // Pseudo-3D depth z from implicit surface distance
        const z = Math.min(1, Math.pow(Math.abs(f), 0.30) * 1.3);
        // Specular highlight on upper-left lobe (-0.42, +0.48)
        const specDist = Math.sqrt((nx + 0.42) * (nx + 0.42) + (ny - 0.48) * (ny - 0.48));
        const specular = Math.max(0, 1 - specDist * 1.65);
        const lum = Math.min(0.99, 0.22 + z * 0.55 + specular * 0.48);

        if (specular > 0.52) {
          row.push({ ch: '@', c: 4 }); // Bright pearl-pink gloss shine
        } else if (z < 0.34) {
          row.push({ ch: '#', c: 0 }); // Crisp dark crimson outer contour
        } else if (lum > 0.76) {
          row.push({ ch: '@', c: 3 }); // Upper lobe bright rose
        } else if (lum > 0.54) {
          row.push({ ch: '#', c: 2 }); // Vibrant ruby mid
        } else {
          row.push({ ch: '*', c: 1 }); // Deep shaded crimson
        }
      } else {
        // Radiating heartbeat aura rings
        const dist = Math.sqrt(nx * nx + (ny - 0.1) * (ny - 0.1));
        const wave = Math.sin(dist * 8.5 - t * 2);
        if (dist < 1.55 && wave > 0.84) {
          row.push({ ch: dist < 1.28 ? '+' : '·', c: 5 });
        } else {
          row.push({ ch: ' ' });
        }
      }
    }
    grid.push(row);
  }
  return grid;
}

// 4e. Authentic High-Res Matrix Digital Rain with 4-Stop Phosphor Coloring (High-Res 60x26)
// Palette: c0=white-mint head, c1=neon green, c2=matrix green, c3=dark emerald tail
function generateMatrixFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const matrixChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$+-*/=<>@#%&~:;';
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ch: ' ' }))
  );

  for (let x = 0; x < cols; x++) {
    const colHash = (x * 73 + 19) % 97;
    if (colHash % 5 === 0) continue;

    const speed = (colHash % 2) + 1;
    const streamLen = 6 + (colHash % 10);
    const phaseOffset = (colHash * 13) % rows;

    const headY = Math.floor((phaseOffset + (frameIndex * speed * rows) / frames) % rows);
    const drops = colHash % 3 === 0 ? [headY, (headY + Math.floor(rows / 2)) % rows] : [headY];

    for (const hY of drops) {
      for (let d = 0; d < streamLen; d++) {
        const y = (hY - d + rows) % rows;
        const fade = 1 - d / streamLen;

        if (d === 0) {
          grid[y]![x] = { ch: '@', c: 0 };
        } else if (d <= 2) {
          const glyphIdx = (x * 11 + y * 7 + frameIndex * 3) % matrixChars.length;
          grid[y]![x] = { ch: matrixChars[glyphIdx]!, c: 1 };
        } else if (fade > 0.52) {
          const mutate = (y + x + Math.floor(frameIndex / 3)) % 7 === 0 ? 1 : 0;
          const glyphIdx = (x * 17 + y * 13 + mutate) % matrixChars.length;
          grid[y]![x] = { ch: matrixChars[glyphIdx]!, c: 2 };
        } else if (fade > 0.26) {
          grid[y]![x] = { ch: (x + y) % 2 === 0 ? ':' : '+', c: 3 };
        } else {
          grid[y]![x] = { ch: '.', c: 3 };
        }
      }
    }
  }

  return grid;
}

// 4f. High-Res Multi-Color Fireworks with Rising Rockets & Gravity (High-Res 60x26)
// Palette: c0=white-gold core, c1=gold, c2=coral-orange, c3=cyan, c4=electric blue, c5=hot pink, c6=neon violet
function generateFireworksFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ch: ' ' }))
  );

  const bursts = [
    { cx: cols * 0.27, cy: rows * 0.34, phase: 0.0, rays: 22, maxR: 13, innerC: 1, outerC: 2 },
    { cx: cols * 0.73, cy: rows * 0.28, phase: 0.33, rays: 24, maxR: 14, innerC: 3, outerC: 4 },
    { cx: cols * 0.49, cy: rows * 0.46, phase: 0.66, rays: 22, maxR: 12.5, innerC: 5, outerC: 6 },
  ];

  for (const b of bursts) {
    const localT = (frameIndex / frames + b.phase) % 1;

    if (localT < 0.2) {
      // Rising rocket with bright white-gold tip and orange spark tail
      const launchProgress = localT / 0.2;
      const rocketY = Math.round(rows - 2 - launchProgress * (rows - 2 - b.cy));
      const rocketX = Math.round(b.cx + Math.sin(launchProgress * 8) * 0.6);
      for (let tail = 0; tail < 4; tail++) {
        const ty = rocketY + tail;
        if (ty >= 0 && ty < rows && rocketX >= 0 && rocketX < cols) {
          grid[ty]![rocketX] = {
            ch: tail === 0 ? '@' : tail === 1 ? '*' : ':',
            c: tail === 0 ? 0 : 1,
          };
        }
      }
    } else {
      // Multi-color explosion with white-hot core, vibrant mid-ring, and glowing outer tips
      const expT = (localT - 0.2) / 0.8;
      const easeOut = 1 - Math.pow(1 - expT, 2.2);
      const radius = easeOut * b.maxR;
      const gravity = expT * expT * 4.2;

      for (let i = 0; i < b.rays; i++) {
        const angle = (i / b.rays) * Math.PI * 2 + b.phase * 2;
        const raySpeed = i % 2 === 0 ? 1.0 : 0.66;

        for (let trail = 0.38; trail <= 1.0; trail += 0.16) {
          const r = radius * raySpeed * trail;
          const x = Math.round(b.cx + Math.cos(angle) * r * 1.55);
          const y = Math.round(b.cy + Math.sin(angle) * r * 0.78 + gravity * trail);

          if (x >= 0 && x < cols && y >= 0 && y < rows) {
            const brightness = (1 - expT * 0.82) * trail;
            const twinkle = (i + frameIndex) % 3 === 0 ? 0.14 : 0;
            const ch = sampleAscii(Math.min(0.99, brightness + twinkle));
            if (ch !== ' ') {
              const colorIdx =
                expT < 0.18 || trail < 0.52 ? 0 : trail < 0.82 ? b.innerC : b.outerC;
              grid[y]![x] = { ch, c: colorIdx };
            }
          }
        }
      }
    }
  }

  return grid;
}

export function generateShaderFrame(preset: ShaderPreset, frameIndex: number): Cell[][] {
  switch (preset) {
    case 'pumpkin':
      return generatePumpkinFrame(frameIndex);
    case 'snow':
      return generateSnowFrame(frameIndex);
    case 'heart':
      return generateHeartFrame(frameIndex);
    case 'matrix':
      return generateMatrixFrame(frameIndex);
    case 'fireworks':
      return generateFireworksFrame(frameIndex);
    case 'plasma':
    default:
      return generatePlasmaFrame(frameIndex);
  }
}

// Convert a row of Cell[] into run-length encoded <tspan> segments to keep SVG compact
function renderRowTspans(row: Cell[], rowIndex: number, lineHeight: number): string {
  const dy = rowIndex === 0 ? 0 : lineHeight;

  // Group consecutive cells sharing the same effective color class (spaces inherit active class)
  interface Run {
    c: number | undefined;
    text: string;
  }
  const runs: Run[] = [];

  // Find first non-space color in the row so leading spaces don't create an extra tspan
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

// 5. Fetch Live GitHub Stats (includes private contributions from profile calendar & PAT if set)
async function fetchAllTimeContributions(username: string, createdYear: number): Promise<number> {
  const currentYear = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let y = createdYear; y <= currentYear; y++) {
    years.push(y);
  }

  const counts = await Promise.all(
    years.map(async (y) => {
      try {
        const res = await fetch(
          `https://github.com/users/${encodeURIComponent(username)}/contributions?from=${y}-01-01&to=${y}-12-31`
        );
        if (!res.ok) return 0;
        const html = await res.text();
        const match = html.match(/(\d[\d,]*)\s+contributions?/i);
        return match?.[1] ? Number(match[1].replace(/,/g, '')) : 0;
      } catch {
        return 0;
      }
    })
  );

  return counts.reduce((sum, n) => sum + n, 0);
}

async function fetchHtmlFallbackStats(username: string): Promise<GithubStatsData> {
  const [allTimeContribs, html] = await Promise.all([
    fetchAllTimeContributions(username, 2024),
    fetch(`https://github.com/${encodeURIComponent(username)}?tab=repositories`)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
  ]);

  const reposMatch = html.match(/Repositories[\s\S]{0,200}?Counter[^>]*>(\d[\d,]*)/i);
  const repos = reposMatch?.[1] ? Number(reposMatch[1].replace(/,/g, '')) : 0;

  const starMatches = [...html.matchAll(/\/stargazers"[^>]*>[\s\S]{0,200}?(\d[\d,]*)\s*<\/a>/gi)];
  const stars = starMatches.reduce(
    (sum, m) => sum + (m[1] ? Number(m[1].replace(/,/g, '')) : 0),
    0
  );

  const followersMatch = html.match(/(\d[\d,]*)\s*<\/span>\s*followers/i);
  const followers = followersMatch?.[1] ? Number(followersMatch[1].replace(/,/g, '')) : 0;

  return {
    repos,
    stars,
    commits: allTimeContribs,
    followers,
  };
}

export async function fetchGithubStats(username: string): Promise<GithubStatsData | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': `${username}-profile-readme-generator`,
  };
  const token = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    // Try GraphQL first if a token is available to get private + public repos & contributions in one call
    if (token) {
      const gqlQuery = {
        query: `query($login: String!) {
          user(login: $login) {
            createdAt
            followers { totalCount }
            repositories(ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], first: 100) {
              totalCount
              nodes { stargazerCount }
            }
            contributionsCollection {
              totalCommitContributions
              restrictedContributionsCount
            }
          }
        }`,
        variables: { login: username },
      };

      const gqlRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(gqlQuery),
      });

      if (gqlRes.ok) {
        const gqlJson = (await gqlRes.json()) as {
          data?: {
            user?: {
              createdAt?: string;
              followers?: { totalCount?: number };
              repositories?: { totalCount?: number; nodes?: Array<{ stargazerCount?: number }> };
              contributionsCollection?: {
                totalCommitContributions?: number;
                restrictedContributionsCount?: number;
              };
            };
          };
        };

        const u = gqlJson.data?.user;
        if (u) {
          const createdYear = u.createdAt ? new Date(u.createdAt).getUTCFullYear() : 2024;
          const allTimeContribs = await fetchAllTimeContributions(username, createdYear);
          const yearlyContribs =
            (u.contributionsCollection?.totalCommitContributions ?? 0) +
            (u.contributionsCollection?.restrictedContributionsCount ?? 0);
          const stars = (u.repositories?.nodes ?? []).reduce(
            (acc, r) => acc + (r.stargazerCount ?? 0),
            0
          );

          return {
            repos: u.repositories?.totalCount ?? 0,
            stars,
            commits: Math.max(allTimeContribs, yearlyContribs),
            followers: u.followers?.totalCount ?? 0,
          };
        }
      }
    }

    const [userRes, reposRes, commitsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner`, { headers }),
      fetch(`https://api.github.com/search/commits?q=author:${encodeURIComponent(username)}`, { headers }),
    ]);

    if (!userRes.ok || !reposRes.ok) {
      return fetchHtmlFallbackStats(username);
    }

    const userData = (await userRes.json()) as {
      public_repos?: number;
      total_private_repos?: number;
      followers?: number;
      created_at?: string;
    };
    const reposData = (await reposRes.json()) as Array<{ stargazers_count?: number; fork?: boolean }>;

    const createdYear = userData.created_at ? new Date(userData.created_at).getUTCFullYear() : 2024;
    const allTimeContribs = await fetchAllTimeContributions(username, createdYear);

    let searchCommitsTotal = 0;
    if (commitsRes.ok) {
      const commitsData = (await commitsRes.json()) as { total_count?: number };
      searchCommitsTotal = commitsData.total_count ?? 0;
    }

    const stars = Array.isArray(reposData)
      ? reposData.reduce((acc, r) => acc + (r.stargazers_count ?? 0), 0)
      : 0;

    const totalRepos = (userData.public_repos ?? reposData.length) + (userData.total_private_repos ?? 0);

    return {
      repos: totalRepos,
      stars,
      commits: Math.max(allTimeContribs, searchCommitsTotal),
      followers: userData.followers ?? 0,
    };
  } catch (err) {
    console.warn('Could not fetch live GitHub stats, using fallback:', err);
    return fetchHtmlFallbackStats(username);
  }
}

function formatGithubStats(config: GithubStatsValue, stats: GithubStatsData | null): string {
  if (!stats) {
    return `@${config.username}`;
  }

  const metrics = config.metrics ?? ['repos', 'stars', 'commits'];
  const parts: string[] = [];
  const effectiveRepos = Math.max(stats.repos, config.minRepos ?? 0);

  for (const m of metrics) {
    if (m === 'repos' && effectiveRepos > 0) parts.push(`${effectiveRepos} repos`);
    if (m === 'stars' && stats.stars > 0) parts.push(`${stats.stars} ★`);
    if (m === 'commits' && stats.commits > 0) parts.push(`${stats.commits} commits`);
    if (m === 'contributions' && stats.commits > 0) parts.push(`${stats.commits} contributions`);
    if (m === 'followers' && stats.followers > 0) parts.push(`${stats.followers} followers`);
  }

  return parts.length > 0 ? parts.join(' · ') : `@${config.username}`;
}

function formatTimezone(tz: string, now = new Date()): string {
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

function formatInfoValue(
  value: InfoItemValue,
  stats: GithubStatsData | null,
  activeShader: ActiveShaderInfo
): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value.type === 'github') {
    return formatGithubStats(value, stats);
  }
  if (value.type === 'shader') {
    return activeShader.eventName
      ? `${activeShader.preset} (${activeShader.eventName})`
      : activeShader.preset;
  }
  if (value.type === 'timezone') {
    return formatTimezone(value.timeZone);
  }
  return formatUptime(value);
}

// 6. Build SVG
export function buildSvg(
  stats: GithubStatsData | null,
  options?: { overridePreset?: ShaderPreset; forceColorScheme?: 'light' | 'dark' }
): string {
  const { width, rightColX, rows: activeRows, frames, fps } = cfg.layout;
  const { terminal, info, theme } = cfg;
  const duration = Number((frames / fps).toFixed(3));
  const activeShader = resolveActiveShader(new Date(), options?.overridePreset);

  const activeLineHeight = HIRES_LINE_HEIGHT;
  const shaderStartY = 84;
  const shaderClass = 'mono-hires shader-text';

  // Semantic color palette read directly from profile.config.ts
  const lightPaletteVars = activeShader.colorsLight
    .map((col, i) => `--c${i}: ${col};`)
    .join('\n      ');
  const darkPaletteVars = activeShader.colorsDark
    .map((col, i) => `--c${i}: ${col};`)
    .join('\n        ');
  const paletteClassesCss = activeShader.colorsLight
    .map((_, i) => `.c${i} { fill: var(--c${i}); }`)
    .join('\n    ');

  // Info rows (dynamically append Event greeting row if activeShader has a greeting)
  const displayInfo = activeShader.greeting
    ? [...info, { label: 'Event', value: activeShader.greeting }]
    : info;

  // Dynamically calculate window height based on content
  const shaderBottom = shaderStartY + activeRows * activeLineHeight;
  const paletteY = 112 + displayInfo.length * INFO_ROW_HEIGHT + 8;
  const bottomPromptY = Math.max(shaderBottom, paletteY + 14) + 28;
  const height = (terminal.showBottomCursor ? bottomPromptY : Math.max(shaderBottom, paletteY + 14)) + 24;

  // Single reusable keyframe with per-frame animation-delay
  const stepPct = (100 / frames).toFixed(4);
  const frameDelaysCss = Array.from({ length: frames }, (_, i) => {
    const delay = ((i / frames) * duration).toFixed(4);
    return `.f-${i} { animation-delay: ${delay}s; }`;
  }).join('\n      ');

  // Shader layers
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
      if ('type' in item && item.type === 'divider') {
        const lineText = item.title
          ? `── ${item.title} ${'─'.repeat(Math.max(0, terminal.dividerLength - item.title.length - 4))}`
          : '─'.repeat(terminal.dividerLength);
        return `
  <text x="${rightColX}" y="${y}" class="mono muted">${escapeXml(lineText)}</text>`;
      }
      const textValue = formatInfoValue(item.value, stats, activeShader);
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

async function main() {
  const stats = await fetchGithubStats(cfg.githubUsername);
  const svg = buildSvg(stats);

  const outPath = path.resolve(cfg.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf-8');

  const active = resolveActiveShader();
  console.log(
    `SVG generated at ${cfg.output} [shader: ${active.preset}${active.eventName ? ` (${active.eventName})` : ''}]`
  );
  if (stats) {
    console.log(`GitHub stats: ${stats.repos} repos, ${stats.stars} stars, ${stats.commits} commits`);
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main();
}
