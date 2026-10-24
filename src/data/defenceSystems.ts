/**
 * Defensive systems: what they are, how they work, when to use them, and why.
 * Content follows the common coached versions (Rugby Slate's defending series and
 * the usual drift/blitz coaching points), written for our team.
 */

export type DefenceSystemId = 'drift' | 'blitz' | 'pendulum' | 'shooter' | 'dogleg';
export type Alignment = 'deep' | 'standard' | 'flat';

export interface Caption {
  t: number;
  text: string;
}

export interface DefenceSystem {
  id: DefenceSystemId;
  name: string;
  tag: string;
  summary: string;
  how: string[];
  trigger: string;
  when: string[];
  why: string;
  strengths: string[];
  weaknesses: string[];
  beats: string[];
  errors: string[];
  coaching: string[];
  captions: Caption[];
  source: string;
}

export const ALIGNMENT_LABEL: Record<Alignment, string> = {
  deep: 'Deep attack',
  standard: 'Standard',
  flat: 'Flat attack',
};

export const DEFENCE_SYSTEMS: DefenceSystem[] = [
  {
    id: 'drift',
    name: 'Drift',
    tag: 'Up and out, use the touchline',
    summary:
      'Up and out. Three defenders against five attackers. The line comes up under control, and each time the ball is passed every defender it has gone past pushes one man out: 10\'s marker takes 12, 12\'s takes 13, 13\'s takes 14. The spare attacker is pushed to the touchline, the defender who never misses a tackle.',
    how: [
      'Close the space first: come up as a line on the trigger, under control. You are not racing to the tackle.',
      'As the ball is passed, push out onto the next receiver. The inside man takes the next attacker out, all the way along the line.',
      'Nobody commits to a tackle unless he has to. A deep attack that passes early gives you the time to slide.',
      'Shepherd them wide and squeeze them against the touchline. Make the tackle on the edge or let the touchline make it.',
      'Talk the whole way: who has who. The drift is only as good as its weakest man.',
    ],
    trigger: 'Ball leaves 9\'s hands; the slide starts the moment the ball is passed again.',
    when: [
      'A small overlap (one or two extra attackers) that needs two or three passes to use. The slide takes the space away faster than they can move the ball.',
      'The attack is flat and wide: a rush would be beaten by the pass, a slide covers it.',
      'In your own half with space to give and a line break would be dangerous: contain, no missed tackles.',
      'Against strong direct runners: make them run sideways instead of straight.',
      'Protecting a lead late in the game, or when your tacklers lack explosive pace.',
    ],
    why:
      'When the attack has more men than you, you cannot mark every player. A drifting line uses the touchline to do it for you: every pass the attack throws moves them closer to the edge of the pitch, and every defender who slides out arrives at the same time as the ball. The inside defenders are not wasted either: they fold across to cover the receiver, so the overlap is absorbed one pass at a time. It does not win the ball back like a blitz, but it makes the attack predictable and forces them to beat you with the pass, not the gap.',
    strengths: [
      'Absorbs a numerical disadvantage with positioning instead of a gamble.',
      'Nobody has to commit early; defenders react rather than guess.',
      'Pushes the attack sideways and toward touch, tiring their forwards.',
      'Forgiving: a slow defender is covered by the man inside him.',
    ],
    weaknesses: [
      'Gives the attack the gain line: the carrier is usually tackled on or over it, not behind it.',
      'A line that drifts early leaves the inside seam open for the cut-back, the switch and the inside ball.',
      'Needs constant communication on hand-offs; one missed call is a gap in the midfield.',
      'Only as good as its weakest man: one defender who stops sliding breaks the chain.',
    ],
    beats: [
      'Come back against the grain: the switch, the inside ball to the blind winger, the unders line.',
      'Hard straight runners who fix a defender before the drift starts.',
      'Quick inside-out passing with runners taking the ball deep and at pace, so the sliding defender is beaten on the inside.',
    ],
    errors: [
      'Drifting before the ball is passed: the carrier straightens into the space you left.',
      'A defender who does not trust the man inside him commits to the carrier and leaves his outside attacker free.',
      'Losing the line: one man rushing or lagging turns the slide into a dog-leg.',
      'No calls on the hand-off, so two defenders take one attacker.',
    ],
    coaching: [
      '"Up and out": up first, then out. Never out first.',
      'Hips, not ball. Slide when the carrier\'s hips turn to pass.',
      'Trust inside: the man inside you has the inside runner. Your job is the next man out.',
      'Talk: "mine / yours / push" all the way to the touchline.',
    ],
    captions: [
      { t: 0, text: 'Set: three defenders against five attackers. Flat line, inside shoulders.' },
      { t: 0.3, text: 'Up on the trigger, under control: close the space, do not race.' },
      { t: 1.2, text: 'Ball past you: push out to the next man. 10\'s marker takes 12.' },
      { t: 2.1, text: 'Ball past the next man: everyone outside slides with it. Nobody has committed early.' },
      { t: 3.2, text: 'Squeezed to the edge: 13\'s marker arrives with the ball on 14. Make the tackle, or let the touchline make it.' },
    ],
    source: 'https://rugbyslate.com/defending/the-drift-defence/',
  },
  {
    id: 'blitz',
    name: 'Blitz',
    tag: 'Up together, fast and flat',
    summary:
      'Everyone lines up opposite an attacker and comes up hard as one flat line on the trigger. The aim is to take away the attack\'s time and space and make the tackle behind the gain line, on the first receivers.',
    how: [
      'Set a flat line a metre behind the offside line, each defender on the inside shoulder of the attacker opposite him.',
      'Trigger: the ball leaves 9\'s hands. Everyone goes together, at the speed of the slowest man. Nobody ahead, nobody behind.',
      'Eyes on the ball carrier\'s hips. Close to within a metre, then make your own tackle. You are responsible for your man.',
      'Force contact on 10, 12 or 13 behind the gain line. Win the collision, then compete for the ball or reload.',
      '9 sweeps behind the line for the short kick or the break; 15 holds the backfield.',
    ],
    trigger: 'Ball leaves 9\'s hands. One cue, one line.',
    when: [
      'The attack is standing deep. The deeper they align, the more ground you can eat before the ball reaches them, and the further behind the gain line they take contact.',
      'They have a big overlap and you cannot afford the ball to reach the edge: shut it down at the first or second receiver.',
      'A dangerous wide threat (quick or strong winger) you do not want to see the ball.',
      'A fly-half who needs time: take it away from him.',
      'Inside your own 22 and on your try line: nothing can be allowed over the gain line, so go hard and keep every number in the line.',
      'Your strength is tight, physical defence and your tacklers are reliable one-on-one.',
    ],
    why:
      'Rugby is a game of time and space. A deep attack has bought itself time to pass and run onto the ball, but it has paid for it with distance from the gain line. If the line comes up fast and together, that distance is where the tackle happens: receivers take the ball standing still, well behind the gain line, with a tackler already on them. The short inside ball cannot punish you because the inside runners are too far away to hit it at pace. Coming up together is the whole system. Any man a step ahead or a step behind opens a gap on each side of him, and a flat attack with a short pass will find it in one phase.',
    strengths: [
      'Kills overlaps early: the ball never gets to the space.',
      'Forces contact on 10, 12 and 13, usually behind the gain line.',
      'Dominant collisions create turnovers, slow ball and penalties for the attack.',
      'Chasing a game? This is the system that wins the ball back.',
    ],
    weaknesses: [
      'Every tackle is one-on-one under pressure. One missed tackle and there is no cover coming forward.',
      'Defenders have less time to read the attack, so decoys and late runners are harder to pick up.',
      'A rushing line is hard to turn: a chip, grubber or cross-kick in behind has the backfield exposed.',
      'Tiring. Across a whole match it costs energy and discipline.',
    ],
    beats: [
      'Play flat and early so the ball is past the rush before it arrives.',
      'Short ball into the seam beside any defender who is a fraction fast or slow (the dog-leg).',
      'Kick in behind the rush: chip, grubber, cross-field.',
      'Win the one-on-one: footwork or a big carrier breaking the first tackle, with support outside.',
    ],
    errors: [
      'One man shoots and the line follows late: two gaps, one line break.',
      'One man hangs back: the carrier steps into the hole beside him.',
      'Going on the wrong trigger (the pass to 10 instead of the ball leaving 9) and arriving late and flat-footed.',
      'Blitzing a flat attack that is already on the gain line: you are rushing into contact you cannot win.',
    ],
    coaching: [
      '"Together" is the call. The line is only ever as fast as its slowest man.',
      'Inside shoulder, hips, then tackle. Do not watch the ball.',
      'The call comes from the outside in: the wingers and 13 see the numbers and call "blitz" or "drift" before 9 picks up.',
      'Communicate the hand-off when a decoy crosses: "mine / yours".',
    ],
    captions: [
      { t: 0, text: 'Set: a flat line a metre off the offside line, each man on an attacker. 9 sweeps, 15 holds the backfield.' },
      { t: 0.3, text: 'Trigger: ball leaves 9\'s hands. Everyone goes together, at the speed of the slowest.' },
      { t: 1.2, text: 'The line stays flat: nobody ahead, nobody behind. Eyes on hips. Each man owns his tackle.' },
      { t: 2.2, text: 'Contact is forced on the first receivers behind the gain line. The ball never reaches the edge.' },
      { t: 3.4, text: 'Reload: win the collision, compete or get back onside, reset flat and go again on the next trigger.' },
    ],
    source: 'https://rugbyslate.com/defending/the-blitz-defence/',
  },
  {
    id: 'pendulum',
    name: 'Pendulum',
    tag: 'Back three swing with the ball',
    summary:
      'Only the back three, as Rugby Slate draws it. Ball on one side: that winger is up to the line marking his man, 15 is across behind him, and the far winger has dropped toward the middle. When the ball goes the other way the whole shape swings with it.',
    how: [
      'Ball on your side: come up and join the line to mark their winger.',
      'That leaves the space behind you, where a kick would hurt. 15 shifts across to cover it.',
      'That leaves the middle. The far winger drops back and across to cover it.',
      'Ball goes the other way: swing. The far winger comes up, 15 slides back across, the near winger drops.',
      'If a back-three man is caught in a ruck, 9 or 10 takes his spot in the pendulum.',
    ],
    trigger: 'Where the ball is. Each pass across the field moves the pendulum one step.',
    when: [
      'Whenever the back three are in their normal backfield role in phase play.',
      'Against teams that kick: chips, grubbers, cross-kicks and box kicks all land in the pendulum\'s cover.',
      'Behind a blitz, where a line break or a kick in behind is the main threat.',
      'If a back-three player is caught in the line or in a ruck, 9 or 10 fills the pendulum for him.',
    ],
    why:
      'A defensive line, however good, can be beaten by a kick or a break. The pendulum is the insurance: whatever happens in front, there is always one man covering the space behind the near winger, one in the middle, and one on the far side. It costs nothing in the front line because the near winger joins it, and it means the fullback is never isolated on one side when the attack switches play.',
    strengths: [
      'Covers kicks in behind on both edges and in the middle.',
      'Always a sweeper for the line break.',
      'The near winger is in the line, so the attack never has a free man on the edge.',
      'Simple rule everyone can learn: come up, slide across, drop back.',
    ],
    weaknesses: [
      'Slow to swing if the attack moves the ball quickly from one side to the other.',
      'Three players must all move for it to work: one who stays put leaves a hole.',
      'The far winger is out of the line, so the blind side can be short-handed.',
    ],
    beats: [
      'Fast ball from one edge to the other before the pendulum has swung.',
      'A kick into the space the fullback has just left, before the far winger gets there.',
      'Attacking the short side when the far winger has dropped too deep.',
    ],
    errors: [
      'Near winger too flat: he is neither in the line nor covering the kick.',
      'Near winger does not come up into the line, leaving their winger unmarked.',
      'Fullback does not shift across: the chip behind the near winger lands in open grass.',
      'Far winger does not cover the middle: the kick down the centre has nobody home.',
    ],
    coaching: [
      '"Up, across, back": near winger up, fullback across, far winger back.',
      'Talk from the back: 15 runs the pendulum and calls the wingers.',
      'Never both wingers in the line at the same time unless 15 and 9 are covering.',
    ],
    captions: [
      { t: 0, text: 'Set: three men cover the whole backfield, joined by the pendulum.' },
      { t: 0.3, text: 'Ball goes open: the near winger comes up to a stride behind the line, never through it.' },
      { t: 1.3, text: '15 slides across behind him to cover the kick in behind. The far winger drops toward the middle.' },
      { t: 2.4, text: 'Ball comes back: the pendulum swings. The far winger comes up, 15 goes back across.' },
      { t: 4.0, text: 'Blind winger up, 15 behind him, open winger deep in the middle. Nobody is ever uncovered.' },
    ],
    source: 'https://rugbyslate.com/defending/back-three-defence-pendulum/',
  },
  {
    id: 'shooter',
    name: 'Shooter',
    tag: '12 shoots on the pass',
    summary:
      'An aggressive cousin of the blitz. As their 10 passes to 12, our 12 shoots out of the line and hits him as he catches, well behind the gain line. 10 and 13 keep coming and fold in to fill his channel; 9 lives behind him. Only for an experienced, well-drilled team.',
    how: [
      'Read who the ball is going to next. The man opposite him is the shooter; here it is our 12 reading their 10 → 12 pass.',
      'The shooter goes as the passer\'s hips turn, hard and straight at the receiver, to hit him as he catches.',
      'The defenders either side come up under control and fold slightly in to fill the channel he left.',
      '9 sweeps the space behind the shooter for the snipe and the offload.',
      'Everyone else keeps coming forward so the ruck is met on the front foot.',
    ],
    trigger: 'The passer\'s hips turn: the shooter goes a beat before the ball does.',
    when: [
      'Only for an experienced, well-drilled team that already runs a good blitz.',
      'When the defence is in a strong position and wants to turn pressure into a turnover.',
      'Against a fly-half who stands deep and takes time on the ball.',
    ],
    why:
      'If the first receiver is hit before he can pass, the attack\'s whole shape dies behind the gain line and the ball is often there to be won. The cost is the gap the shooter leaves: the system only works if the men around him and the sweeper close it before the attack can use it.',
    strengths: [
      'Tackles made five metres behind the gain line.',
      'Turnovers and slow ball at the breakdown.',
      'Momentum: the attack starts going backwards.',
    ],
    weaknesses: [
      'A missed tackle by the shooter opens a big hole with nobody in it.',
      'An offload out of the shooter\'s tackle finds the gap.',
      'A quick 9 can snipe into the space before the cover arrives.',
    ],
    beats: [
      'Offload close to contact.',
      '9 taking the ball on himself into the hole behind the shooter.',
      'A flat pass away from the shooter before he arrives.',
    ],
    errors: [
      'Shooting when the rest of the line is not ready to cover.',
      'Shooting at a decoy instead of the receiver.',
      'Not knowing when to shoot and when to just blitz or drift.',
    ],
    coaching: [
      'Shooter decides early and commits; a half-shoot is the worst of both.',
      'The two men either side own the hole: "cover" is their call.',
      '9 lives behind the shooter.',
    ],
    captions: [
      { t: 0, text: 'Set: a flat line, 9 behind it. Our 12 is the shooter, opposite their 12.' },
      { t: 0.3, text: '9 to 10. The line comes up under control; the shooter waits for 10\'s hips.' },
      { t: 1.0, text: 'Their 10 turns to pass: our 12 shoots, straight at their 12.' },
      { t: 1.9, text: 'Hit as he catches, 5 m behind the gain line. 10 and 13 fold in, 9 covers behind.' },
      { t: 3.0, text: 'Risk: a missed tackle, an offload, or a 9 snipe into the hole behind the shooter.' },
    ],
    source: 'https://rugbyslate.com/defending/shooter-defence/',
  },
  {
    id: 'dogleg',
    name: 'Dog-leg',
    tag: 'What goes wrong when the line is not together',
    summary:
      'Not a system: the mistake every system is built to avoid. One defender comes up slower (or faster) than the men beside him, the flat line kinks, and a gap opens on either side of him that a straight runner goes through.',
    how: [
      'The line goes on the trigger, but one man is late off the line (here, the defender opposite 12).',
      'The men either side keep coming: the line now has a kink, with a gap on each side of the slow man.',
      'The attack sees it and hits a straight runner into the seam.',
      'Even if the slow man makes a tackle, it is behind his line: the men ahead of him are offside at the ruck and have to retreat, so there is nobody to compete for the ball.',
    ],
    trigger: 'Any time one man moves at a different speed from the line.',
    when: ['Never on purpose. This scenario is here so everyone can see what the attack sees.'],
    why:
      'A flat line has no gaps because every defender is level with the men beside him and each one owns a channel. The moment one man is out of the line, two channels open and the attack only needs one. It is why "the line goes at the speed of the slowest player" is the first rule of every defensive system, blitz or drift.',
    strengths: [],
    weaknesses: [
      'A gap on both sides of the slow (or fast) defender.',
      'Tackles made behind the line put the rest of the defence offside.',
      'Quick ball for the attack at the next breakdown.',
    ],
    beats: ['A straight runner into either seam. The 2 Go crash ball is exactly this.'],
    errors: [
      'A tired or late forward not getting back into the line.',
      'A defender over-reading the play and shooting on his own.',
      'Someone watching the ball instead of the men beside him.',
    ],
    coaching: [
      'Go at the speed of the slowest man, every phase.',
      'Check your shoulders: level with the man inside and the man outside.',
      'If you are late, say so: the men either side can close down until you are back.',
    ],
    captions: [
      { t: 0, text: 'Set: a flat line, everyone level.' },
      { t: 0.3, text: 'Trigger. The line goes, but the defender opposite 12 is late off the line.' },
      { t: 1.2, text: 'The men beside him keep coming. The line kinks: two gaps, inside and outside the slow man.' },
      { t: 1.8, text: '10 hits 12. He sees both options and takes the inside gap. One late man, one line break.' },
      { t: 3.0, text: 'Even a tackle here is behind the line: the men in front are offside and must retreat. Quick ball for the attack.' },
    ],
    source: 'https://rugbyslate.com/defending/defencive-flat-lines-dog-legs/',
  },
];

/** How to choose: what we see in the attack, what we call, and why. The call comes from the outside in. */
export const READ_THE_ATTACK: Array<{ see: string; call: string; because: string }> = [
  {
    see: 'They are standing deep.',
    call: 'Blitz',
    because: 'The deeper they are, the more ground we can take before the ball arrives. They take contact behind the gain line, standing still.',
  },
  {
    see: 'They are flat and wide, ball moving early.',
    call: 'Drift',
    because: 'A rush gets beaten by the pass. A slide arrives with the ball and uses the touchline.',
  },
  {
    see: 'They have one or two spare men.',
    call: 'Drift',
    because: 'The touchline is the sixteenth defender. Two or three passes to use the overlap is two or three slides to cover it.',
  },
  {
    see: 'They have a big overlap, or a winger we must not let touch the ball.',
    call: 'Blitz',
    because: 'Shut it down at 10 or 12 before the ball can get to the space.',
  },
  {
    see: 'Their 10 wants time on the ball.',
    call: 'Blitz (or shoot)',
    because: 'Take the time away. Make him play under pressure or kick.',
  },
  {
    see: 'Strong, direct runners coming at us.',
    call: 'Drift',
    because: 'Make them run sideways. Do not give them the straight collision they want.',
  },
  {
    see: 'We are on our own try line.',
    call: 'Blitz',
    because: 'Nothing over the gain line. Every number in the line, 9 and 15 sweep.',
  },
];

/** Where on the pitch we are, and the posture that fits it. */
export const PITCH_SECTIONS: Array<{ where: string; posture: string; why: string }> = [
  {
    where: 'Their 22 to their try line',
    posture: 'Pressure the kicker; charge-down line speed; back three stay at range to counter-attack.',
    why: 'They will try to kick to touch. Any mistake we force is a scoring chance. Discipline: a penalty releases all the pressure.',
  },
  {
    where: 'Their 22 to halfway',
    posture: 'No full-field blitz. Close the channels either side of the ruck, keep the line simple and connected.',
    why: 'A blitz here is tiring and costly. They cannot kick straight to touch, so the back three and 9 cover the up-and-under and the long kick instead.',
  },
  {
    where: 'Halfway to our 22',
    posture: 'Drift as the default. Blitz when they have an overlap.',
    why: 'Line breaks here become tries. No missed tackles. Expect grubbers and kicks to the corners; call the mark inside the 22.',
  },
  {
    where: 'Our 22 to our try line',
    posture: 'Blitz. Quick off the line, every number in the line, stay out of rucks we cannot win. 15 and 9 sweep for the grubber.',
    why: 'Anything through the line is a try. Penalties here are three points or a five-metre lineout, so be hard and be legal.',
  },
];
