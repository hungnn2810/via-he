// The one place the look is defined. sprites.js draws from these numbers and
// client/Assets/Scripts/Theme.cs repeats them for the layout code — change both together.
//
// Values are read off the original Zing Me client; see docs/client/art-direction.md.
// Only the visual language is taken from there: palette, outline weight, panel anatomy and
// proportion. Every sprite is drawn from scratch in sprites.js.

export const INK = '#2b1d12'; // the outline on everything

export const COLOR = {
  // display text
  gold: '#ffcc3d',
  goldDeep: '#e0a01c',
  textDark: '#3a2a18',
  textMuted: '#8c7a63',
  textOnDark: '#fff6e2',
  // semantic figures inside body copy
  figureGain: '#2f7fd6',
  figureCost: '#d33b3b',
  // boards
  cream: '#fdf3dc',
  creamLine: '#e8d4a8',
  creamShade: '#f0e0bd',
  // dock, header bar and HUD chips: the original's dark navy with a lighter top edge
  navy: '#1d2c4a',
  navyDeep: '#111c31',
  navyEdge: '#5d7fb5',
  // plaques: the silver of the original's street tabs
  silverLight: '#eef2f5',
  silver: '#c3ccd3',
  silverDark: '#8d99a4',
  // white boards: tooltips, popups
  white: '#ffffff',
  whiteShade: '#f4f4ef',
};

// A window skin is a frame colour ramp plus the board it holds.
// Amber carries lists and logs, blue carries forms and feature windows.
export const SKIN = {
  amber: {
    frameLight: '#f0a132',
    frame: '#e8891f',
    frameDark: '#b9540f',
    keyline: '#ffd98a',
    board: COLOR.cream,
    boardLine: COLOR.creamLine,
    title: COLOR.gold,
  },
  blue: {
    frameLight: '#3fa0e0',
    frame: '#2e90d6',
    frameDark: '#145b96',
    keyline: '#bfe4ff',
    board: '#e8f4fd',
    boardLine: '#b9dcf5',
    title: COLOR.gold,
  },
};

// Buttons are drawn as art in three states rather than tinted at runtime.
export const BUTTON = {
  green: { top: '#6ddc86', mid: '#2fa84f', low: '#1b7a37', rim: '#f2fff5' },
  blue: { top: '#74b9f5', mid: '#2e86de', low: '#1b5b9e', rim: '#eef7ff' },
  red: { top: '#f58a8a', mid: '#d94040', low: '#9e2626', rim: '#fff0f0' },
  gold: { top: '#ffd978', mid: '#f0a91e', low: '#b2710a', rim: '#fff8e2' },
  gray: { top: '#d9d9d9', mid: '#a8a8a8', low: '#777777', rim: '#f2f2f2' },
};

// Notification badges: the red count dot of the original, plus two quieter tones.
export const BADGE = {
  red: { top: '#ff8a7a', mid: '#e23b3b', low: '#a31f1f' },
  green: { top: '#8ee36a', mid: '#3aa83a', low: '#1f7a2a' },
  blue: { top: '#8fcdff', mid: '#2e86de', low: '#1b5b9e' },
};

// Toast plates, one per tone. Text colour on each is chosen in Theme.cs.
export const TOAST = {
  info: { top: '#fffaf0', low: '#f0e0bd', rim: '#ffffff' },
  success: { top: '#8ee36a', low: '#2f8a29', rim: '#e9ffe0' },
  warning: { top: '#ffd978', low: '#e8a21e', rim: '#fff4cf' },
  error: { top: '#ff8a8a', low: '#c92f2f', rim: '#ffe3e3' },
};

// Progress fills, one per tone.
export const PROGRESS = {
  green: ['#8ee36a', '#49b63a', '#2f8a29'],
  blue: ['#8fcdff', '#3f9be8', '#1f62b0'],
  gold: ['#ffe38a', '#f4ad22', '#c97d0a'],
  red: ['#ff9a8a', '#e04a3a', '#a62a1e'],
};

export const RADIUS = { sm: 6, md: 12, lg: 18, pill: 999 };

// 9-slice borders as [left, bottom, right, top], in sprite pixels.
export const BORDER = {
  panel: [30, 30, 30, 38],
  board: [18, 18, 18, 18],
  row: [16, 16, 16, 16],
  button: [16, 18, 16, 16],
  slot: [14, 14, 14, 14],
  track: [12, 12, 12, 12],
  chip: [26, 26, 26, 26],
  bar: [24, 20, 24, 20],
  tab: [18, 18, 18, 18],
  badge: [16, 16, 16, 16],
  tooltip: [20, 20, 20, 20],
  toast: [24, 24, 24, 24],
  thumb: [8, 8, 8, 8],
  divider: [3, 2, 3, 2],
};

// Sprite frame sizes. Big enough that the border above never overlaps itself.
export const SIZE = {
  panel: [180, 180],
  board: [120, 120],
  row: [160, 72],
  button: [132, 60],
  close: [64, 64],
  slot: [96, 96],
  track: [120, 28],
  chip: [128, 56],
  bar: [128, 64],
  tab: [112, 56],
  badge: [48, 32],
  tooltip: [120, 72],
  tooltipTail: [36, 22],
  toast: [160, 56],
  thumb: [16, 64],
  divider: [64, 6],
  icon: [96, 96],
};

// Layout units, in the 1280x720 reference space the canvas scales to.
export const SPACE = [4, 8, 12, 16, 24, 32];
export const TYPE = { xs: 14, sm: 17, md: 20, lg: 24, xl: 30 };

export const STROKE = { thin: 2, base: 3, thick: 4.5 };
export const SHADOW = { dy: 4, blur: 8, color: 'rgba(43,29,18,0.38)' };
