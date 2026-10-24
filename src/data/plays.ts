/**
 * The team's six backline calls. The names are ours; each play is modelled on the
 * common coached version of the move it describes, cross-checked against the Rugby Slate
 * animation of the same move (linked per play).
 *
 * Routes are keyframes in metres. `dx`/`dy` are relative to the player's own start
 * (dx positive = toward the open touchline, dy positive = upfield toward the opposition).
 * `rx`/`ry` are relative to the ruck instead (ry positive = upfield), used for runners whose
 * start or target depends on the ruck rather than their own alignment. A ruck-relative
 * first keyframe re-positions the player for that call.
 *
 * Alignment the routes assume (see phaseFormation.attackOffsets): 10 at 13 m across / 9 m deep,
 * 12 at 19 / 10.5, 13 at 26 / 11.5, 15 at 33 / 17, 14 wide at ~42 / 10. The defence stands
 * man-on-man: their 10, 12, 13 and 14 opposite ours, forwards inside and on the far edge.
 * A variant's `shift` moves one man off that alignment for the call (13 sets 2.5 m tighter, at
 * 23.5, on 3 Go, Over/Under, Bread & Butter and Chopper); his marker stays opposite the standard spot.
 *
 * Principles every route follows (checked by src/engine/validatePlays.test.ts):
 *   - the strike runner finishes in a SEAM between two defenders (or where a dragged defender
 *     started), never on a man;
 *   - the strike catch is at least 4 m from the nearest defender, 6-8 m against a static line;
 *   - the passer carries at his own man and only passes once he has drawn him (2 Go: 10 is 3 m from their 10);
 *   - runners run straight unless the line is a deliberate drift or cut, and straighten after the catch;
 *   - a decoy who has done his job turns back toward the ball in support, he does not run on.
 */

import type { PodMode } from '../board/types';

export type Keyframe = { t: number; dx: number; dy: number } | { t: number; rx: number; ry: number };

export interface PassEvent {
  from: number;
  to: number;
  t0: number;
  t1: number;
}

export interface PlayVariant {
  id: string;
  label: string;
  routes: Record<number, Keyframe[]>;
  passes: PassEvent[];
  strike: number;
  /** Passes that are shown but not thrown (10 shaping to 13 on the fake 3 Go). Drawn on the timeline only. */
  fakes?: PassEvent[];
  /** Defending jersey numbers that bound the seam the strike runner finishes in; one number = "where he started". Empty = no seam drawn or checked. */
  seam: number[];
  /** Runners whose lines are deliberately lateral (drift, loop, cut) and exempt from the steepness check. */
  lateral?: number[];
  /** Minimum dy:dx for the strike runner from 0.5 s to 1.5 s after the catch (default 2.5; a switch cut is sharper). */
  strikeSteepness?: number;
  /**
   * Metres to move a player's set position off the standard alignment for this call (dx toward the
   * open side, compressed like route dx; dy upfield). His route is then relative to the moved start,
   * and his marker stays in his own channel. Every option of an alternating play shares the same shift.
   */
  shift?: Record<number, { dx?: number; dy?: number }>;
}

export interface Play {
  id: string;
  name: string;
  tag: string;
  summary: string;
  intent: string;
  sequence: string;
  read: string;
  target: string;
  risk: string;
  fallback: string;
  theory: string;
  reference: { name: string; url: string };
  variants: PlayVariant[];
  /** When the cast depends on the board (6 Go: flanker or wing), picks the variant id from the context. */
  autoVariant?: (ctx: AutoVariantContext) => string;
  /** One line shown in place of the Option control when autoVariant is set. */
  autoNote?: string;
  /** Each new run plays the next option, so the two pictures are seen back to back. The Option control still overrides. */
  alternate?: boolean;
}

export interface AutoVariantContext {
  podMode: PodMode;
  narrowBlind: boolean;
}

export const PLAY_DURATION = 6;

const straight = (dy = 14, dx = 0): Keyframe[] => [
  { t: 0, dx: 0, dy: 0 },
  { t: 1, dx: 0, dy: 1 },
  { t: PLAY_DURATION, dx, dy },
];

const NINE: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 1.2, dx: 0.5, dy: 1 },
  { t: PLAY_DURATION, dx: 4, dy: 6 },
];

const first9to10: PassEvent = { from: 9, to: 10, t0: 0.3, t1: 0.7 };

/** 10 straightens and carries at his own defender: the default first-receiver line. */
const TEN_STRAIGHT: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.7, dx: 0, dy: 1 },
  { t: 1.3, dx: 0.5, dy: 3.5 },
  { t: 1.6, dx: 0.8, dy: 4.5 },
  { t: PLAY_DURATION, dx: 1.5, dy: 9 },
];

/** 2 Go: 10 runs straight and hard at their 10 and only passes once he is on him (3 m away at 2.3 s). */
const TEN_DRAW: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.7, dx: 0, dy: 1 },
  { t: 1.3, dx: 0.3, dy: 3.2 },
  { t: 2.0, dx: 0.5, dy: 5.3 },
  { t: 2.3, dx: 0.7, dy: 6.3 },
  { t: PLAY_DURATION, dx: 1.5, dy: 10 },
];

/** 13 sets this much tighter to 12 (metres) on the calls that run the crash line, so he hits the 12/13 seam running straight. */
export const THIRTEEN_TIGHT = { 13: { dx: -2.5 } };

/**
 * The 3 Go crash line, from the tight start (23.5 m across): 13 holds a beat, then runs near-straight
 * at the 12/13 seam, a metre of unders over the whole run. Over/Under runs exactly the same line as the decoy.
 */
const THIRTEEN_UNDERS: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 1.0, dx: 0, dy: 0.5 },
  { t: 1.4, dx: -0.3, dy: 2 },
  { t: 1.7, dx: -0.6, dy: 3.2 },
  { t: 2.6, dx: -1.0, dy: 8 },
  { t: 3.2, dx: -1.2, dy: 11.5 },
  { t: PLAY_DURATION, dx: -1.6, dy: 20 },
];

/** Over/Under's decoy: the 3 Go line to the gain line, then 13 turns out and works across behind 15 and 14 in support. */
const THIRTEEN_DECOY_SUPPORT: Keyframe[] = [
  ...THIRTEEN_UNDERS.slice(0, 6),
  // Checks at the gain line so he stays behind the ball, then works across to sit inside 14.
  { t: 4.0, dx: 0.3, dy: 11.8 },
  { t: 5.0, dx: 3.0, dy: 11.7 },
  { t: PLAY_DURATION, dx: 6.5, dy: 14 },
];

/**
 * Chopper: 10 runs hard and straight at their 10 for two seconds so he is fully drawn (their 10 is
 * on him, 2 m off the gain line), and only then angles out for the switch at 2.6 s.
 */
const CHOPPER_TEN: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.7, dx: 0, dy: 1 },
  { t: 1.2, dx: 0.2, dy: 3 },
  { t: 1.8, dx: 0.8, dy: 5 },
  { t: 2.3, dx: 2.2, dy: 6.3 },
  { t: 2.6, dx: 3.2, dy: 6.8 },
  { t: PLAY_DURATION, dx: 5.5, dy: 9.5 },
];

/** The Bread & Butter switch picture: 10 out at ~30°, 12 holding then cutting in behind him; the hand-off (or dummy) is at 2.0 s. */
const SWITCH_TEN: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.7, dx: 0, dy: 1 },
  { t: 1.2, dx: 1.2, dy: 3 },
  { t: 1.7, dx: 3.2, dy: 5 },
  { t: 2.0, dx: 4, dy: 5.5 },
  { t: PLAY_DURATION, dx: 5.5, dy: 8.5 },
];
const SWITCH_TWELVE: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.8, dx: 0, dy: 0.5 },
  { t: 1.4, dx: -0.2, dy: 2.5 },
  { t: 1.7, dx: -0.6, dy: 4 },
  { t: 2.0, dx: -1, dy: 5.5 },
  { t: 2.6, dx: -3, dy: 8 },
  { t: 3.2, dx: -4.8, dy: 10.5 },
  { t: PLAY_DURATION, dx: -6, dy: 20 },
];

/** 6 Go: 10 shapes out with the ball to drag their 10, then pops inside behind his body at 2.3 s. */
const INSIDE_BALL_TEN: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 0.7, dx: 0, dy: 1 },
  { t: 1.4, dx: 0.5, dy: 3 },
  { t: 2.0, dx: 1.5, dy: 4.5 },
  { t: 2.3, dx: 2, dy: 5 },
  { t: PLAY_DURATION, dx: 3, dy: 9 },
];
/** The inside runner (6, or 11 from a 5 m lane): starts 9 m across and 12 m deep, inside and behind 10, and straightens into their 10's channel. */
const INSIDE_RUNNER: Keyframe[] = [
  { t: 0, rx: 9, ry: -12 },
  { t: 0.8, rx: 9.5, ry: -10.5 },
  { t: 1.6, rx: 11.5, ry: -8 },
  { t: 2.3, rx: 12.5, ry: -6 },
  { t: 3.3, rx: 12.2, ry: 0 },
  { t: PLAY_DURATION, rx: 12, ry: 14 },
];
const INSIDE_BALL_OUTSIDE: Keyframe[] = [
  { t: 0, dx: 0, dy: 0 },
  { t: 1, dx: 0, dy: 1 },
  { t: 2.3, dx: 1, dy: 5 },
  { t: PLAY_DURATION, dx: 2, dy: 14 },
];

const base = (over: Record<number, Keyframe[]>): Record<number, Keyframe[]> => ({
  9: NINE,
  10: TEN_STRAIGHT,
  11: straight(12, 0.5),
  12: straight(13, 0.5),
  13: straight(13, 0.5),
  14: straight(13, 0),
  15: [
    { t: 0, dx: 0, dy: 0 },
    { t: 2, dx: 0, dy: 3 },
    { t: PLAY_DURATION, dx: 1, dy: 14 },
  ],
  ...over,
});

export const PLAYS: Play[] = [
  {
    id: '2go',
    name: '2 Go',
    tag: 'Crash ball · 12',
    summary: '10 runs straight at his man and hits 12 on a short, flat ball. 12 comes late from depth on a gentle unders line and finishes in the seam between their 10 and 12.',
    intent:
      'Win the gain line with one pass. 10 fixes the defending 10 by running straight at him with the ball in two hands; 12 starts deep, holds, then accelerates onto a short ball so he meets the seam at full pace while both defenders are still square.',
    sequence:
      '9 → 10 (0.5s). 10 runs straight and hard at their 10 and holds the ball until he is on him, passing at 2.3s from 3 m away. 12 holds his depth, then takes it 7 m deep, angles in no more than 15°, and straightens through the seam between their 10 and 12 at ~3.3s. 13 holds his width and trails for the offload.',
    read: 'Call it when the defending 12 is drifting early or standing wide of his man: the seam inside him opens. Also the go-to carry to earn a quick ruck in the middle of the field.',
    target: 'The seam between their 10 and their 12. 10 holds their 10; 12 hits the gap on their 12\'s inside shoulder.',
    risk: 'If 10 passes early their 10 is free to slide onto 12 and the seam closes. 10 must carry at him until he has to tackle. If 12 takes the ball flat and early against a set defender it is a carry into contact with no momentum. He must come from depth, late, and aim at the gap, not the man.',
    fallback: '12 carries square, 13 and the nearest pod clean. Same call next phase off Pod B.',
    theory:
      'Crash ball: a runner from depth hitting a short pass at pace commits two tacklers and gets over the gain line. Keep hips and shoulders square until the pass so no defender can drift; 12 carries in two hands to keep the offload alive.',
    reference: { name: 'Crash 1 – 12', url: 'https://rugbyslate.com/backs-moves/crash-1-12/' },
    variants: [
      {
        id: 'main',
        label: 'Strike 12',
        strike: 12,
        seam: [10, 12],
        passes: [first9to10, { from: 10, to: 12, t0: 2.0, t1: 2.3 }],
        routes: base({
          10: TEN_DRAW,
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.2, dx: 0, dy: 0.5 },
            { t: 1.8, dx: -0.3, dy: 1.5 },
            { t: 2.3, dx: -0.6, dy: 3.5 },
            { t: 3.1, dx: -2, dy: 9 },
            { t: 3.7, dx: -2.8, dy: 13 },
            { t: PLAY_DURATION, dx: -3.5, dy: 21 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.5, dx: 0, dy: 1 },
            { t: 3.2, dx: -1, dy: 6 },
            { t: PLAY_DURATION, dx: -2, dy: 15 },
          ],
        }),
      },
    ],
  },
  {
    id: '3go',
    name: '3 Go',
    tag: 'Miss-12 · 13 unders',
    summary: '12 runs a hard straight decoy at his man. 13 angles in behind him and takes the ball from 10 on an unders line into the seam between their 12 and 13.',
    intent:
      'Hold the defending 12 with a front-door runner, then put a second runner through the seam outside him. 12 must be a genuine threat so his defender cannot drift onto 13.',
    sequence:
      '9 → 10 (0.5s). 12 goes early and straight at his man. 10 angles across behind him toward 13 to shorten the ball. 13 sets tight, 4.5 m outside 12, holds for a second, then runs near-straight behind 12 and takes a 7 m pass from 10 at 1.7s, 8.5 m deep. He hits the seam between their 12 and 13 at ~3.2s without having to cut.',
    read: 'Works when the defending 13 is sitting wide to cover the edge or is slow off the line. If the defence is square and connected the seam is not there: play 12 instead.',
    target: 'The seam between their 12 and their 13.',
    risk: 'The "suicide line" if 12 does not hold his man: 13 runs into two tacklers. 12 must run at the defender, not past him. 10 must pass in front of 12, not through him.',
    fallback: '10 hits 12 front-door, or holds and plays Pod B next phase.',
    theory:
      'Unders line: a runner angling back toward the ball to attack the gap inside a defender who has been fixed by the runner in front. The decoy earns the gap; the strike runner arrives late from depth.',
    reference: { name: 'Crash 2 – 13', url: 'https://rugbyslate.com/backs-moves/crash-2-13/' },
    variants: [
      {
        id: 'main',
        label: 'Strike 13',
        strike: 13,
        seam: [12, 13],
        shift: THIRTEEN_TIGHT,
        lateral: [10], // 10 angles across behind 12 to shorten the pass
        passes: [first9to10, { from: 10, to: 13, t0: 1.4, t1: 1.7 }],
        routes: base({
          // 10 runs across behind 12 toward 13, staying deeper than 12 so the ball goes behind the decoy, not through him.
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.4, dx: 2.0, dy: 2.8 },
            { t: 1.7, dx: 3.0, dy: 3.5 },
            { t: PLAY_DURATION, dx: 4, dy: 8 },
          ],
          // 12 crashes early and hard so he is in front of the ball's flight.
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.8, dx: 0, dy: 1 },
            { t: 1.7, dx: 0, dy: 5.5 },
            { t: 3, dx: 0, dy: 10 },
            { t: PLAY_DURATION, dx: 0.5, dy: 14 },
          ],
          13: THIRTEEN_UNDERS,
        }),
      },
    ],
  },
  {
    id: 'bread',
    name: 'Bread & Butter',
    tag: 'Switch · 12, pop 13',
    summary: '10 and 12 run a switch: 10 out across the line, 12 cutting back inside behind him. Either 12 takes the ball and finishes where their 10 started, or 10 dummies, keeps going and pops to 13 cutting under into the 12/13 seam.',
    intent:
      'Drag their 10 across with the carry, then hit the space behind him (12) or the seam one man out (13). The switch is the same every time, so the defence cannot read which option is on.',
    sequence:
      '9 → 10 (0.5s). 10 angles out at ~30°, ball in two hands. 12 cuts in behind him at 2.0s. Switch 12: 10 hands off on the far hip and 12 straightens into their 10\'s channel. Pop 13: 10 keeps, takes one more step and pops a short ball to 13, who set tight outside 12, held, and runs straight to take it 5 m deep at 2.6s into the seam between their 12 and 13.',
    read: 'Best when the defence slides with 10. If their 10 follows him, give the switch. If their 12 bites in on the switch, pop 13 behind him. On the board the two options run turn about, so you see both reads back to back.',
    target: 'Switch 12: where their 10 started. Pop 13: the seam between their 12 and 13.',
    risk: 'Telegraphing the switch, or 10 running so flat he is tackled before the hand-off. 12 must straighten after the cut. 13 must hold his depth until 10 has committed.',
    fallback: '10 keeps and straightens, or 13 carries and we go again.',
    theory:
      'Switch (scissors): the receiver takes the pass behind the carrier, running the opposite way; the ball is hidden on the far hip. The dummy switch sells the same picture and plays the next man out.',
    reference: { name: 'Switch – 10 & 12 / Dummy Switch Pop', url: 'https://rugbyslate.com/backs-moves/dummy-switch-pop/' },
    alternate: true,
    variants: [
      {
        id: 'opt2',
        label: 'Switch 12',
        strike: 12,
        seam: [10],
        lateral: [10, 12],
        strikeSteepness: 1.5,
        shift: THIRTEEN_TIGHT,
        passes: [first9to10, { from: 10, to: 12, t0: 1.7, t1: 2.0 }],
        routes: base({
          10: SWITCH_TEN,
          12: SWITCH_TWELVE,
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.2, dx: 0, dy: 1 },
            { t: 2.5, dx: -0.5, dy: 5 },
            { t: PLAY_DURATION, dx: -1, dy: 14 },
          ],
        }),
      },
      {
        id: 'pop13',
        label: 'Pop 13',
        strike: 13,
        seam: [12, 13],
        lateral: [10, 12],
        shift: THIRTEEN_TIGHT,
        passes: [first9to10, { from: 10, to: 13, t0: 2.3, t1: 2.6 }],
        routes: base({
          // Same switch picture as above to 2.0 s; 10 keeps and takes one more step out.
          10: [...SWITCH_TEN.slice(0, 5), { t: 2.3, dx: 4.8, dy: 6 }, { t: 2.6, dx: 5.2, dy: 6.3 }, { t: PLAY_DURATION, dx: 6.5, dy: 9 }],
          12: SWITCH_TWELVE,
          // From the tight start he is already outside the 12/13 seam by only a metre: hold, then run straight at it.
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: 0, dy: 0.5 },
            { t: 1.4, dx: 0, dy: 1 },
            { t: 2.0, dx: -0.3, dy: 3.5 },
            { t: 2.6, dx: -0.8, dy: 6.5 },
            { t: 3.4, dx: -1.1, dy: 11.5 },
            { t: PLAY_DURATION, dx: -1.4, dy: 20 },
          ],
        }),
      },
    ],
  },
  {
    id: 'chopper',
    name: 'Chopper',
    tag: 'Rangy · 13 switch or 12',
    summary: '10 runs straight and hard at their 10 to draw him, 12 in step outside, then both angle across. 13 sets tight to 12, waits, then runs hard back inside behind both and takes a switch from 10, finishing where their 10 started.',
    intent:
      'Open the seam between the last forward and the defending 10. Because 10 and 12 run together and sideways, their defenders drift with them and the gap on the inside widens for a strong-running 13.',
    sequence:
      '9 → 10 (0.5s). 10 runs straight at their 10 until he is on him (2 m off the gain line at 2.3s), 12 in step outside; only then do they angle across. 13 sets tight, 4.5 m outside 12, holds until 1.0s, then runs behind both on a hard line back toward where 10 started and takes the switch from 10 at 2.6s, 5 m deep. He straightens into their 10\'s channel. Option 12: 10 gives to 12 continuing the drift, who straightens.',
    read: 'Outside your own 22, from phase play or a scrum (not a lineout). Call it when the inside defenders are following the backline across and the guards are slow to fold.',
    target: 'Where their 10 started: the seam between the edge of the forwards and the inside edge of their backline once their 10 has followed ours across.',
    risk: 'Common errors: 10 drifting sideways before he has drawn his man (he must go straight first), 13 setting too wide so he cannot reach the switch in time, and 13 starting too early so he overruns the pass. 10 must sight 13 earlier than for a normal switch because of the angles.',
    fallback: '10 keeps and straightens, or plays 12 on the drift (option 12).',
    alternate: true,
    theory:
      'Rangy: a sliding run by 10 with 12 in step, and a late run by 13 behind them. The drift creates the gap; the late, deep start means 13 is at full pace when he takes the switch, which is thrown with 10\'s back to the defence.',
    reference: { name: 'Rangy', url: 'https://rugbyslate.com/backs-moves/rangy/' },
    variants: [
      {
        id: 'opt3',
        label: 'Switch 13',
        strike: 13,
        seam: [10],
        lateral: [10, 12, 13],
        shift: THIRTEEN_TIGHT, // 13 sets 4.5 m outside 12 so he can time the run to the switch
        passes: [first9to10, { from: 10, to: 13, t0: 2.3, t1: 2.6 }],
        routes: base({
          10: CHOPPER_TEN,
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 0, dy: 3 },
            { t: 2.3, dx: 0.5, dy: 5 },
            { t: 2.6, dx: 1.5, dy: 5.5 },
            { t: PLAY_DURATION, dx: 3.5, dy: 9 },
          ],
          // From 23.5 m across back to where their 10 started (13 m): 7.5 m across by the switch, at pace but not a sprint.
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: -0.3, dy: 0.5 },
            { t: 1.8, dx: -2.5, dy: 3.5 },
            { t: 2.3, dx: -5, dy: 5.5 },
            { t: 2.6, dx: -7.5, dy: 6.5 },
            { t: 3.4, dx: -10.5, dy: 12 },
            { t: PLAY_DURATION, dx: -11.3, dy: 20 },
          ],
        }),
      },
      {
        id: 'opt2',
        label: 'Option 12',
        strike: 12,
        seam: [12],
        lateral: [10, 13],
        shift: THIRTEEN_TIGHT,
        passes: [first9to10, { from: 10, to: 12, t0: 2.3, t1: 2.6 }],
        routes: base({
          10: CHOPPER_TEN,
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 0, dy: 3 },
            { t: 2.3, dx: 0.5, dy: 5 },
            { t: 2.6, dx: 1, dy: 6 },
            { t: 3.4, dx: 1, dy: 11 },
            { t: PLAY_DURATION, dx: 0.5, dy: 20 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: -0.3, dy: 0.5 },
            { t: 1.8, dx: -2.5, dy: 3.5 },
            { t: 2.3, dx: -5, dy: 5.5 },
            { t: 2.6, dx: -7, dy: 6.5 },
            { t: 3.4, dx: -9.3, dy: 10 },
            { t: PLAY_DURATION, dx: -10, dy: 16 },
          ],
        }),
      },
    ],
  },
  {
    id: 'overunder',
    name: 'Over / Under',
    tag: 'Fake 3 Go · 12 out the back',
    summary: 'A fake 3 Go. 13 runs the exact 3 Go line; 10 shows him the ball, then hits 12 instead. 12 holds, then plays behind 13 to 15 coming in off his depth, and 15 puts 14 away on the edge.',
    intent:
      'After two or three 3 Go calls the defence is watching 13\'s line. Show it again, hold their 12 and 13 with it, and play around the back with short passes the team can make.',
    sequence:
      '9 → 10 (0.5s). 13 runs the 3 Go line with full commitment. At 1.5s 10 shapes the 3 Go pass to 13, then gives to 12 at 2.1s instead. 12 runs straight at his man, holds a beat and passes behind 13 at 3.1s to 15, who has come in from 33 m to take it 7 m deep, one short pass away. 15 straightens outside their 13 and gives 14 at 4.0s; 14 has come in off his touchline to keep the pass short. Once 13 has crossed the gain line he turns out and works across behind 15 and 14 in support.',
    read: 'Call it after 3 Go has been run two or three times. Needs their 12 and 13 to be reading 13\'s line. If they do not bite, 15 carries.',
    target: 'The seam outside their 13 once he has stepped in on the decoy; with their forwards on the edge, the gap between their 13 and their 7.',
    risk: '13 must sell the line but never block a defender. 12 has to hold depth so the ball behind 13 is backward. 15 and 14 must be moving early or they arrive late and the passes get long.',
    fallback: '15 straightens and carries; 14 stays for the next phase.',
    theory:
      'Screen: a hard decoy fixes two defenders and the ball travels behind him to a second-wave runner. Every pass stays under 8 m because the wide men come to the ball rather than the ball going to them.',
    reference: { name: 'Screen 2', url: 'https://rugbyslate.com/backs-moves/screen-2/' },
    variants: [
      {
        id: 'main',
        label: 'Fake 3 Go',
        strike: 15,
        seam: [13, 7],
        lateral: [13, 15, 14],
        shift: THIRTEEN_TIGHT, // 13 sets exactly as he does on 3 Go, so the picture is the same until the ball goes
        // 10 holds through the 3 Go pass window (1.4-1.7 s), shows the ball to 13, then gives to 12.
        fakes: [{ from: 10, to: 13, t0: 1.4, t1: 1.7 }],
        passes: [
          first9to10,
          { from: 10, to: 12, t0: 1.8, t1: 2.1 },
          { from: 12, to: 15, t0: 2.8, t1: 3.1 },
          { from: 15, to: 14, t0: 3.7, t1: 4.0 },
        ],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.4, dx: 0.5, dy: 3 },
            { t: 1.7, dx: 0.8, dy: 3.8 },
            { t: 2.1, dx: 1.2, dy: 4.5 },
            { t: PLAY_DURATION, dx: 2, dy: 8 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.8, dx: 0, dy: 1 },
            { t: 2.1, dx: 0.3, dy: 3.5 },
            { t: 2.8, dx: 0.5, dy: 5.5 },
            { t: 3.1, dx: 0.5, dy: 6 },
            { t: PLAY_DURATION, dx: 1, dy: 10 },
          ],
          13: THIRTEEN_DECOY_SUPPORT,
          15: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: -0.5, dy: 1.5 },
            { t: 2.0, dx: -2.5, dy: 5 },
            { t: 2.8, dx: -5.5, dy: 8.5 },
            { t: 3.1, dx: -6.5, dy: 10 },
            { t: 3.7, dx: -5.5, dy: 13.5 },
            { t: 4.0, dx: -5, dy: 14.5 },
            { t: PLAY_DURATION, dx: -4.5, dy: 22 },
          ],
          14: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1, dx: -0.5, dy: 1 },
            { t: 3.2, dx: -4.5, dy: 3.5 },
            { t: 4.0, dx: -7, dy: 4.5 },
            { t: PLAY_DURATION, dx: -8, dy: 15 },
          ],
        }),
      },
    ],
  },
  {
    id: '6go',
    name: '6 Go',
    tag: 'Flanker inside ball · 11 from the 5 m',
    summary: 'The inside ball off 10. The blindside flanker starts inside and behind 10, runs up on his inside shoulder as the backline shapes wide, and takes a hidden pop into the seam between the last forward and their 10. 11 trails him for the offload. From a 5 m lane there is no blind to hold, so 11 runs the line himself.',
    intent:
      'Punish a defence that drifts with the backline. The runner arrives late and unmarked into the channel between the folding guards and their 10, who has turned his shoulders out to follow ours.',
    sequence:
      '9 → 10 (0.5s). The runner (6, or 11 from the 5 m) goes on the call, runs up behind 10 and arrives a metre inside and two metres behind him at 2.3s. 10 shapes out with the ball in two hands, drags their 10, and pops the inside ball behind his own body. The runner straightens through the seam at ~3s. With 6 carrying, 11 comes in to sit on his inside hip for the offload. 12 and 13 run straight as the out-the-back option.',
    read: 'Works when the guards are slow to fold and their 10 has started to drift with ours. Watch the defending 9: if he is sweeping the blind the channel is empty.',
    target: 'The seam between the last defending forward and their 10, opened when their 10 follows ours out.',
    risk: 'If the guards are set and square it is a congested carry. The runner must not arrive early and stand still. The pop must be hidden behind 10\'s body.',
    fallback: '10 holds and plays 12 as normal; the runner becomes a cleaner at the next ruck.',
    theory:
      'The blindside flanker is the forward who takes the short pop or inside pass off the first receiver in phase play. From a scrum or ruck on the 5 m line he is bound or on the edge, so the blind winger, with nothing to hold out wide, tucks in beside 9 and runs it (Rugby Slate\'s inside-pop-to-11 moves).',
    reference: { name: 'Dummy Switch 1 – Pop Inside to 11', url: 'https://rugbyslate.com/backs-moves/dummy-switch-1-pop-inside-to-11/' },
    autoVariant: ({ podMode, narrowBlind }) => (podMode === 'hidden' || narrowBlind ? 'wing' : 'flanker'),
    autoNote: '6 runs it with forwards on and a blind for 11 to hold. From the 5 m lanes, or on Backs only, 11 runs it.',
    variants: [
      {
        id: 'flanker',
        label: '6 off 10',
        strike: 6,
        seam: [],
        lateral: [10, 6, 11],
        passes: [first9to10, { from: 10, to: 6, t0: 2.0, t1: 2.3 }],
        routes: base({
          10: INSIDE_BALL_TEN,
          6: INSIDE_RUNNER,
          11: [
            { t: 0, rx: 4, ry: -14 },
            { t: 1.0, rx: 4.5, ry: -12.5 },
            { t: 2.3, rx: 8, ry: -8 },
            { t: 3.3, rx: 10.5, ry: -3 },
            { t: PLAY_DURATION, rx: 11, ry: 10 },
          ],
          12: INSIDE_BALL_OUTSIDE,
          13: INSIDE_BALL_OUTSIDE,
        }),
      },
      {
        id: 'wing',
        label: '11 off 10',
        strike: 11,
        seam: [],
        lateral: [10, 11],
        passes: [first9to10, { from: 10, to: 11, t0: 2.0, t1: 2.3 }],
        routes: base({
          10: INSIDE_BALL_TEN,
          11: INSIDE_RUNNER,
          12: INSIDE_BALL_OUTSIDE,
          13: INSIDE_BALL_OUTSIDE,
        }),
      },
    ],
  },
];
