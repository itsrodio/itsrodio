import type { ProfileConfig } from './types.js';

export type * from './types.js';

export const PROFILE_CONFIG: ProfileConfig = {
  output: 'dist/profile.svg',
  githubUsername: 'itsrodio',

  // Terminal text & window appearance
  terminal: {
    windowTitle: 'rodio — tsx — 80×24',
    prompt: 'rodio@MacBook-Pro ~ %',
    command: 'pnpm tsx src/profile-fetch.ts',
    userHeader: 'rodio@MacBook-Pro',
    dividerLength: 42,
    showBottomCursor: true,
  },

  // Info rows on the right (add or remove as many as you want — window height recalculates automatically)
  info: [
    // Tech & Environment
    { label: 'Stack', value: 'TypeScript, React, Next.js, Node' },
    { label: 'OS', value: 'OS Agnostic' },
    { label: 'Package Manager', value: 'pnpm' },
    { label: 'Shell', value: 'tsx (esbuild)' },
    { label: 'Editor', value: 'VS Code' },
    {
      label: 'GitHub',
      value: {
        type: 'github',
        metrics: ['repos', 'stars', 'commits'],
      },
    },

    // Section Divider
    { type: 'divider', title: 'About me' },

    // Personal Info
    { label: 'Role', value: 'Creative Web Dev' },
    { label: 'Uptime', value: { type: 'uptime', birthDate: '2006-09-02', units: ['y', 'm', 'd'] } },
    { label: 'Location', value: 'Spain' },
    { label: 'Timezone', value: { type: 'timezone', timeZone: 'Europe/Madrid' } },
    { label: 'Locale', value: 'RU, EN, ES, CAT' },
    { label: 'Status', value: 'Building cool stuff on the web' },
  ],

  // Seasonal / holiday shader schedule (colors & presets live in src/shaders.ts)
  shader: {
    /** Set to 'auto' to pick by date schedule, or force: 'plasma' | 'pumpkin' | 'snow' | 'heart' | 'matrix' | 'fireworks' */
    mode: 'auto',
    default: 'plasma',

    schedule: [
      {
        name: 'New Year & Winter Holidays',
        shader: 'snow',
        from: '12-20',
        to: '01-10',
      },
      {
        name: "Valentine's Day",
        shader: 'heart',
        from: '02-13',
        to: '02-15',
      },
      {
        name: 'Birthday',
        shader: 'fireworks',
        from: '09-01',
        to: '09-03',
      },
      {
        name: 'Programmer Day & Matrix Day',
        shader: 'matrix',
        from: '09-12',
        to: '09-14',
      },
      {
        name: 'Halloween',
        shader: 'pumpkin',
        from: '10-29',
        to: '11-01',
      },
    ],
  },

  // Shader grid and layout settings
  layout: {
    width: 840,
    rightColX: 430,
    cols: 60,
    rows: 26,
    frames: 24,
    fps: 12,
    asciiRamp: ' .:-=+*#%@',
  },

  // Terminal window color themes (light / dark for GitHub)
  theme: {
    light: {
      bg: '#ffffff',
      headerBg: '#f6f8fa',
      border: '#d0d7de',
      fg: '#24292f',
      muted: '#57606a',
      accent: '#2D68C4',
      prompt: '#1a7f37',
    },
    dark: {
      bg: '#0d1117',
      headerBg: '#161b22',
      border: '#30363d',
      fg: '#c9d1d9',
      muted: '#8b949e',
      accent: '#2D68C4',
      prompt: '#3fb950',
    },
  },
};
