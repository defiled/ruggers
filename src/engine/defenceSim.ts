import type { LaneId, Layout, OpenSide, PlayerPos, Point } from '../board/types';
import { BOARD_W, PX_PER_M_X, PX_PER_M_Y, clamp, clampPlayer } from '../board/constants';
import type { Alignment, DefenceSystemId } from '../data/defenceSystems';
import { phaseGeometry, type PhaseGeometry } from '../data/phaseFormation';
import type { Keyframe, PlayVariant } from '../data/plays';
import type { Marker, Route } from '../components/Board';
import { ballAt, buildPlay, positionAt, type AbsFrame, type BallState, type BuiltPlay } from './animate';

/**
 * Defence scenarios drawn the way Rugby Slate draws them: backs only, a ruck, and the ball
 * moving along the attacking backline while the defence answers with the chosen system.
 * Each system has its own cast and its own movement rule (see driftAt, blitzAt, shooterAt,
 * pendulumAt). The attack can align deep, standard or flat so "blitz when they are deep,
 * drift when they are flat and wide" can be seen rather than read. We are the defence: drift,
 * blitz and shooter end with our tackle, found by scanning the clip once when it is built, and the
 * play freezes there. The dog-leg is the picture of a defence that fails, so it has no tackle.
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
  /** Our tackle, when the system makes one. The play freezes at `at`. */
  tackle?: Tackle;
}

export interface Tackle {
  at: number;
  /** Defender's number. */
  tackler: number;
  /** Carrier's number. */
  carrier: number;
}

/** A defender this close to the carrier (metres) has him. */
const TACKLE_REACH = 2.2;
/** Seconds the tackler takes to close the last stride and wrap. */
const WRAP_SECONDS = 0.3;

const mx = (m: number) => m * PX_PER_M_X;
const my = (m: number) => m * PX_PER_M_Y;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (u: number) => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};
const smoothstep = (a: number, b: number, v: number) => smooth((v - a) / (b - a));

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

/** Ball moved along the backline: 9 → 10 → 12 → 13 → 14, each receiver running onto it. 14 finishes on the edge. */
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
    14: steady(7, 2),
  },
};

/**
 * The drift picture: the same ball to the edge, but every receiver runs onto his pass toward the
 * gain line. How far each man runs depends on how deep he set (`depths`, metres behind the gain
 * line, alignment included), so the ball reaches 14 near the line whatever the alignment, and the
 * slide has put 13's marker on him for the tackle.
 */
function driftVariant(depths: Record<number, number>): PlayVariant {
  const toGo = (n: number) => Math.max(depths[n] - 3.5, 1); // metres to a stride short of the gain line
  const receiver = (n: number, pass: number, dxOut: number): Keyframe[] => {
    const d = toGo(n);
    const dy = Math.min(0.6 * d, 3 * pass);
    return [
      { t: 0, dx: 0, dy: 0 },
      { t: pass, dx: dxOut * 0.6, dy },
      { t: DEF_DURATION, dx: dxOut, dy: dy + 1.5 },
    ];
  };
  const d14 = toGo(14);
  const catch14 = WIDE.passes[3].t1;
  return {
    ...WIDE,
    id: 'driftWide',
    routes: {
      9: NINE_ROUTE,
      10: receiver(10, WIDE.passes[1].t0, 1.0),
      12: receiver(12, WIDE.passes[2].t0, 1.5),
      13: receiver(13, WIDE.passes[3].t0, 2.0),
      // 14 builds speed as the ball comes and hits the last pass flat out, no faster than a sprint.
      14: [
        { t: 0, dx: 0, dy: 0 },
        { t: catch14 - 1.2, dx: 0.3, dy: 0.15 * d14 },
        { t: catch14, dx: 1, dy: 0.45 * d14 },
        { t: catch14 + 1.2, dx: 2.5, dy: Math.min(d14, 0.45 * d14 + 8) },
        { t: DEF_DURATION, dx: 3.2, dy: Math.min(d14, 0.45 * d14 + 8) + 1.5 },
      ],
    },
  };
}

/** The dog-leg demo: 10 hits 12, who sees the kink and takes the inside gap beside the late defender. */
const STRIKE_12: PlayVariant = {
  id: 'strike12',
  label: 'Runner into the seam',
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
      { t: 2.6, dx: -3.5, dy: 8 },
      { t: 3.4, dx: -4.5, dy: 13 },
      { t: DEF_DURATION, dx: -5, dy: 22 },
    ],
    13: steady(6, 1),
    14: steady(6, 0),
  },
};

/** The shooter picture: their 10 passes to 12, and our 12 has shot the moment the pass went. Their 12 is hit as he catches. */
const TO_TWELVE: PlayVariant = {
  id: 'toTwelve',
  label: 'Ball to 12',
  strike: 12,
  seam: [],
  passes: [
    { from: 9, to: 10, t0: 0.3, t1: 0.7 },
    { from: 10, to: 12, t0: 1.2, t1: 1.6 },
  ],
  routes: {
    9: NINE_ROUTE,
    10: [
      { t: 0, dx: 0, dy: 0 },
      { t: 0.7, dx: 0, dy: 1 },
      { t: 1.6, dx: 0.5, dy: 3 },
      { t: DEF_DURATION, dx: 1, dy: 5 },
    ],
    12: [
      { t: 0, dx: 0, dy: 0 },
      { t: 0.8, dx: 0, dy: 0.6 },
      { t: 1.6, dx: 0.3, dy: 3.2 },
      { t: 2.0, dx: 0.3, dy: 3.6 },
      { t: DEF_DURATION, dx: 0.3, dy: 3.8 },
    ],
    13: steady(5, 1),
  },
};

/** Pendulum: nobody carries, the ball glides along `ballPath`. No passes, so the scrubber shows none. */
const PENDULUM: PlayVariant = { id: 'pendulum', label: 'Ball across the field', strike: 14, seam: [], passes: [], routes: {} };

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
  // Three defenders against five attackers (9 plus four receivers). The slide and the touchline absorb the overlap.
  drift: { attack: BACKLINE, defence: [inside(10, 9), inside(12, 17), inside(13, 25)] },
  blitz: { attack: BACKLINE, defence: [inside(10, 9), inside(12, 17), inside(13, 25), inside(14, 33)] },
  dogleg: { attack: BACKLINE, defence: [inside(10, 9), inside(12, 17), inside(13, 25), inside(14, 33)] },
  // Our 12 shoots on their 10 → 12 pass. Their 12 stands a touch flatter so the picture is the Slate one: tackled as he catches.
  shooter: {
    attack: [
      [9, 0.6, 1],
      [10, 9, 8],
      [12, 17, 9],
      [13, 25, 12],
    ],
    defence: [[9, 1, -6], inside(10, 9), inside(12, 17), inside(13, 25)],
  },
  // Back three only, as Rugby Slate draws it. Placed by pendulumAt from the ball; these are only the set positions.
  pendulum: { attack: [], defence: [[11, 0, -9], [15, 0, -16], [14, 0, -9]] },
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
    const sc: Scenario = { system, layout, built: buildPlay(layout, PENDULUM, dir, k), dir, geometry, alignment, defensiveLineY, across: k, ballPath };
    // Set positions come from the ball at t = 0 so the picture is right before play starts.
    sc.layout = { ...layout, players: pendulumAt(sc, ballPath[0]).players };
    return sc;
  }

  const depths = Object.fromEntries(cast.attack.map(([n, , depth]) => [n, BACKS.has(n) ? depth + shift : depth]));
  const variant = system === 'dogleg' ? STRIKE_12 : system === 'shooter' ? TO_TWELVE : system === 'drift' ? driftVariant(depths) : WIDE;
  const sc: Scenario = { system, layout, built: buildPlay(layout, variant, dir, k), dir, geometry, alignment, defensiveLineY, across: k };
  if (system !== 'dogleg') sc.tackle = findTackle(sc);
  return sc;
}

export interface SimFrame {
  attackers: PlayerPos[];
  ball: BallState;
  defence: DefenceFrame;
}

/** Everyone's position at time t with no tackle applied: the raw rules, used to find the tackle. */
function rawFrame(sc: Scenario, t: number): SimFrame {
  const attackers = sc.layout.players.filter((p) => p.team === 'attack').map((p) => ({ ...p, ...positionAt(sc.built.routes[p.id], t) }));
  const ball: BallState = sc.ballPath
    ? { pos: positionAt(sc.ballPath, t), carrier: null, inFlight: false }
    : ballAt(sc.built, Object.fromEntries(attackers.map((p) => [p.id, { x: p.x, y: p.y }])), t);
  return { attackers, ball, defence: defendersAt(sc, t, ball.pos, attackers, ball.carrier) };
}

const metresApart = (a: Point, b: Point) => Math.hypot((a.x - b.x) / PX_PER_M_X, (a.y - b.y) / PX_PER_M_Y);

/** The first moment a defender is within reach of the carrier, and who they both are. */
function findTackle(sc: Scenario): Tackle | undefined {
  for (let t = TRIGGER; t <= DEF_DURATION; t += 0.05) {
    const { attackers, ball, defence } = rawFrame(sc, t);
    if (ball.carrier == null) continue;
    const carrier = attackers.find((a) => a.number === ball.carrier);
    if (!carrier) continue;
    for (const d of defence.players) {
      // Only the man marking the carrier (or the shooter) makes the tackle; a defender sliding past does not.
      const badge = defence.badges[d.id];
      if (badge !== 'BALL' && badge !== 'SHOOT') continue;
      if (Math.abs(d.x - carrier.x) / PX_PER_M_X <= 2 && metresApart(d, carrier) <= TACKLE_REACH) {
        return { at: Math.round(t * 100) / 100, tackler: d.number, carrier: carrier.number };
      }
    }
  }
  return undefined;
}

/**
 * The whole picture at time t. After the tackle the play is dead: the attack and the rest of the
 * line hold where they were, and the tackler closes the last stride onto the carrier.
 */
export function simulate(sc: Scenario, t: number): SimFrame {
  const tk = sc.tackle;
  if (!tk || t < tk.at) return rawFrame(sc, t);
  const frame = rawFrame(sc, tk.at);
  const carrier = frame.attackers.find((a) => a.number === tk.carrier);
  const u = smooth((t - tk.at) / WRAP_SECONDS);
  const players = frame.defence.players.map((d) => {
    if (d.number !== tk.tackler || !carrier) return d;
    return finish(d, lerp(d.x, carrier.x - sc.dir * mx(0.4), u), lerp(d.y, carrier.y - my(0.7), u));
  });
  const tacklerId = `defence-${tk.tackler}`;
  const badges = { ...frame.defence.badges, [tacklerId]: 'TACKLE' };
  const rings = frame.defence.rings.includes(tacklerId) ? frame.defence.rings : [...frame.defence.rings, tacklerId];
  return { ...frame, defence: { ...frame.defence, players, badges, rings } };
}

export interface DefenceFrame {
  players: PlayerPos[];
  badges: Record<string, string>;
  rings: string[];
  /** Extra lines: the pendulum link between the back three, the dog-leg runner's options. */
  routes?: Route[];
  /** Labelled points: the gaps either side of the late defender. */
  markers?: Marker[];
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

/**
 * Stop a defender 1.2 m short of any attacker still in front of him in his channel, so the line
 * never runs through the attack. The cap eases in as the attacker gets laterally closer (fully on
 * inside 1.5 m, off beyond 3 m) so nothing snaps when a runner crosses a channel.
 */
function channelCap(ctx: Ctx, x: number, y: number): number {
  const far = ctx.sc.layout.ball.y + my(14); // nobody chases past here, even with nobody in front
  let cap = far;
  for (const a of ctx.attackers) {
    if (a.y <= y) continue;
    const w = 1 - smoothstep(1.5, 3, Math.abs(a.x - x) / PX_PER_M_X);
    if (w > 0) cap = Math.min(cap, lerp(far, a.y - my(1.2), w));
  }
  return Math.max(cap, y);
}

/** Metres advanced after dt seconds at `speed` m/s, capped at `maxM`. */
const advance = (dt: number, speed: number, maxM: number) => my(Math.min(speed * dt, maxM));

/** A defender's spot on his man: the inside shoulder, one metre toward the ruck. */
const shoulderOf = (sc: Scenario, mark: Point | undefined, fallback: number) => (mark ? mark.x - sc.dir * mx(1) * sc.across : fallback);

const attacker = (ctx: Ctx, n: number) => ctx.attackers.find((a) => a.number === n);

function finish(d: PlayerPos, x: number, y: number): PlayerPos {
  const p = clampPlayer({ x, y });
  return { ...d, x: p.x, y: p.y };
}

export function defendersAt(sc: Scenario, t: number, ball: Point, attackers: PlayerPos[], carrier: number | null): DefenceFrame {
  const ctx: Ctx = { sc, t, dt: Math.max(0, t - TRIGGER), ball, attackers, carrier, badges: {}, rings: [] };
  const frame = sc.system === 'drift' ? driftAt(ctx) : sc.system === 'shooter' ? shooterAt(ctx) : sc.system === 'pendulum' ? pendulumAt(sc, ball) : blitzAt(ctx);
  for (const id of Object.keys(frame.badges)) if (!frame.badges[id]) delete frame.badges[id];
  return frame;
}

/** Order the ball travels along the backline; a defender's mark is one of these, and his hand-off is the next one out. */
const RECEIVERS = [10, 12, 13, 14];

/**
 * Drift, as Rugby Slate draws it: three defenders on four receivers. The line comes up under
 * control, and from the moment the first pass goes (10 → 12) the whole line drifts "up and out"
 * one man together: 10's marker ends on 12, 12's on 13, 13's on 14. The slide is one smooth
 * movement paced to the ball, finishing as 14 catches, each man easing from the inside shoulder
 * of his own attacker to the inside shoulder of the next, so the spacing holds the whole way.
 * The touchline is the extra defender; 13's marker makes the tackle on the edge.
 */
function driftAt(ctx: Ctx): DefenceFrame {
  const { sc, t, dt, badges, rings } = ctx;
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const passes = sc.built.variant.passes;
  const handOff = passes[1]; // 10 → 12: the ball going past the first marker
  const lastCatch = passes[passes.length - 1];
  const s = handOff && lastCatch ? smooth((t - handOff.t0) / (lastCatch.t1 - handOff.t0)) : 0;

  const players = defence.map((d) => {
    const i = RECEIVERS.indexOf(d.number);
    const next = RECEIVERS[Math.min(i + 1, RECEIVERS.length - 1)];
    const own = shoulderOf(sc, attacker(ctx, RECEIVERS[i]), d.x);
    const out = shoulderOf(sc, attacker(ctx, next), own);
    const x = lerp(own, out, s);
    const marking = s >= 0.5 ? next : RECEIVERS[i];
    const y = Math.min(d.y + advance(dt, 1.6, 8), channelCap(ctx, x, d.y));
    if (ctx.carrier === marking) badges[d.id] = 'BALL';
    else if (marking !== RECEIVERS[i]) badges[d.id] = `→${marking}`;
    return finish(d, x, y);
  });
  return { players, badges, rings };
}

/** Blitz line speed (m/s): a real rush, so the tackle lands on the first receivers behind the gain line. */
const BLITZ_SPEED = 6.0;

/**
 * Blitz (and the dog-leg demo): every defender marks his man and rushes up flat and fast, sliding
 * only a little with the ball. In the dog-leg the defender opposite 12 is late off the line and
 * flat-footed, and the runner's two options are drawn in front of him; that line comes up slower
 * so the kink reads clearly.
 */
function blitzAt(ctx: Ctx): DefenceFrame {
  const { sc, t, dt, ball, badges, rings } = ctx;
  const ruck = sc.layout.ball;
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const ballTravel = (ball.x - ruck.x) * sc.dir;
  const late = sc.system === 'dogleg' ? 12 : null;
  const onBall = ctx.carrier != null ? defence.find((d) => d.number === ctx.carrier) : null;

  const players = defence.map((d) => {
    const mark = attacker(ctx, d.number);
    const startMark = sc.layout.players.find((p) => p.team === 'attack' && p.number === d.number);
    let speed = sc.system === 'blitz' ? BLITZ_SPEED : 3.0;
    let track = 0.7;
    if (d.number === late) {
      speed = 0.9;
      track = 0; // late and flat-footed: he does not follow his man either
      badges[d.id] = 'LATE';
      rings.push(d.id);
    } else if (onBall && d.id === onBall.id) {
      badges[d.id] = 'BALL';
    }
    // Shadow the man's lateral movement, plus a small slide with the ball.
    const x = d.x + (mark && startMark ? (mark.x - startMark.x) * track : 0) + sc.dir * 0.05 * ballTravel;
    const y = Math.min(d.y + advance(dt, speed, 16), channelCap(ctx, x, d.y));
    return finish(d, x, y);
  });

  const frame: DefenceFrame = { players, badges, rings };
  if (late) Object.assign(frame, doglegOptions(ctx, players, t));
  return frame;
}

/**
 * The dog-leg runner's options: from the moment the line has kinked (1.0 s) two dashed lines run
 * from 12 to the gap inside and the gap outside the late defender. At 2.2 s he commits inside and
 * only that line stays, until he is through it.
 */
function doglegOptions(ctx: Ctx, defenders: PlayerPos[], t: number): Pick<DefenceFrame, 'routes' | 'markers'> {
  const runner = attacker(ctx, 12);
  const late = defenders.find((d) => d.number === 12);
  const d10 = defenders.find((d) => d.number === 10);
  const d13 = defenders.find((d) => d.number === 13);
  if (!runner || !late || !d10 || !d13 || t < 1.0) return {};
  // The gaps sit either side of the late man, level with him on the runner's side (the men beside him are already past).
  const insideGap: Point = { x: (d10.x + late.x) / 2, y: late.y + my(1.5) };
  const outsideGap: Point = { x: (d13.x + late.x) / 2, y: late.y + my(1.5) };
  const gold = '#fde68a';
  if (t < 2.2) {
    return {
      routes: [
        { id: 'option-inside', points: [runner, insideGap], color: gold, emphasis: true },
        { id: 'option-outside', points: [runner, outsideGap], color: gold, emphasis: true },
      ],
      markers: [
        { x: insideGap.x, y: insideGap.y, label: 'INSIDE' },
        { x: outsideGap.x, y: outsideGap.y, label: 'OUTSIDE' },
      ],
    };
  }
  if (runner.y <= late.y) return {}; // past the late man: through
  return { routes: [{ id: 'option-inside', points: [runner, insideGap], color: gold, emphasis: true }], markers: [{ x: insideGap.x, y: insideGap.y, label: 'INSIDE' }] };
}

/** When their 12 leaves the line: 10's hips turn to pass, a beat before the ball goes at 1.2 s. */
const SHOOT_AT = 1.0;
const SHOOT_SPEED = 7.5; // m/s

/**
 * Shooter, as Rugby Slate draws it: the line comes up under control and the defender opposite the
 * next receiver shoots out of it as the pass is thrown, meeting the receiver as he catches, well
 * behind the gain line. Here our 12 shoots on their 10 → 12 pass. 10 and 13 keep coming and fold
 * in toward the hole he left; 9 lives behind the shooter for the snipe and the offload.
 */
function shooterAt(ctx: Ctx): DefenceFrame {
  const { sc, t, dt, ball, badges, rings } = ctx;
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const shooterStart = defence.find((d) => d.number === 12)!;
  const target = attacker(ctx, 12);
  const lineUp = (d: PlayerPos, upTo: number) => d.y + advance(Math.max(0, Math.min(t, upTo) - TRIGGER), 1.4, 5);

  const players = defence.map((d) => {
    if (d.number === 12) {
      if (t < SHOOT_AT || !target) {
        const y = Math.min(lineUp(d, t), channelCap(ctx, d.x, d.y));
        return finish(d, d.x, y);
      }
      badges[d.id] = 'SHOOT';
      rings.push(d.id);
      const fromY = lineUp(d, SHOOT_AT);
      const vx = (target.x - d.x) / PX_PER_M_X;
      const vy = (target.y - fromY) / PX_PER_M_Y;
      const dist = Math.hypot(vx, vy);
      const travel = Math.min(SHOOT_SPEED * (t - SHOOT_AT), Math.max(dist - 1.0, 0));
      const u = dist > 0 ? travel / dist : 0;
      const x = d.x + mx(vx) * u;
      return finish(d, x, Math.min(fromY + my(vy) * u, channelCap(ctx, x, d.y)));
    }
    if (d.number === 9) {
      badges[d.id] = 'SWEEP';
      const x = lerp(d.x, (shooterStart.x + ball.x) / 2, smooth(dt / 1.5));
      const y = d.y + advance(dt, 1.0, 2);
      return finish(d, x, y);
    }
    // 10 and 13: up under control, folding in toward the hole the shooter left.
    const mark = attacker(ctx, d.number);
    const fill = clamp((shooterStart.x - d.x) * 0.25, -mx(2), mx(2)) * smooth((t - SHOOT_AT) / 1.5);
    const x = shoulderOf(sc, mark, d.x) + fill;
    const y = Math.min(d.y + advance(dt, 1.4, 5), channelCap(ctx, x, d.y));
    badges[d.id] = t >= SHOOT_AT ? 'FILL' : '';
    return finish(d, x, y);
  });
  return { players, badges, rings };
}

/**
 * Back-three pendulum, as Rugby Slate draws it: only 11, 15 and 14 against the ball. The ball-side
 * winger comes up to a stride behind the defensive line on his touchline; 15 is across behind him;
 * the far winger is deep toward the middle. Everything is a function of how far across the pitch
 * the ball is, and the three are joined by the pendulum line.
 */
function pendulumAt(sc: Scenario, ball: Point): DefenceFrame {
  const defence = sc.layout.players.filter((p) => p.team === 'defence');
  const badges: Record<string, string> = {};
  const lineY = sc.defensiveLineY;
  const touchL = 10;
  const touchR = BOARD_W - 10;
  const u = clamp((ball.x - touchL) / (touchR - touchL), 0, 1); // 0 = left touchline, 1 = right
  const leftWing = sc.dir === 1 ? 11 : 14; // the blind winger stands on the side the open play is not
  // v = 0: the ball is on my touchline, so I am up, a stride behind the line (never on or over it).
  const nearLine = (v: number) => lerp(lineY - my(1.5), lineY - my(7), smooth(v));

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
    }
    const p = clampPlayer({ x, y });
    return { ...d, x: p.x, y: p.y };
  });
  const byX = [...players].sort((a, b) => a.x - b.x);
  const routes: Route[] = [{ id: 'pendulum', points: byX.map((p) => ({ x: p.x, y: p.y })), color: '#60a5fa', emphasis: true }];
  return { players, badges, rings: [], routes };
}

/** Metres the carrier is behind (+) or beyond (−) the gain line at the ruck. */
export function gainLineMetres(sc: Scenario, carrier: Point): number {
  return (carrier.y - sc.layout.ball.y) / PX_PER_M_Y;
}
