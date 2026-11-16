import { PROFILE_CONFIG as cfg } from './profile.config.js';
import type {
  ActiveShaderInfo,
  Cell,
  ShaderPreset,
  ShaderPresetConfig,
  ShaderScheduleRule,
} from './types.js';

// Single source of truth for all shader colors (c0..c9), bottom swatches, preview metadata, and default greetings
export const SHADER_PRESETS: Record<ShaderPreset, ShaderPresetConfig> = {
  plasma: {
    title: 'Plasma (Default)',
    badge: '60×26 Hi-Res · Contour Wave',
    // c0: deep navy trough, c1: primary blue, c2: royal indigo, c3: amethyst violet, c4: bright periwinkle crest, c5: glowing lavender core
    colorsLight: ['#172554', '#1d4ed8', '#3730a3', '#5b21b6', '#7c3aed', '#2563eb'],
    colorsDark: ['#1d3b78', '#2D68C4', '#4B61D1', '#6E56CF', '#9381ff', '#c4b5fd'],
    swatches: ['#1d3b78', '#2D68C4', '#4B61D1', '#6E56CF', '#9381ff', '#c4b5fd'],
  },
  pumpkin: {
    title: 'Pumpkin (Halloween)',
    badge: '60×26 Hi-Res · Candlelight',
    // c0: stem, c1: dark contour/grooves, c2: mid orange, c3: bright orange, c4: inner rim/amber, c5: flame gold, c6: flame hot core
    colorsLight: ['#14532d', '#7c2d12', '#c2410c', '#ea580c', '#b45309', '#d97706', '#ca8a04'],
    colorsDark: ['#4ade80', '#9a3412', '#ea580c', '#f97316', '#f59e0b', '#facc15', '#fef9c3'],
    swatches: ['#9a3412', '#ea580c', '#f97316', '#f59e0b', '#facc15', '#4ade80'],
    greeting: 'Happy Halloween! Trick or treat 🎃',
  },
  snow: {
    title: 'Snow & Tree (New Year)',
    badge: '60×26 Hi-Res · Multi-Color',
    // c0: snow white, c1: ice blue, c2: pine dark, c3: pine mid, c4: pine light, c5: gold star/garland, c6: red orn, c7: cyan orn, c8: pink orn, c9: trunk
    colorsLight: ['#0369a1', '#0284c7', '#052e16', '#14532d', '#15803d', '#b45309', '#b91c1c', '#0e7490', '#a21caf', '#451a03'],
    colorsDark: ['#f0f6fc', '#79c0ff', '#166534', '#2ea043', '#56d364', '#facc15', '#ff5f56', '#39c5cf', '#f472b6', '#b45309'],
    swatches: ['#f0f6fc', '#79c0ff', '#2ea043', '#facc15', '#ff5f56', '#39c5cf'],
    greeting: 'Happy Holidays & New Year! 🎄✨',
  },
  heart: {
    title: "Heart (Valentine's)",
    badge: '60×26 Hi-Res · 3D Specular',
    // c0: deep contour, c1: dark crimson, c2: vibrant ruby, c3: rose highlight, c4: specular shine, c5: pulse wave
    colorsLight: ['#4c0519', '#9f1239', '#be123c', '#e11d48', '#fda4af', '#db2777'],
    colorsDark: ['#9f1239', '#e11d48', '#ff2a6d', '#ff6b9d', '#fff1f2', '#f472b6'],
    swatches: ['#9f1239', '#e11d48', '#ff2a6d', '#ff6b9d', '#f472b6', '#fff1f2'],
    greeting: "Happy Valentine's Day! Spread the love ❤️",
  },
  matrix: {
    title: 'Matrix (Programmer Day)',
    badge: '60×26 Hi-Res · Phosphor Rain',
    // c0: white-mint head, c1: neon green, c2: matrix green, c3: dark emerald tail
    colorsLight: ['#052e16', '#14532d', '#15803d', '#16a34a'],
    colorsDark: ['#e6ffed', '#39ff14', '#2ea043', '#196c2e'],
    swatches: ['#0d3b18', '#196c2e', '#2ea043', '#00b82e', '#39ff14', '#e6ffed'],
    greeting: "Happy Programmer's Day! Wake up, Neo... 🐇",
  },
  fireworks: {
    title: 'Fireworks (Birthday)',
    badge: '60×26 Hi-Res · Multi-Burst',
    // c0: white-gold core, c1: gold, c2: coral-orange, c3: cyan, c4: electric blue, c5: hot pink, c6: neon violet
    colorsLight: ['#92400e', '#b45309', '#b91c1c', '#0e7490', '#1d4ed8', '#be185d', '#6d28d9'],
    colorsDark: ['#fef9c3', '#ffbd2e', '#ff7b72', '#39c5cf', '#58a6ff', '#ff5599', '#bc8cff'],
    swatches: ['#fef9c3', '#ffbd2e', '#ff7b72', '#39c5cf', '#ff5599', '#bc8cff'],
    greeting: "It's my Birthday! Another year of uptime 🎉",
  },
};

export function getShaderPresetConfig(preset: ShaderPreset): ShaderPresetConfig {
  const base = SHADER_PRESETS[preset];
  const override = cfg.shader.presets?.[preset];
  if (!override) return base;
  return { ...base, ...override };
}

function parseMonthDay(mmdd: string): number {
  const [m, d] = mmdd.split('-').map(Number);
  return (m ?? 1) * 100 + (d ?? 1);
}

function buildShaderInfo(preset: ShaderPreset, matchedRule?: ShaderScheduleRule): ActiveShaderInfo {
  const presetCfg = getShaderPresetConfig(preset);
  return {
    preset,
    eventName: matchedRule?.name ?? null,
    greeting: matchedRule?.greeting ?? presetCfg.greeting ?? null,
    swatches: presetCfg.swatches,
    colorsLight: presetCfg.colorsLight,
    colorsDark: presetCfg.colorsDark,
  };
}

// Date-based shader resolution (supports cross-year ranges like 12-20 to 01-10)
export function resolveActiveShader(
  now = new Date(),
  overridePreset?: ShaderPreset
): ActiveShaderInfo {
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

function sampleAscii(value01: number): string {
  const { asciiRamp } = cfg.layout;
  const clamped = Math.max(0, Math.min(0.9999, value01));
  const idx = Math.floor(clamped * asciiRamp.length);
  return asciiRamp[idx] ?? ' ';
}

// 1. Plasma (High-Res 60x26 grid with dynamic 6-stop contour & energy core coloring)
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

// 2. Halloween Jack-o'-lantern Pumpkin (High-Res 60x26, stationary with realistic flickering candlelight)
function generatePumpkinFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const t = (frameIndex / frames) * Math.PI * 2;

  const flameSway = 0.09 * Math.sin(t) + 0.04 * Math.cos(t * 2);
  const candlePower = 0.86 + 0.14 * (0.6 * Math.sin(t * 2) + 0.4 * Math.cos(t * 3));

  const grid: Cell[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) {
      const nx = (x / (cols - 1) - 0.5) * 2.3;
      const ny = (y / (rows - 1) - 0.54) * 2.1;

      // Curved green pumpkin stem at top
      const stemCurve = 0.09 * Math.pow((ny + 0.65) * 2.2, 2) - 0.03;
      const stemHalfW = 0.085 + 0.05 * (ny + 1.0);
      if (ny >= -1.02 && ny <= -0.63 && Math.abs(nx - stemCurve) <= stemHalfW) {
        const isStemEdge = Math.abs(nx - stemCurve) > stemHalfW * 0.55;
        row.push({ ch: isStemEdge ? '|' : '#', c: 0 });
        continue;
      }

      // Scalloped pumpkin body with 5 distinct vertical ribs
      const ribFreq = 7.2;
      const ribCos = Math.cos(nx * ribFreq);
      const scallop = 0.038 * ribCos;
      const rx = 0.94;
      const ry = 0.75 + scallop;
      const dy = ny - 0.07;
      const bodyDist = (nx * nx) / (rx * rx) + (dy * dy) / (ry * ry);

      if (bodyDist <= 1.0) {
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

        const noseDist = Math.max(
          -(ny - -0.01),
          ny - 0.21,
          Math.abs(nx) * 1.45 - (ny - -0.02)
        );

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
          const isEyeRim =
            (leftEyeDist > -0.055 && leftEyeDist < 0) ||
            (rightEyeDist > -0.055 && rightEyeDist < 0);
          const isNoseRim = noseDist > -0.05 && noseDist < 0;
          const isMouthRim = inMouthOpening && Math.abs(ny - smileCenterY) > mouthHalfH - 0.04;

          if (isEyeRim || isNoseRim || isMouthRim) {
            row.push({ ch: ':', c: 4 });
          } else {
            const localSway = flameSway * (1 - ny * 0.6);
            const flameWave =
              Math.sin((nx - localSway) * 10 + ny * 6 - t * 2) * 0.22 +
              Math.cos((nx + localSway) * 7 - t) * 0.15;
            const radialHeat = (1 - Math.abs(nx - localSway) * 0.55 + flameWave) * candlePower;

            if (radialHeat > 0.76) {
              row.push({ ch: '@', c: 6 });
            } else if (radialHeat > 0.58) {
              row.push({ ch: '#', c: 5 });
            } else if (radialHeat > 0.42) {
              row.push({ ch: '*', c: 5 });
            } else {
              row.push({ ch: '+', c: 4 });
            }
          }
        } else {
          const isOuterContour = bodyDist > 0.85;
          const isRibGroove = ribCos < -0.68 && bodyDist < 0.88;

          if (isOuterContour) {
            const edgeChar = Math.abs(nx) > 0.75 ? (nx < 0 ? '(' : ')') : '#';
            row.push({ ch: edgeChar, c: 1 });
          } else if (isRibGroove) {
            row.push({ ch: '|', c: 1 });
          } else {
            const sphereZ = Math.sqrt(Math.max(0, 1 - bodyDist));
            const ribRoundness = (ribCos + 1) * 0.5;
            const candleWarmth = Math.max(
              0,
              (0.6 - Math.sqrt(nx * nx + dy * dy)) * 0.35 * candlePower
            );
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

// 3. New Year Decorated Tree under Natural Snowfall (High-Res 60x26)
function generateSnowFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const t = (frameIndex / frames) * Math.PI * 2;
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ch: ' ' }))
  );
  const cx = Math.floor(cols / 2);

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
          grid[y]![x] = { ch: '*', c: 0 };
        } else if (isEdge) {
          grid[y]![x] = { ch: dx < 0 ? '/' : '\\', c: dx < 0 ? 4 : 2 };
        } else {
          const garlandWave = Math.sin(dx * 0.42 + y * 0.78);
          if (Math.abs(garlandWave) < 0.19) {
            grid[y]![x] = { ch: '~', c: 5 };
          } else {
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

  const starPulse = Math.sin(t * 2) > 0;
  grid[0]![cx] = { ch: starPulse ? '|' : '·', c: 5 };
  grid[1]![cx - 2] = { ch: starPulse ? '·' : ' ', c: 5 };
  grid[1]![cx - 1] = { ch: '—', c: 5 };
  grid[1]![cx] = { ch: '@', c: 5 };
  grid[1]![cx + 1] = { ch: '—', c: 5 };
  grid[1]![cx + 2] = { ch: starPulse ? '·' : ' ', c: 5 };
  grid[2]![cx] = { ch: '^', c: 5 };

  for (let y = rows - 3; y <= rows - 2; y++) {
    for (let dx = -2; dx <= 2; dx++) {
      grid[y]![cx + dx] = { ch: Math.abs(dx) === 2 ? '|' : '#', c: 9 };
    }
  }

  for (let x = 0; x < cols; x++) {
    const hill = Math.sin(x * 0.18) + Math.cos(x * 0.11);
    grid[rows - 1]![x] = { ch: '#', c: 0 };
    if (hill > -0.2 && Math.abs(x - cx) > 3) {
      grid[rows - 2]![x] = { ch: '=', c: 1 };
    }
  }

  const numFlakes = 38;
  for (let i = 0; i < numFlakes; i++) {
    const phase = ((i * 29) % numFlakes) / numFlakes;
    const progress = (frameIndex / frames + phase) % 1;

    const yPos = Math.floor(progress * (rows - 1));
    const startX = (i * 41 + 9) % cols;
    const breeze = (i % 3 === 0 ? 9 : i % 3 === 1 ? 14 : 6) * progress;
    const flutter = Math.sin(progress * Math.PI * 2 + i * 1.7) * 1.8;
    const xPos = Math.floor((startX + breeze + flutter + cols * 2) % cols);

    if (yPos >= 0 && yPos < rows - 1 && xPos >= 0 && xPos < cols) {
      const currentCell = grid[yPos]![xPos]!;
      if (currentCell.ch === ' ') {
        const isForegroundFlake = i % 3 === 0;
        const ch = isForegroundFlake ? '*' : i % 2 === 0 ? '+' : '·';
        grid[yPos]![xPos] = { ch, c: isForegroundFlake ? 0 : 1 };
      }
    }
  }

  return grid;
}

// 4. High-Res 3D Beating Heart with Full Top Padding & Specular Highlight (High-Res 60x26)
function generateHeartFrame(frameIndex: number): Cell[][] {
  const { cols, rows, frames } = cfg.layout;
  const t = (frameIndex / frames) * Math.PI * 2;

  const beat =
    1 +
    0.095 * Math.pow(Math.max(0, Math.sin(t)), 4) +
    0.055 * Math.pow(Math.max(0, Math.sin(t + 0.65)), 6);

  const grid: Cell[][] = [];

  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) {
      const rawX = (x / (cols - 1) - 0.5) * 3.0;
      const rawY = 1.50 - (y / (rows - 1)) * 2.72;

      const nx = rawX / beat;
      const ny = rawY / beat;

      const a = nx * nx + ny * ny - 1;
      const f = a * a * a - nx * nx * ny * ny * ny * 1.18;

      if (f <= 0) {
        const z = Math.min(1, Math.pow(Math.abs(f), 0.30) * 1.3);
        const specDist = Math.sqrt((nx + 0.42) * (nx + 0.42) + (ny - 0.48) * (ny - 0.48));
        const specular = Math.max(0, 1 - specDist * 1.65);
        const lum = Math.min(0.99, 0.22 + z * 0.55 + specular * 0.48);

        if (specular > 0.52) {
          row.push({ ch: '@', c: 4 });
        } else if (z < 0.34) {
          row.push({ ch: '#', c: 0 });
        } else if (lum > 0.76) {
          row.push({ ch: '@', c: 3 });
        } else if (lum > 0.54) {
          row.push({ ch: '#', c: 2 });
        } else {
          row.push({ ch: '*', c: 1 });
        }
      } else {
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

// 5. Authentic High-Res Matrix Digital Rain with 4-Stop Phosphor Coloring (High-Res 60x26)
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

// 6. High-Res Multi-Color Fireworks with Rising Rockets & Gravity (High-Res 60x26)
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
