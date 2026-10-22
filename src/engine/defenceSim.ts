import type { LaneId, Layout, OpenSide, PlayerPos, Point } from '../board/types';
import { BOARD_W, PLAYER_R, PX_PER_M_X, PX_PER_M_Y, clamp } from '../board/constants';
import type { Alignment, DefenceSystemId } from '../data/defenceSystems';
import { acrossScale, phaseGeometry, phaseLayout, type PhaseGeometry } from '../data/phaseFormation';
import type { Keyframe, PlayVariant } from '../data/plays';
import { buildPlay, type BuiltPlay } from './animate';

/**
 * Defence scenarios: the attack moves the ball along its backline from a ruck and the
 * defence responds according to the chosen system. The attack can align deep, standard
 * or flat so the "blitz when they are deep" logic can be seen rather than read.
 */

export const TRIGGER = 0.3; // ball leaves 9's hands
export const DEF_DURATION = 5;

export interface Scenario {
  system: DefenceSystemId;
  layout: Layout;
  built: BuiltPlay;
  dir: 1 | -1;
  geometry: PhaseGeometry;
  alignment: Alignment;
}

const mx = (m: number) => m * PX_PER_M_X;
const my = (m: number) => m * PX_PER_M_Y;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const steady = (dy: number, dx = 0): Keyframe[] => [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.8, dx: 0, dy: 0.6 },
  { t: DEF_DURATION, dx, dy },
];

/** Ball moved along the backline: 9 → 10 → 12 → 13 → 14, each receiver running onto it. */
const WIDE: PlayVariant = {
  id: 'wide',
  label: 'Ball to the edge',
  strike: 14,
  seam: [],
  passes: [
    { from: 9, to: 10, t0: 0.3, t1: 0.7 },
    { from: 10, to: 12, t0: 1.2, t1: 1.6 },
    { from: 12, to: 13, t0: 2.1, t1: 2.5 },
    { from: 13, to: 14, t0: 3.0, t1: 3.4 },
  ],
  routes: {
    9: [
      { t: 0, dx: 0, dy: 0 },
      { t: 1, dx: 0.5, dy: 0.8 },
      { t: DEF_DURATION, dx: 3, dy: 4 },
    ],
    10: steady(5, 1.5),
    12: steady(6, 1.5),
    13: steady(6.5, 1.5),
    14: steady(7, 0.5),
    15: steady(6, 2),
    11: steady(5, 0.5),
  },
};

/** The dog-leg demo: 10 hits 12 on a straight line into the seam beside the late defender. */
const STRIKE_12: PlayVariant = {
  id: 'strike12',
  label: 'Straight runner into the seam',
  strike: 12,
  seam: [],
  passes: [
    { from: 9, to: 10, t0: 0.3, t1: 0.7 },
    { from: 10, to: 12, t0: 1.4, t1: 1.8 },
  ],
  routes: {
    9: WIDE.routes[9],
    10: [
      { t: 0, dx: 0, dy: 0 },
      { t: 0.7, dx: 0, dy: 1 },
      { t: 1.8, dx: 0.5, dy: 3.5 },
      { t: DEF_DURATION, dx: 1, dy: 6 },
    ],
    12: [
      { t: 0, dx: 0, dy: 0 },
      { t: 1.0, dx: 0, dy: 0.8 },
      { t: 1.8, dx: -0.5, dy: 4 },
      { t: 3.0, dx: -1, dy: 12 },
      { t: DEF_DURATION, dx: -1.5, dy: 22 },
    ],
    13: steady(6, 1),
    14: steady(6, 0),
    15: steady(5, 1),
    11: steady(4, 0),
  },
};

const BACKS = new Set([10, 11, 12, 13, 14, 15]);

export function buildScenario(system: DefenceSystemId, lane: LaneId, openSide: OpenSide, alignment: Alignment): Scenario {
  const dir: 1 | -1 = openSide === 'right' ? 1 : -1;
  const geometry = phaseGeometry(lane, 'halfway', openSide);
  const base = phaseLayout({ lane, row: 'halfway', openSide, podMode: 'pods', defenceMode: 'drift' });
  const shift = alignment === 'deep' ? my(3) : alignment === 'flat' ? -my(3) : 0;
  const ruck = base.ball;
  const players: PlayerPos[] = base.players.map((p) => {
    if (p.team === 'attack' && BACKS.has(p.number)) return { ...p, y: p.y + shift };
    return p;
  });
  if (system === 'pendulum') {
    // Back three start deep: near winger wide on the open edge, 15 in the middle, far winger deep on the blind.
    for (const p of players) {
      if (p.team !== 'defence') continue;
      if (p.number === 14) Object.assign(p, { x: clamp(ruck.x + dir * mx(geometry.openWidth - 5), PLAYER_R, BOARD_W - PLAYER_R), y: ruck.y - my(13) });
      if (p.number === 15) Object.assign(p, { x: ruck.x + dir * mx(6), y: ruck.y - my(24) });
      if (p.number === 11) Object.assign(p, { x: clamp(ruck.x - dir * mx(Math.max(geometry.blindWidth - 6, 2)), PLAYER_R, BOARD_W - PLAYER_R), y: ruck.y - my(17) });
    }
  }
  const layout: Layout = { ...base, players };
  const variant = system === 'dogleg' ? STRIKE_12 : WIDE;
  return { system, layout, built: buildPlay(layout, variant, dir, acrossScale(geometry)), dir, geometry, alignment };
}

export interface DefenceFrame {
  players: PlayerPos[];
  badges: Record<string, string>;
  rings: string[];
}

interface Motion {
  lineSpeed: number; // m/s up the pitch
  lateral: number; // fraction of the ball's lateral travel the line slides
  maxAdvance: number; // m
}

const MOTION: Record<DefenceSystemId, Motion> = {
  blitz: { lineSpeed: 3.0, lateral: 0.15, maxAdvance: 12 },
  drift: { lineSpeed: 1.3, lateral: 0.75, maxAdvance: 6 },
  pendulum: { lineSpeed: 1.3, lateral: 0.7, maxAdvance: 6 },
  shooter: { lineSpeed: 1.4, lateral: 0.55, maxAdvance: 7 },
  dogleg: { lineSpeed: 3.0, lateral: 0.15, maxAdvance: 12 },
};

function nearestFrontDefender(front: PlayerPos[], x: number): PlayerPos | null {
  let best: PlayerPos | null = null;
  let bestD = Infinity;
  for (const d of front) {
    const dist = Math.abs(d.x - x);
    if (dist < bestD) {
      bestD = dist;
      best = d;
    }
  }
  return best;
}

export function defendersAt(sc: Scenario, t: number, ball: Point, attackers: PlayerPos[], carrier: number | null): DefenceFrame {
  const { layout, dir, system, geometry } = sc;
  const ruck = layout.ball;
  const m = MOTION[system];
  const dt = Math.max(0, t - TRIGGER);
  const ballTravel = (ball.x - ruck.x) * dir; // px, positive toward the open side
  const progress = clamp(ballTravel / mx(Math.max(geometry.openWidth - 4, 1)), 0, 1);

  const defence = layout.players.filter((p) => p.team === 'defence');
  const front = defence.filter((d) => ruck.y - d.y < my(6));
  const badges: Record<string, string> = {};
  const rings: string[] = [];

  // Role picks made from the starting layout so they are stable through the animation.
  const attack10 = attackers.find((a) => a.number === 10);
  const start10 = layout.players.find((p) => p.team === 'attack' && p.number === 10);
  const start12 = layout.players.find((p) => p.team === 'attack' && p.number === 12);
  const shooter = system === 'shooter' && start10 ? nearestFrontDefender(front, start10.x) : null;
  const late = system === 'dogleg' && start12 ? nearestFrontDefender(front, start12.x) : null;

  // Stop a defender 1.2 m short of any attacker in his channel so the line never runs through the attack.
  // If an attacker in the channel has already gone past, the defender holds where he started.
  const channelCap = (x: number, y: number) => {
    let cap = ruck.y + my(10);
    for (const a of attackers) {
      if (Math.abs(a.x - x) < mx(2.2)) cap = Math.min(cap, a.y - my(1.2));
    }
    return Math.max(cap, y);
  };

  const carrierPos = carrier != null ? attackers.find((a) => a.number === carrier) : null;
  const onBall = carrierPos ? nearestFrontDefender(front, carrierPos.x) : null;

  const out: PlayerPos[] = defence.map((d) => {
    const isFront = front.includes(d);
    let x = d.x;
    let y = d.y;

    if (isFront) {
      const guard = Math.abs(d.x - ruck.x) < mx(3);
      let speed = m.lineSpeed;
      let lateral = m.lateral;
      if (late && d.id === late.id) {
        speed = 0.9;
        badges[d.id] = 'LATE';
        rings.push(d.id);
      }
      if (shooter && d.id === shooter.id) {
        badges[d.id] = 'SHOOT';
        rings.push(d.id);
        const target = attack10 ?? start10!;
        const vx = target.x - d.x;
        const vy = target.y - d.y;
        const dist = Math.hypot(vx / PX_PER_M_X, vy / PX_PER_M_Y);
        const travel = Math.min(3.6 * dt, Math.max(dist - 1.0, 0));
        const k = dist > 0 ? travel / dist : 0;
        x = d.x + vx * k;
        y = Math.min(d.y + vy * k, channelCap(x, d.y));
        return { ...d, x: clamp(x, PLAYER_R, BOARD_W - PLAYER_R), y };
      }
      if (guard) lateral *= 0.4;
      // Neighbours of the shooter push across to close the hole he leaves.
      if (shooter && Math.abs(d.x - shooter.x) < mx(8) && d.id !== shooter.id) {
        x += (shooter.x - d.x) * 0.3 * Math.min(1, dt / 1.2);
      }
      x += dir * lateral * ballTravel;
      const advance = Math.min(speed * dt, m.maxAdvance) * PX_PER_M_Y;
      y = Math.min(d.y + advance, channelCap(x, d.y));
      if (onBall && d.id === onBall.id && !badges[d.id]) badges[d.id] = 'BALL';
    } else if (d.number === 9) {
      badges[d.id] = 'SWEEP';
      x = lerp(d.x, ball.x, Math.min(1, dt / 3));
      y = Math.min(d.y + Math.min(dt * 0.5, 2) * PX_PER_M_Y, channelCap(x, d.y));
    } else if (system === 'pendulum' && (d.number === 14 || d.number === 15 || d.number === 11)) {
      const lineY = front.length ? front.reduce((s, f) => s + f.y, 0) / front.length + Math.min(m.lineSpeed * dt, m.maxAdvance) * PX_PER_M_Y : d.y;
      if (d.number === 14) {
        // Near winger comes up into the line as the ball goes open.
        badges[d.id] = 'UP';
        y = Math.min(lerp(d.y, lineY, clamp(progress / 0.5, 0, 1)), channelCap(x, d.y));
      } else if (d.number === 15) {
        // Fullback slides across behind the near winger.
        badges[d.id] = 'ACROSS';
        x = lerp(d.x, ruck.x + dir * mx(geometry.openWidth - 10), progress);
        y = Math.min(d.y + my(2) * progress, channelCap(x, d.y));
      } else {
        // Far winger drops into the middle.
        badges[d.id] = 'BACK';
        x = lerp(d.x, ruck.x + dir * mx(4), progress);
        y = d.y - my(3) * progress;
      }
    } else {
      // Backfield (15, or a blind winger dropped back): track the ball from depth.
      badges[d.id] = d.number === 15 ? 'BACK' : badges[d.id] ?? '';
      x = lerp(d.x, (d.x + ball.x) / 2, Math.min(1, dt / 4));
      y = d.y + Math.min(dt * 0.4, 2) * PX_PER_M_Y;
    }
    return { ...d, x: clamp(x, PLAYER_R, BOARD_W - PLAYER_R), y };
  });

  for (const id of Object.keys(badges)) if (!badges[id]) delete badges[id];
  return { players: out, badges, rings };
}

/** Metres the carrier is behind (+) or beyond (−) the gain line at the ruck. */
export function gainLineMetres(sc: Scenario, carrier: Point): number {
  return (carrier.y - sc.layout.ball.y) / PX_PER_M_Y;
}
