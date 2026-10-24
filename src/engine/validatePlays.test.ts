import { describe, expect, it } from 'vitest';
import { BOARD_H, BOARD_W, PX_PER_M_X, PX_PER_M_Y } from '../board/constants';
import type { DefenceMode, LaneId, OpenSide } from '../board/types';
import { acrossScale, defaultOpenSide, phaseGeometry, phaseLayout } from '../data/phaseFormation';
import { LANES } from '../data/scrumSetups';
import { PLAYS, PLAY_DURATION } from '../data/plays';
import { TRACK_LAG, ballAt, buildPlay, defenceAt, positionAt, seamFor } from './animate';

/**
 * Every play, in every lane and both directions, must obey the coaching principles:
 *  - no forward passes (receiver level with or behind the passer at the catch);
 *  - every catch at least 2.5 m behind the nearest front-line defender, and the strike catch
 *    at least 4 m (drift and static defence);
 *  - the strike runner finishes in the declared seam (within 2 m of it when he crosses the gain line);
 *  - the strike runner is steep from 0.5 s to 1.5 s after the catch, approach lines angle no more
 *    than ~35° off straight unless declared lateral;
 *  - nobody runs off the board;
 *  - the defence stands man-on-man: their 10/12/13/14 opposite ours.
 */

const lanes = LANES.map((l) => l.id as LaneId);
const sides: OpenSide[] = ['left', 'right'];

/** Attackers at time t, from the built layout (a variant may have shifted a man's set position). */
function attackersAt(built: ReturnType<typeof buildPlay>, t: number) {
  return built.layout.players
    .filter((p) => p.team === 'attack')
    .map((p) => ({ ...p, ...positionAt(built.routes[p.id], t) }));
}

describe('phase defence alignment', () => {
  for (const lane of lanes) {
    for (const openSide of sides) {
      it(`${lane} ${openSide}: their 10, 12, 13 and 14 stand opposite ours`, () => {
        const layout = phaseLayout({ lane, row: 'halfway', openSide, podMode: 'pods', defenceMode: 'drift' });
        for (const n of [10, 12, 13, 14]) {
          const a = layout.players.find((p) => p.team === 'attack' && p.number === n)!;
          const d = layout.players.find((p) => p.team === 'defence' && p.number === n)!;
          expect(Math.abs(a.x - d.x) / PX_PER_M_X, `${lane} ${openSide}: D${n} not opposite A${n}`).toBeLessThan(1);
        }
      });
    }
  }
});

describe('backs only', () => {
  it('takes the defending forwards off too, leaving their 9 to 15', () => {
    const layout = phaseLayout({ lane: 'left15', row: 'halfway', openSide: 'right', podMode: 'hidden', defenceMode: 'static' });
    const defence = layout.players.filter((p) => p.team === 'defence').map((p) => p.number).sort((a, b) => a - b);
    expect(defence).toEqual([9, 10, 11, 12, 13, 14, 15]);
    expect(layout.players.filter((p) => p.team === 'attack').every((p) => p.number >= 9)).toBe(true);
  });
});

describe('man marking', () => {
  it('a defender shadows his man: our 10 drifting out drags their 10 with him', () => {
    const layout = phaseLayout({ lane: 'left15', row: 'halfway', openSide: 'right', podMode: 'hidden', defenceMode: 'static' });
    const our10 = layout.players.find((p) => p.team === 'attack' && p.number === 10)!;
    const their10 = layout.players.find((p) => p.team === 'defence' && p.number === 10)!;
    const moved = [{ ...our10, x: our10.x + 5 * PX_PER_M_X }];
    const after = defenceAt(layout, 'static', 1, 1, layout.ball, moved).find((d) => d.number === 10)!;
    expect((after.x - their10.x) / PX_PER_M_X).toBeCloseTo(3.5, 1);
  });

  it('a straight runner holds his defender in his lane', () => {
    const layout = phaseLayout({ lane: 'left15', row: 'halfway', openSide: 'right', podMode: 'hidden', defenceMode: 'drift' });
    const our12 = layout.players.find((p) => p.team === 'attack' && p.number === 12)!;
    const their12 = layout.players.find((p) => p.team === 'defence' && p.number === 12)!;
    const after = defenceAt(layout, 'drift', 1, 2, layout.ball, [{ ...our12, y: our12.y - 4 * PX_PER_M_Y }]).find((d) => d.number === 12)!;
    expect(Math.abs(after.x - their12.x) / PX_PER_M_X).toBeLessThan(0.1);
  });
});

describe('play library', () => {
  for (const play of PLAYS) {
    for (const variant of play.variants) {
      for (const lane of lanes) {
        for (const openSide of sides) {
          const label = `${play.name} / ${variant.label} @ ${lane} ${openSide}`;
          const dir: 1 | -1 = openSide === 'right' ? 1 : -1;
          const layout = phaseLayout({ lane, row: 'halfway', openSide, podMode: 'pods', defenceMode: 'drift' });
          const built = buildPlay(layout, variant, dir, acrossScale(phaseGeometry(lane, 'halfway', openSide)));
          const strikePass = variant.passes.find((p) => p.to === variant.strike);

          for (const mode of ['drift', 'static'] as DefenceMode[]) {
            it(`${label} vs ${mode}: passes are backward and caught behind the defence`, () => {
              for (const pass of variant.passes) {
                const at = attackersAt(built, pass.t1);
                const from = at.find((p) => p.number === pass.from)!;
                const to = at.find((p) => p.number === pass.to)!;
                // y grows toward our own try line, so "behind" means to.y >= from.y
                expect(to.y, `${label}: ${pass.from}→${pass.to} is forward`).toBeGreaterThanOrEqual(from.y - 0.5 * PX_PER_M_Y);
                const ball = ballAt(built, Object.fromEntries(at.map((p) => [p.id, p])), pass.t1);
                const defence = defenceAt(built.layout, mode, dir, pass.t1, ball.pos, at, attackersAt(built, Math.max(0, pass.t1 - TRACK_LAG)), built.routes);
                const nearest = defence
                  .filter((d) => d.number !== 15 && d.number !== 9 && Math.abs(d.x - to.x) < 6 * PX_PER_M_X)
                  .reduce((best, d) => Math.max(best, d.y), -Infinity);
                const gapM = (to.y - nearest) / PX_PER_M_Y;
                const need = pass === strikePass ? 4 : 2.5;
                expect(gapM, `${label} vs ${mode}: ${pass.to} catches only ${gapM.toFixed(1)} m from the line`).toBeGreaterThanOrEqual(need);
              }
            });
          }

          it(`${label}: strike runner finishes in the seam`, () => {
            if (variant.seam.length === 0) return; // no seam declared for this call (6 Go)
            const seam = seamFor(built);
            expect(seam, `${label}: no seam declared`).toBeTruthy();
            const frames = built.routes[`attack-${variant.strike}`];
            const ruckY = layout.ball.y;
            let crossing: { x: number; y: number } | null = null;
            for (let t = 0; t <= PLAY_DURATION; t += 0.05) {
              const p = positionAt(frames, t);
              if (p.y <= ruckY) {
                crossing = p;
                break;
              }
            }
            expect(crossing, `${label}: strike runner never reaches the gain line`).toBeTruthy();
            const offM = Math.abs(crossing!.x - seam!.point.x) / PX_PER_M_X;
            expect(offM, `${label}: crosses the gain line ${offM.toFixed(1)} m from the seam (${seam!.label})`).toBeLessThanOrEqual(2);
          });

          it(`${label}: strike runner is steep after the catch`, () => {
            if (!strikePass) return;
            const frames = built.routes[`attack-${variant.strike}`];
            const a = positionAt(frames, strikePass.t1 + 0.5);
            const b = positionAt(frames, Math.min(PLAY_DURATION, strikePass.t1 + 1.5));
            const dxM = Math.abs(b.x - a.x) / PX_PER_M_X;
            const dyM = (a.y - b.y) / PX_PER_M_Y;
            const need = variant.strikeSteepness ?? 2.5;
            expect(dyM, `${label}: strike runner not going forward`).toBeGreaterThan(2);
            expect(dyM / Math.max(dxM, 0.01), `${label}: strike line too lateral (${dyM.toFixed(1)} up / ${dxM.toFixed(1)} across)`).toBeGreaterThanOrEqual(need);
          });

          it(`${label}: non-lateral runners are steep`, () => {
            const exempt = new Set([9, ...(variant.lateral ?? [])]);
            for (const [num, kfs] of Object.entries(variant.routes)) {
              const n = Number(num);
              if (exempt.has(n)) continue;
              for (let i = 1; i < kfs.length; i++) {
                const a = kfs[i - 1];
                const b = kfs[i];
                if ('rx' in a || 'rx' in b) continue;
                const dx = Math.abs(b.dx - a.dx);
                const dy = b.dy - a.dy;
                if (dy < 1) continue; // holding / settling steps
                // Approach segments of a cut may angle in at up to ~35°; the strike line after the catch is checked above.
                expect(dy / Math.max(dx, 0.01), `${label}: ${n} segment ${a.t}-${b.t}s too lateral`).toBeGreaterThanOrEqual(1.5);
              }
            }
          });

          it(`${label}: nobody leaves the board`, () => {
            for (let t = 0; t <= PLAY_DURATION; t += 0.5) {
              for (const p of attackersAt(built, t)) {
                expect(p.x).toBeGreaterThanOrEqual(0);
                expect(p.x).toBeLessThanOrEqual(BOARD_W);
                expect(p.y).toBeGreaterThanOrEqual(0);
                expect(p.y).toBeLessThanOrEqual(BOARD_H);
              }
            }
          });
        }
      }
    }
  }

  it('Over / Under: the decoy 13 runs the 3 Go line into the 12/13 seam, then turns out in support', () => {
    const over = PLAYS.find((p) => p.id === 'overunder')!;
    const three = PLAYS.find((p) => p.id === '3go')!;
    const decoy = over.variants[0].routes[13];
    const unders = three.variants[0].routes[13];
    // Identical to the 3 Go line until he has crossed the gain line (3.2 s) ...
    expect(decoy.filter((k) => k.t <= 3.2)).toEqual(unders.filter((k) => k.t <= 3.2));
    // ... then works out toward 15 and 14 instead of running on.
    const last = decoy[decoy.length - 1] as { dx: number; dy: number };
    const at32 = decoy.find((k) => k.t === 3.2) as { dx: number; dy: number };
    expect(last.dx).toBeGreaterThan(at32.dx + 5);
    expect(last.dy - at32.dy).toBeLessThan(8);
    const layout = phaseLayout({ lane: 'left15', row: 'halfway', openSide: 'right', podMode: 'pods', defenceMode: 'static' });
    const built = buildPlay(layout, over.variants[0], 1, acrossScale(phaseGeometry('left15', 'halfway', 'right')));
    const frames = built.routes['attack-13'];
    let crossing: { x: number; y: number } | null = null;
    for (let t = 0; t <= PLAY_DURATION; t += 0.05) {
      const p = positionAt(frames, t);
      if (p.y <= layout.ball.y) {
        crossing = p;
        break;
      }
    }
    const d12 = layout.players.find((p) => p.team === 'defence' && p.number === 12)!;
    const d13 = layout.players.find((p) => p.team === 'defence' && p.number === 13)!;
    expect(Math.abs(crossing!.x - (d12.x + d13.x) / 2) / PX_PER_M_X).toBeLessThanOrEqual(2);
  });

  it('Over / Under: every pass after 9 is 8 m or shorter', () => {
    const over = PLAYS.find((p) => p.id === 'overunder')!;
    for (const lane of lanes) {
      const openSide = defaultOpenSide(lane);
      const dir: 1 | -1 = openSide === 'right' ? 1 : -1;
      const layout = phaseLayout({ lane, row: 'halfway', openSide, podMode: 'hidden', defenceMode: 'static' });
      const built = buildPlay(layout, over.variants[0], dir, acrossScale(phaseGeometry(lane, 'halfway', openSide)));
      for (const pass of over.variants[0].passes.filter((p) => p.from !== 9)) {
        const at = attackersAt(built, pass.t1);
        const from = at.find((p) => p.number === pass.from)!;
        const to = at.find((p) => p.number === pass.to)!;
        const m = Math.hypot((from.x - to.x) / PX_PER_M_X, (from.y - to.y) / PX_PER_M_Y);
        expect(m, `${lane}: ${pass.from}→${pass.to} is ${m.toFixed(1)} m`).toBeLessThanOrEqual(8);
      }
    }
  });

  it('Bread & Butter: pop 13 shows the same 10/12 switch picture as switch 12 until the hand-off', () => {
    const bread = PLAYS.find((p) => p.id === 'bread')!;
    const sw = bread.variants.find((v) => v.id === 'opt2')!;
    const pop = bread.variants.find((v) => v.id === 'pop13')!;
    expect(pop.routes[12]).toEqual(sw.routes[12]);
    expect(pop.routes[10].filter((k) => k.t <= 2.0)).toEqual(sw.routes[10].filter((k) => k.t <= 2.0));
  });

  it('alternating plays set up identically for every option, so the picture does not jump between runs', () => {
    const layout = phaseLayout({ lane: 'left15', row: 'halfway', openSide: 'right', podMode: 'pods', defenceMode: 'static' });
    const k = acrossScale(phaseGeometry('left15', 'halfway', 'right'));
    const alternating = PLAYS.filter((p) => p.alternate);
    expect(alternating.map((p) => p.id).sort()).toEqual(['bread', 'chopper']);
    for (const play of alternating) {
      expect(play.variants.length).toBeGreaterThan(1);
      const sets = play.variants.map((v) => attackersAt(buildPlay(layout, v, 1, k), 0).map((p) => [p.id, Math.round(p.x), Math.round(p.y)]));
      for (const s of sets.slice(1)) expect(s, `${play.name}: options set up differently`).toEqual(sets[0]);
    }
  });

  it('3 Go and Over / Under: 13 sets 2.5 m tighter and runs the same crash line, 10 to 13 is a shorter pass', () => {
    const three = PLAYS.find((p) => p.id === '3go')!.variants[0];
    const over = PLAYS.find((p) => p.id === 'overunder')!.variants[0];
    const layout = phaseLayout({ lane: 'left15', row: 'halfway', openSide: 'right', podMode: 'pods', defenceMode: 'static' });
    const k = acrossScale(phaseGeometry('left15', 'halfway', 'right'));
    const a = buildPlay(layout, three, 1, k);
    const b = buildPlay(layout, over, 1, k);
    const std13 = layout.players.find((p) => p.team === 'attack' && p.number === 13)!;
    const set13 = a.layout.players.find((p) => p.team === 'attack' && p.number === 13)!;
    expect((std13.x - set13.x) / PX_PER_M_X).toBeCloseTo(2.5, 1);
    expect(set13.y).toBe(std13.y);
    // Their 13 stays where he was: he marks the standard spot, not the tight one.
    expect(a.layout.players.find((p) => p.team === 'defence' && p.number === 13)).toEqual(layout.players.find((p) => p.team === 'defence' && p.number === 13));
    for (let t = 0; t <= 3.2; t += 0.1) expect(positionAt(b.routes['attack-13'], t)).toEqual(positionAt(a.routes['attack-13'], t));
    // Near-straight: about a metre of unders over the run to the gain line.
    const start = positionAt(a.routes['attack-13'], 0);
    const cross = positionAt(a.routes['attack-13'], 3.2);
    expect(Math.abs(cross.x - start.x) / PX_PER_M_X).toBeLessThan(1.5);
    const at = attackersAt(a, 1.7);
    const ten = at.find((p) => p.number === 10)!;
    const thirteen = at.find((p) => p.number === 13)!;
    // 10 has run across toward 13, so the ball is a short one, and it travels behind 12.
    expect(Math.hypot((ten.x - thirteen.x) / PX_PER_M_X, (ten.y - thirteen.y) / PX_PER_M_Y)).toBeLessThan(8);
    const twelve = at.find((p) => p.number === 12)!;
    const u = (twelve.x - ten.x) / (thirteen.x - ten.x);
    const ballY = ten.y + u * (thirteen.y - ten.y);
    expect((ballY - twelve.y) / PX_PER_M_Y, '3 Go: the pass goes through 12').toBeGreaterThan(1);
  });

  it('a defender does not chase a man who has already run past him', () => {
    const over = PLAYS.find((p) => p.id === 'overunder')!.variants[0];
    const layout = phaseLayout({ lane: 'left15', row: 'halfway', openSide: 'right', podMode: 'hidden', defenceMode: 'static' });
    const built = buildPlay(layout, over, 1, acrossScale(phaseGeometry('left15', 'halfway', 'right')));
    const their13At = (t: number) => {
      const at = attackersAt(built, t);
      const ball = ballAt(built, Object.fromEntries(at.map((p) => [p.id, p])), t);
      return defenceAt(built.layout, 'static', 1, t, ball.pos, at, attackersAt(built, Math.max(0, t - TRACK_LAG)), built.routes).find((d) => d.number === 13)!;
    };
    // Our 13 crosses their line at ~3 s, then works 7 m out toward 14 while the ball goes upfield.
    // Their 13 is beaten: he must neither go with him nor get dragged back with the ball.
    const beaten = their13At(3.8);
    for (let t = 4.0; t <= PLAY_DURATION; t += 0.5) {
      const now = their13At(t);
      expect(Math.abs(now.x - beaten.x) / PX_PER_M_X, `their 13 drifted across at ${t}s`).toBeLessThan(0.5);
      expect(Math.abs(now.y - beaten.y) / PX_PER_M_Y, `their 13 moved up or back at ${t}s`).toBeLessThan(0.5);
    }
  });

  it('6 Go: the flanker runs it with forwards on and a blind to hold, otherwise 11', () => {
    const six = PLAYS.find((p) => p.id === '6go')!;
    expect(six.autoVariant!({ podMode: 'pods', narrowBlind: false })).toBe('flanker');
    expect(six.autoVariant!({ podMode: 'tight', narrowBlind: false })).toBe('flanker');
    expect(six.autoVariant!({ podMode: 'pods', narrowBlind: true })).toBe('wing');
    expect(six.autoVariant!({ podMode: 'hidden', narrowBlind: false })).toBe('wing');
    expect(phaseGeometry('left5', 'halfway', 'right').narrowBlind).toBe(true);
    expect(phaseGeometry('left15', 'halfway', 'right').narrowBlind).toBe(false);
  });

  it('defaultOpenSide mirrors for right-hand lanes', () => {
    expect(defaultOpenSide('right5')).toBe('left');
    expect(defaultOpenSide('left5')).toBe('right');
  });
});
