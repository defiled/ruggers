import type { LaneId, Layout, OpenSide, PlayerPos, Point } from '../board/types';
import { BOARD_W, PX_PER_M_X, PX_PER_M_Y, clamp, clampPlayer } from '../board/constants';
import type { Alignment, DefenceSystemId } from '../data/defenceSystems';
import { phaseGeometry, type PhaseGeometry } from '../data/phaseFormation';
import type { Keyframe, PlayVariant } from '../data/plays';
import { buildPlay, positionAt, type AbsFrame, type BuiltPlay } from './animate';

/**
 * Defence scenarios drawn the way Rugby Slate draws them: backs only, a ruck, and the ball
 * moving along the attacking backline while the defence answers with the chosen system.
 * Each system has its own cast and its own movement rule (see driftAt, blitzAt, shooterAt,
 * pendulumAt). The attack can align deep, standard or flat so "blitz when they are deep,
 * drift when they are flat and wide" can be seen rather than read.
 */

export const TRIGGER = 0.3; // ball leaves 9's hands
export const DEF_DURATION = 5;
/** Defensive line sits this far behind the gain line (metres). */
const LINE_DEPTH = 2.5;

export interface Scenario {
  system: DefenceSystemId;
  layout: Layout;
  built: BuiltPlay;
  dir: 1 | -1;
  geometry: PhaseGeometry;
  alignment: Alignment;
  /** Y of the defensive line at set, in board px. */
  defensiveLineY: number;
  /** Lateral compression of the shape when the open side is narrow (1 = full width). */
  across: number;
  /** Pendulum only: the ball is not carried, it glides along this path. */
  ballPath?: AbsFrame[];
}

const mx = (m: number) => m * PX_PER_M_X;
const my = (m: number) => m * PX_PER_M_Y;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (u: number) => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};

const steady = (dy: number, dx = 0): Keyframe[] => [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.8, dx: 0, dy: 0.6 },
  { t: DEF_DURATION, dx, dy },
];

const NINE_ROUTE: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 1, dx: 0.5, dy: 0.8 },
  { t: DEF_DURATION, dx: 3, dy: 4 },
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
    9: NINE_ROUTE,
    10: steady(5, 1.5),
    12: steady(6, 1.5),
    13: steady(6.5, 1.5),
    14: steady(7, 0.5),
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
    9: NINE_ROUTE,
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
  },
};

/** The shooter picture: 9 hits the first receiver, who is tackled before he can move the ball on. */
const FIRST_RECEIVER: PlayVariant = {
  id: 'firstReceiver',
  label: 'Ball to the first receiver',
  strike: 10,
  seam: [],
  passes: [{ from: 9, to: 10, t0: 0.3, t1: 0.8 }],
  routes: {
    9: NINE_ROUTE,
    10: [
      { t: 0, dx: 0, dy: 0 },
      { t: 0.8, dx: 0, dy: 1 },
      { t: 1.6, dx: 0.3, dy: 3 },
      { t: DEF_DURATION, dx: 0.3, dy: 3.3 },
    ],
    12: steady(4, 1),
    13: steady(4.5, 1),
  },
};

/** [number, metres across toward the open side, metres from the gain line (+ attack side, − defence side)]. */
type Spot = [number, number, number];

interface Cast {
  attack: Spot[];
  defence: Spot[];
}

/** Attacking backline staggered deep and wide, as Rugby Slate draws it: each man ~8 m wider and ~2.5 m deeper. */
const BACKLINE: Spot[] = [
  [9, 0.6, 1],
  [10, 9, 8],
  [12, 17, 10.5],
  [13, 25, 13],
  [14, 33, 15.5],
];
const inside = (n: number, across: number): Spot => [n, across - 1, -LINE_DEPTH];

const CAST: Record<DefenceSystemId, Cast> = {
  // One-man overlap: three defenders against four receivers. The slide and the touchline absorb it.
  drift: { attack: BACKLINE, defence: [inside(10, 9), inside(12, 17), inside(13, 25)] },
  blitz: { attack: BACKLINE, defence: [inside(10, 9), inside(12, 17), inside(13, 25), inside(14, 33)] },
  dogleg: { attack: BACKLINE, defence: [inside(10, 9), inside(12, 17), inside(13, 25), inside(14, 33)] },
  shooter: {
    attack: [
      [9, 0.6, 1],
      [10, 9, 9],
      [12, 17, 11],
      [13, 25, 13],
    ],
    defence: [[9, 1, -6], inside(10, 9), inside(12, 17), inside(13, 25)],
  },
  // Back three plus the sweeper. Placed by pendulumAt from the ball, these are only the set positions.
  pendulum: { attack: [], defence: [[9, 0, -6], [11, 0, -9], [15, 0, -16], [14, 0, -9]] },
};

const BACKS = new Set([10, 12, 13, 14]);

export function buildScenario(system: DefenceSystemId, lane: LaneId, openSide: OpenSide, alignment: Alignment): Scenario {
  const dir: 1 | -1 = openSide === 'right' ? 1 : -1;
  const geometry = phaseGeometry(lane, 'halfway', openSide);
  const ruck: Point = { x: geometry.bx, y: geometry.by };
  // Compress the shape when the open side is too narrow for a 33 m backline.
  const k = Math.min(1, (geometry.openWidth - 4) / 36);
  const shift = alignment === 'deep' ? 3 : alignment === 'flat' ? -3 : 0;
  const cast = CAST[system];
  const place = (team: 'attack' | 'defence', [number, across, depth]: Spot): PlayerPos => {
    const deep = team === 'attack' && BACKS.has(number) ? depth + shift : depth;
    const p = clampPlayer({ x: ruck.x + dir * mx(across) * k, y: ruck.y + my(deep) });
    return { id: `${team}-${number}`, team, number, x: p.x, y: p.y };
  };
  const players = [...cast.defence.map((s) => place('defence', s)), ...cast.attack.map((s) => place('attack', s))];
  const layout: Layout = { boardView: 'pitchMiddle', ball: ruck, players };
  const defensiveLineY = ruck.y - my(LINE_DEPTH);

  if (system === 'pendulum') {
    // No carriers: the ball glides to the open edge and back across to the blind, as in Rugby Slate's picture.
    const y = ruck.y + my(6);
    const openEdge = ruck.x + dir * mx(geometry.openWidth - 6);
    const blindEdge = ruck.x - dir * mx(Math.max(geometry.blindWidth - 6, 2));
    const ballPath: AbsFrame[] = [
      { t: 0, x: ruck.x, y },
      { t: TRIGGER, x: ruck.x, y },
      { t: 2.4, x: openEdge, y },
      { t: DEF_DURATION, x: blindEdge, y },
    ];
    const sc: Scenario = { system, layout, built: buildPlay(layout, WIDE, dir, k), dir, geometry, alignment, defensiveLineY, across: k, ballPath };
    // Set positions come from the ball at t = 0 so the picture is right before play starts.
    sc.layout = { ...layout, players: pendulumAt(sc, 0, ballPath[0]).players };
    return sc;
  }

  const variant = system === 'dogleg' ? STRIKE_12 : system === 'shooter' ? FIRST_RECEIVER : WIDE;
  return { system, layout, built: buildPlay(layout, variant, dir, k), dir, geometry, alignment, defensiveLineY, across: k };
}

export interface DefenceFrame {
  players: PlayerPos[];
  badges: Record<string, string>;
  rings: string[];
}

interface Ctx {
  sc: Scenario;
  t: number;
  dt: number;
  ball: Point;
  attackers: PlayerPos[];
  carrier: number | null;
  badges: Record<string, string>;
  rings: string[];
}

/** Stop a defender 1.2 m short of any attacker still in front of him in his channel, so the line never runs through the attack. */
function channelCap(ctx: Ctx, x: number, y: number): number {
  let cap = ctx.sc.layout.ball.y + my(10);
  for (const a of ctx.attackers) {
    if (a.y > y && Math.abs(a.x - x) < mx(2.2)) cap = Math.min(cap, a.y - my(1.2));
  }
  return Math.max(cap, y);
}

/** Metres advanced after dt seconds at `speed` m/s, capped at `maxM`. */
const advance = (dt: number, speed: number, maxM: number) => my(Math.min(speed * dt, maxM));

/** A defender's spot on his man: the inside shoulder, one metre toward the ruck. */
const shoulder = (ctx: Ctx, mark: PlayerPos | undefined, fallback: number) => (mark ? mark.x - ctx.sc.dir * mx(1) * ctx.sc.across : fallback);

const attacker = (ctx: Ctx, n: number) => ctx.attackers.find((a) => a.number === n);

function finish(d: PlayerPos, x: number, y: number): PlayerPos {
  const p = clampPlayer({ x, y });
  return { ...d, x: p.x, y: p.y };
}

export function defendersAt(sc: Scenario, t: number, ball: Point, attackers: PlayerPos[], carrier: number | null): DefenceFrame {
  const ctx: Ctx = { sc, t, dt: Math.max(0, t - TRIGGER), ball, attackers, carrier, badges: {}, rings: [] };
  const frame = sc.system === 'drift' ? driftAt(ctx) : sc.system === 'shooter' ? shooterAt(ctx) : sc.system === 'pendulum' ? pendulumAt(sc, t, ball) : blitzAt(ctx);
  for (const id of Object.keys(frame.badges)) if (!frame.badges[id]) delete frame.badges[id];
  return frame;
}

/** Order the ball travels along the backline; a defender's mark is one of these, and his hand-off is the next one out. */
const RECEIVERS = [10, 12, 13, 14];

/**
 * Drift, as Rugby Slate draws it: the line comes up under control, and the moment the first pass
 * goes the whole line pushes "up and out" one man: 10's marker takes 12, 12's takes 13, 13's takes 14.
 * Each defender then shadows his new man's inside shoulder, so spacing is kept and the overlap is
 * absorbed with the touchline as the extra defender.
 */
function driftAt(ctx: Ctx): DefenceFrame {
  const { sc, t, dt, badges, rings } = ctx;
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const firstPass = sc.built.variant.passes[1]; // 10 → 12: the ball going past the first marker
  const handOff = firstPass ? firstPass.t0 : Infinity;
  const SLIDE_SECONDS = 1.3;

  const players = defence.map((d) => {
    const markIndex = RECEIVERS.indexOf(d.number);
    const mark = attacker(ctx, RECEIVERS[markIndex]);
    const next = attacker(ctx, RECEIVERS[Math.min(markIndex + 1, RECEIVERS.length - 1)]);
    const inner = shoulder(ctx, mark, d.x);
    const outer = shoulder(ctx, next, inner);
    // Ripple from the inside out so the slide reads as a chain, not a jump.
    const s = smooth((t - handOff - markIndex * 0.12) / SLIDE_SECONDS);
    const x = lerp(inner, outer, s);
    const y = Math.min(d.y + advance(dt, 1.6, 7), channelCap(ctx, x, d.y));
    const marking = s < 0.5 ? mark : next;
    if (marking && ctx.carrier === marking.number) badges[d.id] = 'BALL';
    return finish(d, x, y);
  });
  return { players, badges, rings };
}

/**
 * Blitz (and the dog-leg demo): every defender marks his man and rushes up flat and fast, sliding
 * only a little with the ball. In the dog-leg the defender opposite 12 is late off the line.
 */
function blitzAt(ctx: Ctx): DefenceFrame {
  const { sc, dt, ball, badges, rings } = ctx;
  const ruck = sc.layout.ball;
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const ballTravel = (ball.x - ruck.x) * sc.dir;
  const late = sc.system === 'dogleg' ? 12 : null;
  const onBall = ctx.carrier != null ? defence.find((d) => d.number === ctx.carrier) : null;

  const players = defence.map((d) => {
    const mark = attacker(ctx, d.number);
    const startMark = sc.layout.players.find((p) => p.team === 'attack' && p.number === d.number);
    let speed = 3.0;
    if (d.number === late) {
      speed = 0.9;
      badges[d.id] = 'LATE';
      rings.push(d.id);
    } else if (onBall && d.id === onBall.id) {
      badges[d.id] = 'BALL';
    }
    // Shadow the man's lateral movement, plus a small slide with the ball.
    const x = d.x + (mark && startMark ? (mark.x - startMark.x) * 0.7 : 0) + sc.dir * 0.15 * ballTravel;
    const y = Math.min(d.y + advance(dt, speed, 12), channelCap(ctx, x, d.y));
    return finish(d, x, y);
  });
  return { players, badges, rings };
}

/**
 * Shooter in space, as Rugby Slate draws it: the defender opposite the first receiver breaks the
 * line early and goes straight at him; the men either side come up under control and drift
 * slightly in to fill his channel; 9 lives behind the shooter for the snipe and the offload.
 */
function shooterAt(ctx: Ctx): DefenceFrame {
  const { sc, dt, ball, badges, rings } = ctx;
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const shooterStart = defence.find((d) => d.number === 10)!;
  const target = attacker(ctx, 10);

  const players = defence.map((d) => {
    if (d.number === 10) {
      badges[d.id] = 'SHOOT';
      rings.push(d.id);
      if (!target) return d;
      const vx = (target.x - d.x) / PX_PER_M_X;
      const vy = (target.y - d.y) / PX_PER_M_Y;
      const dist = Math.hypot(vx, vy);
      const travel = Math.min(5.5 * dt, Math.max(dist - 1.0, 0));
      const u = dist > 0 ? travel / dist : 0;
      const x = d.x + mx(vx) * u;
      const y = Math.min(d.y + my(vy) * u, channelCap(ctx, x, d.y));
      return finish(d, x, y);
    }
    if (d.number === 9) {
      badges[d.id] = 'SWEEP';
      const x = lerp(d.x, (shooterStart.x + ball.x) / 2, smooth(dt / 1.5));
      const y = d.y + advance(dt, 1.0, 2);
      return finish(d, x, y);
    }
    // 12 and 13: up under control, drifting in toward the hole the shooter left.
    const mark = attacker(ctx, d.number);
    const fill = clamp((shooterStart.x - d.x) * 0.25, -mx(2), mx(2)) * smooth(dt / 1.5);
    const x = shoulder(ctx, mark, d.x) + fill;
    const y = Math.min(d.y + advance(dt, 1.4, 5), channelCap(ctx, x, d.y));
    badges[d.id] = 'FILL';
    return finish(d, x, y);
  });
  return { players, badges, rings };
}

/**
 * Back-three pendulum, as Rugby Slate draws it: only 11, 15 and 14 (plus 9 sweeping) against the
 * ball. The ball-side winger is up in the line on his touchline; 15 is across behind him; the far
 * winger is deep toward the middle. Everything is a function of how far across the pitch the ball is.
 */
function pendulumAt(sc: Scenario, t: number, ball: Point): DefenceFrame {
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const badges: Record<string, string> = {};
  const lineY = sc.defensiveLineY;
  const touchL = 10;
  const touchR = BOARD_W - 10;
  const u = clamp((ball.x - touchL) / (touchR - touchL), 0, 1); // 0 = left touchline, 1 = right
  const leftWing = sc.dir === 1 ? 11 : 14; // the blind winger stands on the side the open play is not
  const nearLine = (v: number) => lerp(lineY, lineY - my(7), smooth(v)); // v = 0 means the ball is on my touchline

  // The ball 0.5 s ago, for the sweeper's lag.
  const lagged = sc.ballPath ? positionAt(sc.ballPath, Math.max(0, t - 0.5)) : ball;

  const players = defence.map((d) => {
    let x = d.x;
    let y = d.y;
    if (d.number === leftWing) {
      x = lerp(touchL + mx(5), touchL + mx(24), u);
      y = nearLine(u);
      badges[d.id] = u < 0.3 ? 'UP' : 'BACK';
    } else if (d.number === 11 || d.number === 14) {
      x = lerp(touchR - mx(24), touchR - mx(5), u);
      y = nearLine(1 - u);
      badges[d.id] = u > 0.7 ? 'UP' : 'BACK';
    } else if (d.number === 15) {
      x = lerp(touchL + mx(14), touchR - mx(14), u);
      y = lineY - my(8) - my(6) * (1 - Math.abs(2 * u - 1));
      badges[d.id] = 'ACROSS';
    } else if (d.number === 9) {
      x = clamp(lagged.x, touchL + mx(4), touchR - mx(4));
      y = lineY - my(3);
      badges[d.id] = 'SWEEP';
    }
    const p = clampPlayer({ x, y });
    return { ...d, x: p.x, y: p.y };
  });
  return { players, badges, rings: [] };
}

/** Metres the carrier is behind (+) or beyond (−) the gain line at the ruck. */
export function gainLineMetres(sc: Scenario, carrier: Point): number {
  return (carrier.y - sc.layout.ball.y) / PX_PER_M_Y;
}
