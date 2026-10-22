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

function attackersAt(layout: ReturnType<typeof phaseLayout>, built: ReturnType<typeof buildPlay>, t: number) {
  return layout.players
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
                const at = attackersAt(layout, built, pass.t1);
                const from = at.find((p) => p.number === pass.from)!;
                const to = at.find((p) => p.number === pass.to)!;
                // y grows toward our own try line, so "behind" means to.y >= from.y
                expect(to.y, `${label}: ${pass.from}→${pass.to} is forward`).toBeGreaterThanOrEqual(from.y - 0.5 * PX_PER_M_Y);
                const ball = ballAt(built, Object.fromEntries(at.map((p) => [p.id, p])), pass.t1);
                const defence = defenceAt(layout, mode, dir, pass.t1, ball.pos, at, attackersAt(layout, built, Math.max(0, pass.t1 - TRACK_LAG)));
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
              for (const p of attackersAt(layout, built, t)) {
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

  it('defaultOpenSide mirrors for right-hand lanes', () => {
    expect(defaultOpenSide('right5')).toBe('left');
    expect(defaultOpenSide('left5')).toBe('right');
  });
});
