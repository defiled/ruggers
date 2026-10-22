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
 *
 * Principles every route follows (checked by src/engine/validatePlays.test.ts):
 *   - the strike runner finishes in a SEAM between two defenders (or where a dragged defender
 *     started), never on a man;
 *   - the strike catch is at least 4 m from the nearest defender, 6-8 m against a static line;
 *   - runners run straight unless the line is a deliberate drift or cut, and straighten after the catch.
 */

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
  /** Defending jersey numbers that bound the seam the strike runner finishes in; one number = "where he started". */
  seam: number[];
  /** Runners whose lines are deliberately lateral (drift, loop, cut) and exempt from the steepness check. */
  lateral?: number[];
  /** Minimum dy:dx for the strike runner from 0.5 s to 1.5 s after the catch (default 2.5; a switch cut is sharper). */
  strikeSteepness?: number;
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
  slateDiff: string;
  variants: PlayVariant[];
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
      '9 → 10 (0.5s). 10 carries straight for two or three strides and passes at 1.6s, still 5 m from the defence. 12 takes it 8 m deep, angles in no more than 15°, and straightens through the seam between their 10 and 12 at ~2.8s. 13 holds his width and trails for the offload.',
    read: 'Call it when the defending 12 is drifting early or standing wide of his man: the seam inside him opens. Also the go-to carry to earn a quick ruck in the middle of the field.',
    target: 'The seam between their 10 and their 12. 10 holds their 10; 12 hits the gap on their 12\'s inside shoulder.',
    risk: 'If 12 takes the ball flat and early against a set defender it is a carry into contact with no momentum. He must come from depth, late, and aim at the gap, not the man.',
    fallback: '12 carries square, 13 and the nearest pod clean. Same call next phase off Pod B.',
    theory:
      'Crash ball: a runner from depth hitting a short pass at pace commits two tacklers and gets over the gain line. Keep hips and shoulders square until the pass so no defender can drift; 12 carries in two hands to keep the offload alive.',
    reference: { name: 'Crash 1 – 12', url: 'https://rugbyslate.com/backs-moves/crash-1-12/' },
    slateDiff:
      'Rugby Slate draws it backs-only against a static line: 10 at ~12 m, 12 at ~15 m, the pass 6-8 m out and 12 finishing between their 10 and 12. Ours is the same shape with the forwards present and a defence that comes up; switch the defence to Static to see the Slate picture.',
    variants: [
      {
        id: 'main',
        label: 'Strike 12',
        strike: 12,
        seam: [10, 12],
        passes: [first9to10, { from: 10, to: 12, t0: 1.3, t1: 1.6 }],
        routes: base({
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.9, dx: 0, dy: 0.5 },
            { t: 1.3, dx: -0.3, dy: 1.5 },
            { t: 1.6, dx: -0.6, dy: 2.5 },
            { t: 2.4, dx: -2, dy: 8 },
            { t: 3.0, dx: -2.8, dy: 12 },
            { t: PLAY_DURATION, dx: -3.5, dy: 21 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.2, dx: 0, dy: 1 },
            { t: 2.6, dx: -1, dy: 6 },
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
      '9 → 10 (0.5s). 12 goes early and straight. 13 holds for a second, then runs out-to-in at ~30° behind 12 and takes a flat ball from 10 at 1.7s, 8.5 m deep. He straightens and hits the seam between their 12 and 13 at ~2.8s.',
    read: 'Works when the defending 13 is sitting wide to cover the edge or is slow off the line. If the defence is square and connected the seam is not there: play 12 instead.',
    target: 'The seam between their 12 and their 13.',
    risk: 'The "suicide line" if 12 does not hold his man: 13 runs into two tacklers. 12 must run at the defender, not past him. 10 must pass in front of 12, not through him.',
    fallback: '10 hits 12 front-door, or holds and plays Pod B next phase.',
    theory:
      'Unders line: a runner angling back toward the ball to attack the gap inside a defender who has been fixed by the runner in front. The decoy earns the gap; the strike runner arrives late from depth.',
    reference: { name: 'Crash 2 – 13', url: 'https://rugbyslate.com/backs-moves/crash-2-13/' },
    slateDiff:
      'Same lines as Rugby Slate\'s Crash 13: 10 and 12 straight, 13 cutting in about 30° then straight into the 12/13 seam. We add the forwards and a moving defence, and the pass comes from 10 (miss-12).',
    variants: [
      {
        id: 'main',
        label: 'Strike 13',
        strike: 13,
        seam: [12, 13],
        passes: [first9to10, { from: 10, to: 13, t0: 1.4, t1: 1.7 }],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.4, dx: 0.5, dy: 3.5 },
            { t: 1.7, dx: 0.8, dy: 4.5 },
            { t: PLAY_DURATION, dx: 1.5, dy: 9 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.8, dx: 0, dy: 1 },
            { t: 1.7, dx: 0, dy: 4.5 },
            { t: 3, dx: 0, dy: 9 },
            { t: PLAY_DURATION, dx: 0.5, dy: 14 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: 0, dy: 0.5 },
            { t: 1.4, dx: -1, dy: 2 },
            { t: 1.7, dx: -1.6, dy: 3 },
            { t: 2.6, dx: -3, dy: 8 },
            { t: 3.2, dx: -3.5, dy: 11.5 },
            { t: PLAY_DURATION, dx: -4.5, dy: 20 },
          ],
        }),
      },
    ],
  },
  {
    id: 'bread',
    name: 'Bread & Butter',
    tag: 'Switch · 12, option 13',
    summary: '10 runs out across the line and switches with 12 cutting back inside behind him. 12 finishes where their 10 started. Option: dummy 12 and switch with 13 instead.',
    intent:
      'Change the point of attack against a drifting defence. 10 carries toward touch to drag their 10 across, then hands off to 12 coming back against the grain into the space their 10 has left.',
    sequence:
      '9 → 10 (0.5s). 10 runs forward then angles out at ~30°, ball in two hands. 12 holds his depth, then cuts in behind 10. At 2.0s 10 turns his back to the defence and pops the ball on the far hip; 12 takes it 5 m deep, runs the cut at ~40° for three strides, then straightens into their 10\'s channel. Option 13: 10 dummies the 12 switch, drifts one more step and switches with 13 at 2.6s.',
    read: 'Best when the defence is sliding hard with 10. If their 10 does not follow, keep the ball and play 12 straight instead.',
    target: 'Where their 10 started: the channel he leaves when he follows 10 across.',
    risk: 'Telegraphing the switch, or 10 running so flat he is tackled before the hand-off. Both runners hitting one defender is a wasted play. 12 must straighten or he runs into the folding guards.',
    fallback: '10 keeps and straightens (dummy switch), or the option runner carries and we go again.',
    theory:
      'Switch (scissors): the receiver takes the pass behind the carrier, running the opposite way. The carrier\'s angled run drags defenders; the ball is hidden on the far hip so the defence reads it late. The cut is sharp for a few metres, then the runner straightens so he is still going forward.',
    reference: { name: 'Switch – 10 & 12', url: 'https://rugbyslate.com/backs-moves/switch-10-12/' },
    slateDiff:
      'Matches Rugby Slate\'s Switch 10 & 12: 10 out at ~25-30°, the hand-off 7 m from the line, 12 cutting back at ~45° then straight to where their 10 stood. The 13 option is our addition (a double-switch shape).',
    variants: [
      {
        id: 'opt2',
        label: 'Switch 12',
        strike: 12,
        seam: [10],
        lateral: [10, 12],
        strikeSteepness: 1.5,
        passes: [first9to10, { from: 10, to: 12, t0: 1.7, t1: 2.0 }],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 1.2, dy: 3 },
            { t: 1.7, dx: 3.2, dy: 5 },
            { t: 2.0, dx: 4, dy: 5.5 },
            { t: PLAY_DURATION, dx: 5.5, dy: 8.5 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.8, dx: 0, dy: 0.5 },
            { t: 1.4, dx: -0.2, dy: 2.5 },
            { t: 1.7, dx: -0.6, dy: 4 },
            { t: 2.0, dx: -1, dy: 5.5 },
            { t: 2.6, dx: -3, dy: 8 },
            { t: 3.2, dx: -4.8, dy: 10.5 },
            { t: PLAY_DURATION, dx: -6, dy: 20 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.2, dx: 0, dy: 1 },
            { t: 2.5, dx: -0.5, dy: 5 },
            { t: PLAY_DURATION, dx: -1, dy: 14 },
          ],
        }),
      },
      {
        id: 'opt3',
        label: 'Option 13',
        strike: 13,
        seam: [10, 12],
        lateral: [10, 13],
        strikeSteepness: 1.5,
        passes: [first9to10, { from: 10, to: 13, t0: 2.3, t1: 2.6 }],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 1.2, dy: 3 },
            { t: 1.7, dx: 3.2, dy: 4.5 },
            { t: 2.3, dx: 5.5, dy: 5.2 },
            { t: 2.6, dx: 6.5, dy: 5.5 },
            { t: PLAY_DURATION, dx: 8, dy: 8.5 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.8, dx: 0, dy: 0.5 },
            { t: 1.4, dx: -0.2, dy: 2.5 },
            { t: 1.7, dx: -0.6, dy: 4 },
            { t: 2.0, dx: -1, dy: 5.5 },
            { t: 2.6, dx: -2.5, dy: 9.5 },
            { t: PLAY_DURATION, dx: -4, dy: 17 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: -0.3, dy: 0.5 },
            { t: 1.8, dx: -2, dy: 2.5 },
            { t: 2.3, dx: -4.5, dy: 4.5 },
            { t: 2.6, dx: -6, dy: 6 },
            { t: 3.2, dx: -8, dy: 10 },
            { t: PLAY_DURATION, dx: -9.5, dy: 19 },
          ],
        }),
      },
    ],
  },
  {
    id: 'chopper',
    name: 'Chopper',
    tag: 'Rangy · 13 switch, option 12',
    summary: '10 and 12 go forward then drift across together at ~30°, dragging their two defenders. 13 waits, then runs hard back inside behind both and takes a switch from 10, finishing where their 10 started.',
    intent:
      'Open the seam between the last forward and the defending 10. Because 10 and 12 run together and sideways, their defenders drift with them and the gap on the inside widens for a strong-running 13.',
    sequence:
      '9 → 10 (0.5s). 10 and 12 take two strides forward, then slide across the pitch in unison, 12 two metres outside and a metre behind 10. 13 holds until 1.0s, then runs behind both on a hard line back toward where 10 started and takes the switch from 10 at 2.6s, 5 m deep. He straightens into their 10\'s channel. Option 12: 10 gives to 12 continuing the drift, who straightens.',
    read: 'Outside your own 22, from phase play or a scrum (not a lineout). Call it when the inside defenders are following the backline across and the guards are slow to fold.',
    target: 'Where their 10 started: the seam between the edge of the forwards and the inside edge of their backline once their 10 has followed ours across.',
    risk: 'Common errors: 10 and 12 drifting sideways straight away (they must go forward first), and 13 starting too early so he overruns the pass. 10 must sight 13 earlier than for a normal switch because of the angles.',
    fallback: '10 keeps and straightens, or plays 12 on the drift (option 12).',
    theory:
      'Rangy: a sliding run by 10 with 12 in step, and a late run by 13 behind them. The drift creates the gap; the late, deep start means 13 is at full pace when he takes the switch, which is thrown with 10\'s back to the defence.',
    reference: { name: 'Rangy', url: 'https://rugbyslate.com/backs-moves/rangy/' },
    slateDiff:
      'Rugby Slate\'s Rangy: 10 and 12 drift at ~30°, the switch ~7 m from the line, 13 crossing behind both and finishing exactly where their 10 stood. Ours matches that; with the forwards present the seam sits between our Pod A\'s defenders and their 10, so 13 must stay tight to 10\'s hip.',
    variants: [
      {
        id: 'opt3',
        label: 'Switch 13',
        strike: 13,
        seam: [10],
        lateral: [10, 12, 13],
        passes: [first9to10, { from: 10, to: 13, t0: 2.3, t1: 2.6 }],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 0.5, dy: 3 },
            { t: 2.3, dx: 3, dy: 5 },
            { t: 2.6, dx: 4, dy: 5.5 },
            { t: PLAY_DURATION, dx: 6, dy: 8.5 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 0, dy: 3 },
            { t: 2.3, dx: 0.5, dy: 4.5 },
            { t: 2.6, dx: 1.5, dy: 5 },
            { t: PLAY_DURATION, dx: 3.5, dy: 9 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: -0.3, dy: 0.5 },
            { t: 1.8, dx: -4, dy: 3.5 },
            { t: 2.3, dx: -7.5, dy: 5.5 },
            { t: 2.6, dx: -10, dy: 6.5 },
            { t: 3.4, dx: -13, dy: 12 },
            { t: PLAY_DURATION, dx: -13.8, dy: 20 },
          ],
        }),
      },
      {
        id: 'opt2',
        label: 'Option 12',
        strike: 12,
        seam: [12],
        lateral: [10, 13],
        passes: [first9to10, { from: 10, to: 12, t0: 2.3, t1: 2.6 }],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 0.5, dy: 3 },
            { t: 2.3, dx: 3, dy: 5 },
            { t: 2.6, dx: 4, dy: 5.5 },
            { t: PLAY_DURATION, dx: 6, dy: 8.5 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 0, dy: 3 },
            { t: 2.3, dx: 0.5, dy: 4.5 },
            { t: 2.6, dx: 1, dy: 6 },
            { t: 3.4, dx: 1, dy: 11 },
            { t: PLAY_DURATION, dx: 0.5, dy: 20 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: -0.3, dy: 0.5 },
            { t: 1.8, dx: -4, dy: 3.5 },
            { t: 2.3, dx: -7.5, dy: 5.5 },
            { t: 2.6, dx: -9.5, dy: 6.5 },
            { t: 3.4, dx: -11.8, dy: 10 },
            { t: PLAY_DURATION, dx: -12.5, dy: 16 },
          ],
        }),
      },
    ],
  },
  {
    id: 'overunder',
    name: 'Over / Under',
    tag: '13 under, 12 out the back',
    summary: '13 runs a hard unders line in front of 12 to fix the midfield; 12 plays the ball behind him (out the back) to 15 arriving from depth into the seam outside their 13, with 14 wide as the option.',
    intent:
      'Use the threat of 3 Go to hold the inside defenders, then play around the back of the decoy to a two-on-one on the edge. The defence sees the unders line it has already been hurt by and bites in.',
    sequence:
      '9 → 10 (0.5s) → 12 (1.5s). 13 runs his unders line across in front of 12 at full commitment. 12 runs straight, holds the ball a beat and passes behind 13 at 2.7s to 15, who has come up from depth on a near-straight line into the seam between their 13 and the first edge forward. 15 straightens through it or puts 14 away at 3.6s.',
    read: 'Call it after 3 Go has been run. Needs the edge defender narrow or the fullback held in the backfield. If the defending 13 does not bite on the decoy, 15 carries.',
    target: 'The seam outside their 13 once he has stepped in on the decoy. With their forwards on the edge that is the gap between their 13 and their 7; against backs only it is the gap to their 14.',
    risk: '13 must cross in front of 12 but never block a defender. 12 must hold depth: a flat pass out the back gets intercepted. 15 has to be on the move from the start or he arrives late and static.',
    fallback: 'If the edge is covered 15 straightens and carries, keeping 14 for the next phase or the kick return.',
    theory:
      'Decoy and out-the-back: a hard "under" runner fixes two defenders; the ball travels "over" him, behind the decoy line, to a second-wave runner. The pass must be made with depth so the second wave arrives at pace onto a ball that is already in the air.',
    reference: { name: 'Screen 1', url: 'https://rugbyslate.com/backs-moves/screen-1/' },
    slateDiff:
      'Rugby Slate\'s Screen 1 has 12 and 13 angling in as the screen and 15 running straight up between their 13 and 14 with 14 wide. Ours keeps 12 straight as the passer and uses 13 alone as the screen. With the forwards on the pitch their edge forward stands where that gap would be, so 15 aims for the seam just outside their 13 instead.',
    variants: [
      {
        id: 'main',
        label: 'To the edge',
        strike: 15,
        seam: [13, 7],
        passes: [
          first9to10,
          { from: 10, to: 12, t0: 1.2, t1: 1.5 },
          { from: 12, to: 15, t0: 2.4, t1: 2.7 },
          { from: 15, to: 14, t0: 3.3, t1: 3.6 },
        ],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.2, dx: 0.5, dy: 3 },
            { t: 1.5, dx: 1, dy: 3.8 },
            { t: PLAY_DURATION, dx: 2, dy: 8 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.8, dx: 0, dy: 1 },
            { t: 1.5, dx: 0.5, dy: 3.2 },
            { t: 2.4, dx: 1.5, dy: 5.5 },
            { t: 2.7, dx: 2, dy: 6 },
            { t: PLAY_DURATION, dx: 3, dy: 10 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1.0, dx: 0, dy: 0.5 },
            { t: 1.7, dx: -1.5, dy: 3 },
            { t: 2.5, dx: -3.8, dy: 7 },
            { t: 3.3, dx: -5.5, dy: 10.5 },
            { t: PLAY_DURATION, dx: -6.5, dy: 16 },
          ],
          15: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.8, dx: 0, dy: 1.5 },
            { t: 1.7, dx: -1.5, dy: 5 },
            { t: 2.7, dx: -3, dy: 10.5 },
            { t: 3.3, dx: -4, dy: 13 },
            { t: 3.6, dx: -4.3, dy: 13.8 },
            { t: PLAY_DURATION, dx: -5, dy: 21 },
          ],
          14: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1, dx: 0, dy: 1 },
            { t: 2.8, dx: -1, dy: 3.2 },
            { t: 3.6, dx: -1.5, dy: 4.5 },
            { t: PLAY_DURATION, dx: -2, dy: 15 },
          ],
        }),
      },
    ],
  },
  {
    id: '6go',
    name: '6 Go',
    tag: 'Blind winger inside ball · 11',
    summary: '11 starts 3 m inside and 3 m behind 10. As the backline shapes to go wide he runs up on 10\'s inside and takes a hidden pop into the seam between the last forward and their 10.',
    intent:
      'Punish a defence that drifts with the backline. 11 arrives late and unmarked into the channel between the folding guards and the defending 10, who has turned his shoulders out to follow 10.',
    sequence:
      '9 → 10 (0.5s). 11 goes on the call, runs up behind 10 and arrives a metre inside and two metres behind him at 2.3s. 10 shapes out with the ball in two hands, drags their 10, and pops the inside ball behind his own body. 11 straightens through the seam at ~3s. 12 and 13 run straight as the out-the-back option.',
    read: 'Works when the guards are slow to fold and their 10 has started to drift with ours. Watch the defending 9: if he is sweeping the blind the channel is empty.',
    target: 'The seam between the last defending forward and their 10, opened when their 10 follows ours out.',
    risk: 'If the guards are set and square it is a congested carry. 11 must not arrive early and stand still, or the defence reads it. The pop must be hidden behind 10\'s body.',
    fallback: '10 holds and plays 12 as normal; 11 becomes a cleaner at the next ruck.',
    theory:
      'Inside pop to the winger: the winger roams as an "inside fullback", starting close to 9 and 10 so he can reach the inside channel in time. The pop pass is made behind the carrier\'s back so no defender sees it; the runner needs to be close to the carrier when he takes it.',
    reference: { name: 'Dummy Switch 1 – Pop Inside to 11', url: 'https://rugbyslate.com/backs-moves/dummy-switch-1-pop-inside-to-11/' },
    slateDiff:
      'Both of Rugby Slate\'s inside-pop-to-11 moves start 11 tucked in beside 9, deeper than 10, and finish him in their 10\'s channel. Ours does the same without the dummy switch with 12; against our 1-3-3-1 the seam is between the defender on Pod A and their 10.',
    variants: [
      {
        id: 'main',
        label: 'Inside ball to 11',
        strike: 11,
        seam: [5, 10],
        lateral: [10, 11],
        passes: [first9to10, { from: 10, to: 11, t0: 2.0, t1: 2.3 }],
        routes: base({
          10: [
            { t: 0, dx: 0, dy: 0 },
            { t: 0.7, dx: 0, dy: 1 },
            { t: 1.4, dx: 0.5, dy: 3 },
            { t: 2.0, dx: 1.5, dy: 4.5 },
            { t: 2.3, dx: 2, dy: 5 },
            { t: PLAY_DURATION, dx: 3, dy: 9 },
          ],
          11: [
            { t: 0, rx: 9, ry: -12 },
            { t: 0.8, rx: 9.5, ry: -10.5 },
            { t: 1.6, rx: 11.5, ry: -8 },
            { t: 2.3, rx: 12.5, ry: -6 },
            { t: 3.3, rx: 12.2, ry: 0 },
            { t: PLAY_DURATION, rx: 12, ry: 14 },
          ],
          12: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1, dx: 0, dy: 1 },
            { t: 2.3, dx: 1, dy: 5 },
            { t: PLAY_DURATION, dx: 2, dy: 14 },
          ],
          13: [
            { t: 0, dx: 0, dy: 0 },
            { t: 1, dx: 0, dy: 1 },
            { t: 2.3, dx: 1, dy: 5 },
            { t: PLAY_DURATION, dx: 2, dy: 14 },
          ],
        }),
      },
    ],
  },
];
