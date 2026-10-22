import type { BoardView, PlayerTuple, PlayerPos, Point, Team } from './types';

/** Board size copied from rugbytacticsboard.com (viewBox 0 0 1100 700). */
export const BOARD_W = 1100;
export const BOARD_H = 700;
/** Player token radius and the clamp margin the site applies to player positions. */
export const PLAYER_R = 12;
export const BALL_R = 6;

export const TEAM_STYLE: Record<Team, { label: string; fill: string; stroke: string; text: string }> = {
  attack: { label: 'Steamrollers', fill: '#22c55e', stroke: '#f0fdf4', text: '#04210f' },
  defence: { label: 'Opposition', fill: '#f1f5f9', stroke: '#0c1d3f', text: '#0c1d3f' },
};

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

export const clampPlayer = (p: Point): Point => ({
  x: clamp(p.x, PLAYER_R, BOARD_W - PLAYER_R),
  y: clamp(p.y, PLAYER_R, BOARD_H - PLAYER_R),
});

export const clampBall = (p: Point): Point => ({
  x: clamp(p.x, BALL_R, BOARD_W - BALL_R),
  y: clamp(p.y, BALL_R, BOARD_H - BALL_R),
});

export const tuplesToPlayers = (tuples: PlayerTuple[]): PlayerPos[] =>
  tuples.map(([team, number, x, y]) => ({ id: `${team}-${number}`, team, number, x, y }));

export const mirrorX = (x: number) => BOARD_W - x;

/**
 * Pitch line geometry, copied line-for-line from the site's SVG pitch components so the
 * presets sit on exactly the same markings. Vertical lines are shared by the three field views.
 * `metresFromHalfway` is a piecewise mapping used for readouts: positive = toward the attack's
 * own try line (down the board), negative = toward the opposition try line (up the board).
 */
export interface PitchLines {
  /** Solid full-width lines: try lines, 22s, halfway. */
  solid: number[];
  /** Dashed full-width lines: 5m and 10m lines. */
  dashed: number[];
  /** Vertical markers (touch, 5m, 15m, centre). Site draws them as segments; we draw them lightly. */
  vertical: number[];
  /** Pairs of [y, metres from halfway] for readouts. */
  yMetres: Array<[number, number]>;
  labels: Array<{ y: number; text: string }>;
}

const VERTICAL = [10, 100, 280, 550, 820, 1000, 1090];

export const PITCH: Record<Exclude<BoardView, 'lineout'>, PitchLines> = {
  pitchIn: {
    solid: [70, 310, 580],
    dashed: [130, 480, 690],
    vertical: VERTICAL,
    yMetres: [
      [70, -50],
      [130, -45],
      [310, -28],
      [480, -10],
      [580, 0],
      [690, 10],
    ],
    labels: [
      { y: 70, text: 'TRY LINE' },
      { y: 130, text: '5m' },
      { y: 310, text: '22m' },
      { y: 480, text: '10m' },
      { y: 580, text: 'HALFWAY' },
      { y: 690, text: '10m' },
    ],
  },
  pitchMiddle: {
    solid: [30, 350, 670],
    dashed: [235, 465],
    vertical: VERTICAL,
    yMetres: [
      [30, -28],
      [235, -10],
      [350, 0],
      [465, 10],
      [670, 28],
    ],
    labels: [
      { y: 30, text: '22m' },
      { y: 235, text: '10m' },
      { y: 350, text: 'HALFWAY' },
      { y: 465, text: '10m' },
      { y: 670, text: '22m' },
    ],
  },
  pitchOut: {
    solid: [110, 390, 620],
    dashed: [10, 215, 565],
    vertical: VERTICAL,
    yMetres: [
      [10, -10],
      [110, 0],
      [215, 10],
      [390, 28],
      [565, 45],
      [620, 50],
    ],
    labels: [
      { y: 10, text: '10m' },
      { y: 110, text: 'HALFWAY' },
      { y: 215, text: '10m' },
      { y: 390, text: '22m' },
      { y: 565, text: '5m' },
      { y: 620, text: 'TRY LINE' },
    ],
  },
};

/** Horizontal scale: 70 m of pitch width across the 1080 px between the touchlines. */
export const PX_PER_M_X = 1080 / 70;
/** Vertical scale between the 10m line and halfway on the site's board (115 px for 10 m). */
export const PX_PER_M_Y = 11.5;

export const metresFromLeftTouch = (x: number) => (x - 10) / PX_PER_M_X;

export function metresFromHalfway(view: BoardView, y: number): number | null {
  if (view === 'lineout') return null;
  const pts = PITCH[view].yMetres;
  if (y <= pts[0][0]) return pts[0][1] + (y - pts[0][0]) / PX_PER_M_Y;
  for (let i = 0; i < pts.length - 1; i++) {
    const [y0, m0] = pts[i];
    const [y1, m1] = pts[i + 1];
    if (y >= y0 && y <= y1) return m0 + ((y - y0) / (y1 - y0)) * (m1 - m0);
  }
  const last = pts[pts.length - 1];
  return last[1] + (y - last[0]) / PX_PER_M_Y;
}

/** Straight-line distance between two board points, in approximate metres. */
export const distanceMetres = (a: Point, b: Point) =>
  Math.hypot((a.x - b.x) / PX_PER_M_X, (a.y - b.y) / PX_PER_M_Y);

export const fmtM = (m: number) => `${Math.round(m * 2) / 2}m`;
