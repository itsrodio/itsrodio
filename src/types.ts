export type UptimeUnit = 'y' | 'm' | 'd';

export interface UptimeValue {
  type: 'uptime';
  birthDate: string;
  units?: UptimeUnit[];
  short?: boolean;
}

export type GithubMetric = 'repos' | 'stars' | 'commits' | 'contributions' | 'followers';

export interface GithubStatsValue {
  type: 'github';
  /** Defaults to top-level `PROFILE_CONFIG.githubUsername` if omitted */
  username?: string;
  metrics?: GithubMetric[];
  /** Optional minimum/override value if you want to include private repos without a PAT */
  minRepos?: number;
}

export interface ShaderModeValue {
  type: 'shader';
}

export interface TimezoneValue {
  type: 'timezone';
  timeZone: string;
}

export type InfoItemValue =
  | string
  | UptimeValue
  | GithubStatsValue
  | ShaderModeValue
  | TimezoneValue;

export type InfoRow =
  | {
      label: string;
      value: InfoItemValue;
    }
  | {
      type: 'divider';
      title?: string;
    };

export type ShaderPreset = 'plasma' | 'pumpkin' | 'snow' | 'heart' | 'matrix' | 'fireworks';

export interface ShaderPresetConfig {
  /** Human-readable title shown in the preview gallery */
  title: string;
  /** Short technical badge shown in the preview gallery */
  badge: string;
  /** Semantic color classes (c0..c9) used to render the ASCII shader in Light theme */
  colorsLight: readonly string[];
  /** Semantic color classes (c0..c9) used to render the ASCII shader in Dark theme */
  colorsDark: readonly string[];
  /** 6 color swatches displayed at the bottom of the terminal matching this shader */
  swatches: readonly [string, string, string, string, string, string];
  /** Optional default holiday/event greeting shown in the terminal when this preset is active */
  greeting?: string;
}

export type MonthDay = `${number}-${number}`;

export interface ShaderScheduleRule {
  name: string;
  shader: ShaderPreset;
  /** MM-DD range (inclusive), e.g. '12-20' to '01-10' */
  from: MonthDay;
  to: MonthDay;
  /** Optional custom greeting override for this event (falls back to preset's default greeting) */
  greeting?: string;
}

export interface TerminalConfig {
  windowTitle: string;
  prompt: string;
  command: string;
  userHeader: string;
  dividerLength: number;
  showBottomCursor: boolean;
}

export interface LayoutConfig {
  width: number;
  rightColX: number;
  /** High-res grid dimensions for ASCII shaders (60×26 fills the left column) */
  cols: number;
  rows: number;
  frames: number;
  fps: number;
  asciiRamp: string;
}

export interface ThemePalette {
  bg: string;
  headerBg: string;
  border: string;
  fg: string;
  muted: string;
  accent: string;
  prompt: string;
}

export interface ProfileConfig {
  output: string;
  githubUsername: string;
  terminal: TerminalConfig;
  info: InfoRow[];
  shader: {
    /** Set to 'auto' to pick by date schedule, or force a preset */
    mode: 'auto' | ShaderPreset;
    default: ShaderPreset;
    schedule: ShaderScheduleRule[];
    /** Optional per-preset overrides for colors, swatches, or greetings */
    presets?: Partial<Record<ShaderPreset, Partial<ShaderPresetConfig>>>;
  };
  layout: LayoutConfig;
  theme: {
    light: ThemePalette;
    dark: ThemePalette;
  };
}

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

export interface ActiveShaderInfo {
  preset: ShaderPreset;
  eventName: string | null;
  greeting: string | null;
  swatches: readonly string[];
  colorsLight: readonly string[];
  colorsDark: readonly string[];
}
