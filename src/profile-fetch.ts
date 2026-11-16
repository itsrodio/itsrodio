import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGithubStats, formatGithubStats } from './github-stats.js';
import { PROFILE_CONFIG as cfg } from './profile.config.js';
import {
  SHADER_PRESETS,
  generateShaderFrame,
  getShaderPresetConfig,
  resolveActiveShader,
} from './shaders.js';
import { buildSvg, formatTimezone, formatUptime } from './svg-renderer.js';

export type * from './types.js';
export {
  SHADER_PRESETS,
  buildSvg,
  fetchGithubStats,
  formatGithubStats,
  formatTimezone,
  formatUptime,
  generateShaderFrame,
  getShaderPresetConfig,
  resolveActiveShader,
};

async function main() {
  const now = new Date();
  const stats = await fetchGithubStats(cfg.githubUsername);
  const svg = buildSvg(stats, { now });

  const outPath = path.resolve(cfg.output);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf-8');

  const active = resolveActiveShader(now);
  console.log(
    `SVG generated at ${cfg.output} [shader: ${active.preset}${active.eventName ? ` (${active.eventName})` : ''}]`
  );
  if (stats) {
    console.log(
      `GitHub stats: ${stats.repos} repos, ${stats.stars} stars, ${stats.commits} commits`
    );
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main();
}
