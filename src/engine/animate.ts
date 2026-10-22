import type { DefenceMode, Layout, PlayerPos, Point } from '../board/types';
import { BOARD_W, PLAYER_R, PX_PER_M_X, PX_PER_M_Y, clamp, clampPlayer } from '../board/constants';
import { BACKS } from '../data/phaseFormation';
import { PLAY_DURATION, type Keyframe, type PlayVariant } from '../data/plays';

export interface AbsFrame {
  t: number;
  x: number;
  y: number;
}

export interface BuiltPlay {
  /** Absolute keyframes per attacking player id. */
  routes: Record<string, AbsFrame[]>;
  variant: PlayVariant;
  layout: Layout;
  dir: 1 | -1;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function toAbs(start: Point, ruck: Point, dir: 1 | -1, k: number, kf: Keyframe): AbsFrame {
  if ('rx' in kf) {
    return { t: kf.t, x: ruck.x + dir * kf.rx * k * PX_PER_M_X, y: ruck.y - kf.ry * PX_PER_M_Y };
  }
  return { t: kf.t, x: start.x + dir * kf.dx * k * PX_PER_M_X, y: start.y - kf.dy * PX_PER_M_Y };
}

/** Forwards creep forward a few metres over the play so the picture stays alive. */
const FORWARD_DRIFT: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: PLAY_DURATION, dx: 0, dy: 4 },
];

/**
 * @param acrossScale lateral compression of the alignment (phaseFormation.acrossScale); lateral route
 * offsets are compressed by the same factor so runners still finish in the seams of a narrow shape.
 */
export function buildPlay(layout: Layout, variant: PlayVariant, dir: 1 | -1, acrossScale = 1): BuiltPlay {
  const routes: Record<string, AbsFrame[]> = {};
  for (const p of layout.players) {
    if (p.team !== 'attack') continue;
    const kfs = variant.routes[p.number] ?? (BACKS.includes(p.number) ? variant.routes[10] : FORWARD_DRIFT);
    const abs = kfs.map((kf) => toAbs(p, layout.ball, dir, acrossScale, kf));
    routes[p.id] = abs.map((f) => ({ ...f, ...clampPlayer(f) }));
  }
  return { routes, variant, layout, dir };
}

export function positionAt(frames: AbsFrame[], t: number): Point {
  if (t <= frames[0].t) return frames[0];
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t);
      // ease slightly so accelerations read as late changes of pace
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
    }
  }
  return frames[frames.length - 1];
}

export interface BallState {
  pos: Point;
  carrier: number | null;
  inFlight: boolean;
}

export function ballAt(built: BuiltPlay, attackers: Record<string, Point>, t: number): BallState {
  const { passes } = built.variant;
  let carrier = passes[0]?.from ?? 9;
  for (const p of passes) {
    if (t >= p.t0 && t < p.t1) {
      const from = attackers[`attack-${p.from}`];
      const to = attackers[`attack-${p.to}`];
      const u = (t - p.t0) / (p.t1 - p.t0);
      const arc = Math.sin(u * Math.PI) * 10;
      return { pos: { x: lerp(from.x, to.x, u), y: lerp(from.y, to.y, u) - arc }, carrier: null, inFlight: true };
    }
    if (t >= p.t1) carrier = p.to;
  }
  const c = attackers[`attack-${carrier}`] ?? built.layout.ball;
  return { pos: { x: c.x + 4, y: c.y - 4 }, carrier, inFlight: false };
}

export const LINE_SPEED: Record<DefenceMode, number> = { static: 1.0, rush: 2.0, drift: 1.0, hold: 0.6 }; // m/s upfield
/** Fraction of the ball's lateral travel past a defender that he slides out with it (0 = no drift). */
const SLIDE: Record<DefenceMode, number> = { static: 0, rush: 0.1, drift: 0.5, hold: 0.2 };
/**
 * Man marking the way Rugby Slate draws it: a defender copies most of his man's lateral movement,
 * but what he sees is where the man was TRACK_LAG seconds ago. A 10 who drifts for two seconds
 * drags his marker with him; a late cut at pace is barely followed.
 */
const TRACK = 0.7;
export const TRACK_LAG = 0.6;

/**
 * Scripted defence, drawn the way Rugby Slate draws it: every front-line defender marks his
 * opposite man and comes straight up at him, shadowing a fraction of his lateral movement.
 * A straight runner therefore holds his defender; a runner who drifts drags his. In Drift / Hold
 * the line also slides out once the ball has gone past. The front line stops short of any
 * attacker in its channel so it never runs through the carrier; 9 and 15 cover from behind.
 */
export function defenceAt(
  layout: Layout,
  mode: DefenceMode,
  dir: 1 | -1,
  t: number,
  ball: Point,
  attackers: Array<Point & { number?: number }> = [],
  /** The attackers TRACK_LAG seconds ago (what the defenders are reacting to); defaults to now. */
  lagged: Array<Point & { number?: number }> = attackers,
): PlayerPos[] {
  const ruck = layout.ball;
  const out: PlayerPos[] = [];
  const startOf = (n: number) => layout.players.find((p) => p.team === 'attack' && p.number === n);
  const seenOf = (n: number) => lagged.find((a) => a.number === n);
  // Nearest attacker in a defender's channel: defenders advance until they meet him, not through him.
  const channelCap = (x: number, y: number) => {
    // Never beyond the ruck line + 2 m either: the line advances, it does not chase the ball wide.
    let cap = Math.min(ball.y - 1.5 * PX_PER_M_Y, ruck.y + 2 * PX_PER_M_Y);
    for (const a of attackers) {
      if (Math.abs(a.x - x) < 2.2 * PX_PER_M_X && a.y > y) cap = Math.min(cap, a.y - 1.8 * PX_PER_M_Y);
    }
    return cap;
  };
  for (const d of layout.players) {
    if (d.team !== 'defence') continue;
    const isBackfield = d.number === 15 || d.number === 9 || ruck.y - d.y > 14 * PX_PER_M_Y;
    let x = d.x;
    let y = d.y;
    if (!isBackfield) {
      const guard = Math.abs(d.x - ruck.x) < 3 * PX_PER_M_X;
      // Man marking: backs shadow their opposite number, forwards hold their channel.
      const mark = BACKS.includes(d.number) ? seenOf(d.number) : undefined;
      const mark0 = mark ? startOf(d.number) : undefined;
      if (mark && mark0) x += (mark.x - mark0.x) * TRACK;
      // Slide out once the ball is past him (a real drift), never before.
      const past = (ball.x - d.x) * dir - 2 * PX_PER_M_X;
      if (!guard && past > 0) x += dir * SLIDE[mode] * past;
      const advance = Math.min(LINE_SPEED[mode] * t, 9) * PX_PER_M_Y;
      y = Math.min(d.y + advance, channelCap(x, d.y));
    } else if (d.number === 9) {
      // Sweeper: tracks the ball from behind the line and stays there.
      x = lerp(d.x, ball.x, Math.min(1, t / 6));
      y = d.y + Math.min(t * 0.3, 1) * PX_PER_M_Y;
    } else {
      x = lerp(d.x, (d.x + ball.x) / 2, Math.min(1, t / 5));
      y = d.y + Math.min(t * 0.4, 2) * PX_PER_M_Y;
    }
    out.push({ ...d, x: clamp(x, PLAYER_R, BOARD_W - PLAYER_R), y });
  }
  return out;
}

export interface Seam {
  /** Defender ids that bound the seam (one id when the target is "where he started"). */
  ids: string[];
  /** Where the strike runner should finish: the gap at the defenders' starting positions. */
  point: Point;
  label: string;
}

/**
 * The seam a variant attacks, taken from the defenders' STARTING positions: a crash ball finishes
 * between their 10 and 12; a switch finishes where their 10 stood before he was dragged across.
 */
export function seamFor(built: BuiltPlay): Seam | null {
  const nums = built.variant.seam;
  if (!nums || nums.length === 0) return null;
  const starts = nums
    .map((n) => built.layout.players.find((p) => p.team === 'defence' && p.number === n))
    .filter((p): p is PlayerPos => Boolean(p));
  if (starts.length === 0) return null;
  const point = {
    x: starts.reduce((s, p) => s + p.x, 0) / starts.length,
    y: starts.reduce((s, p) => s + p.y, 0) / starts.length,
  };
  const label = starts.length === 1 ? `where their ${starts[0].number} started` : `between their ${nums.join(' and ')}`;
  return { ids: starts.map((p) => p.id), point, label };
}
