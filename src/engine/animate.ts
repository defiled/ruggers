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

function toAbs(start: Point, ruck: Point, dir: 1 | -1, kf: Keyframe): AbsFrame {
  if ('rx' in kf) {
    return { t: kf.t, x: ruck.x + dir * kf.rx * PX_PER_M_X, y: ruck.y - kf.ry * PX_PER_M_Y };
  }
  return { t: kf.t, x: start.x + dir * kf.dx * PX_PER_M_X, y: start.y - kf.dy * PX_PER_M_Y };
}

/** Forwards creep forward a few metres over the play so the picture stays alive. */
const FORWARD_DRIFT: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: PLAY_DURATION, dx: 0, dy: 4 },
];

export function buildPlay(layout: Layout, variant: PlayVariant, dir: 1 | -1): BuiltPlay {
  const routes: Record<string, AbsFrame[]> = {};
  for (const p of layout.players) {
    if (p.team !== 'attack') continue;
    const kfs = variant.routes[p.number] ?? (BACKS.includes(p.number) ? variant.routes[10] : FORWARD_DRIFT);
    const abs = kfs.map((k) => toAbs(p, layout.ball, dir, k));
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

export const LINE_SPEED: Record<DefenceMode, number> = { rush: 2.0, drift: 1.2, hold: 0.6 }; // m/s upfield
const DRIFT_SPEED: Record<DefenceMode, number> = { rush: 0.5, drift: 1.6, hold: 0.3 }; // m/s lateral

/**
 * Scripted defence: the front line advances at a mode-dependent line speed and slides
 * toward the open side; the backfield tracks the ball. Defenders stop a metre short of
 * the ball line so they never run through the carrier.
 */
export function defenceAt(
  layout: Layout,
  mode: DefenceMode,
  dir: 1 | -1,
  t: number,
  ball: Point,
  attackers: Point[] = [],
): PlayerPos[] {
  const ruck = layout.ball;
  const out: PlayerPos[] = [];
  // Nearest attacker in a defender's channel: defenders advance until they meet him, not through him.
  const channelCap = (x: number, y: number) => {
    // Never beyond the ruck line + 2 m either: the line advances, it does not chase the ball wide.
    let cap = Math.min(ball.y - 1.5 * PX_PER_M_Y, ruck.y + 2 * PX_PER_M_Y);
    for (const a of attackers) {
      if (Math.abs(a.x - x) < 2.2 * PX_PER_M_X && a.y > y) cap = Math.min(cap, a.y - 1.6 * PX_PER_M_Y);
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
      const advance = Math.min(LINE_SPEED[mode] * t, 9) * PX_PER_M_Y;
      if (!guard) x = d.x + dir * DRIFT_SPEED[mode] * t * PX_PER_M_X;
      y = Math.min(d.y + advance, channelCap(x, d.y));
    } else if (d.number === 9) {
      x = lerp(d.x, ball.x, Math.min(1, t / 4));
      y = d.y + Math.min(t * 0.6, 3) * PX_PER_M_Y;
    } else {
      x = lerp(d.x, (d.x + ball.x) / 2, Math.min(1, t / 5));
      y = d.y + Math.min(t * 0.4, 2) * PX_PER_M_Y;
    }
    out.push({ ...d, x: clamp(x, PLAYER_R, BOARD_W - PLAYER_R), y });
  }
  return out;
}

/** The front-line defender closest to where the strike runner finishes. */
export function targetDefender(built: BuiltPlay, defence: PlayerPos[]): string | null {
  const strike = built.routes[`attack-${built.variant.strike}`];
  if (!strike) return null;
  const pass = built.variant.passes.find((p) => p.to === built.variant.strike);
  const at = positionAt(strike, pass ? pass.t1 + 0.4 : 2.5);
  let best: PlayerPos | null = null;
  let bestD = Infinity;
  for (const d of defence) {
    if (d.number === 15 || d.number === 9) continue;
    const dist = Math.hypot(d.x - at.x, (d.y - at.y) * 0.4);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best?.id ?? null;
}
