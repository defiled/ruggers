import { describe, expect, it } from 'vitest';
import { BOARD_H, BOARD_W, PX_PER_M_X, PX_PER_M_Y } from '../board/constants';
import type { LaneId, OpenSide } from '../board/types';
import { defaultOpenSide, phaseLayout } from '../data/phaseFormation';
import { LANES } from '../data/scrumSetups';
import { PLAYS, PLAY_DURATION } from '../data/plays';
import { ballAt, buildPlay, defenceAt, positionAt } from './animate';

/**
 * Every play, in every lane and both directions, must obey the coaching principles:
 *  - no forward passes (receiver level with or behind the passer at the catch);
 *  - every catch at least 2.5 m behind the nearest front-line defender (drift defence);
 *  - the strike runner's first second after the catch is steep (dy:dx >= 2.5) and no other
 *    non-lateral runner angles more than ~35° off straight;
 *  - nobody runs off the board.
 */

const lanes = LANES.map((l) => l.id as LaneId);
const sides: OpenSide[] = ['left', 'right'];

function attackersAt(layout: ReturnType<typeof phaseLayout>, built: ReturnType<typeof buildPlay>, t: number) {
  return layout.players
    .filter((p) => p.team === 'attack')
    .map((p) => ({ ...p, ...positionAt(built.routes[p.id], t) }));
}

describe('play library', () => {
  for (const play of PLAYS) {
    for (const variant of play.variants) {
      for (const lane of lanes) {
        for (const openSide of sides) {
          const label = `${play.name} / ${variant.label} @ ${lane} ${openSide}`;
          const dir: 1 | -1 = openSide === 'right' ? 1 : -1;
          const layout = phaseLayout({ lane, row: 'halfway', openSide, podMode: 'pods', defenceMode: 'drift' });
          const built = buildPlay(layout, variant, dir);

          it(`${label}: passes are backward and caught behind the defence`, () => {
            for (const pass of variant.passes) {
              const at = attackersAt(layout, built, pass.t1);
              const from = at.find((p) => p.number === pass.from)!;
              const to = at.find((p) => p.number === pass.to)!;
              // y grows toward our own try line, so "behind" means to.y >= from.y
              expect(to.y, `${label}: ${pass.from}→${pass.to} is forward`).toBeGreaterThanOrEqual(from.y - 0.5 * PX_PER_M_Y);
              const ball = ballAt(built, Object.fromEntries(at.map((p) => [p.id, p])), pass.t1);
              const defence = defenceAt(layout, 'drift', dir, pass.t1, ball.pos, at);
              const nearest = defence
                .filter((d) => d.number !== 15 && d.number !== 9 && Math.abs(d.x - to.x) < 6 * PX_PER_M_X)
                .reduce((best, d) => Math.max(best, d.y), -Infinity);
              const gapM = (to.y - nearest) / PX_PER_M_Y;
              expect(gapM, `${label}: ${pass.to} catches only ${gapM.toFixed(1)} m from the line`).toBeGreaterThanOrEqual(2.5);
            }
          });

          it(`${label}: strike runner is steep after the catch`, () => {
            const catchPass = variant.passes.find((p) => p.to === variant.strike);
            if (!catchPass) return;
            const frames = built.routes[`attack-${variant.strike}`];
            const a = positionAt(frames, catchPass.t1);
            const b = positionAt(frames, Math.min(PLAY_DURATION, catchPass.t1 + 1));
            const dxM = Math.abs(b.x - a.x) / PX_PER_M_X;
            const dyM = (a.y - b.y) / PX_PER_M_Y;
            expect(dyM, `${label}: strike runner not going forward`).toBeGreaterThan(2);
            expect(dyM / Math.max(dxM, 0.01), `${label}: strike line too lateral (${dyM.toFixed(1)} up / ${dxM.toFixed(1)} across)`).toBeGreaterThanOrEqual(2.5);
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
                // Approach segments of a cut may angle in at up to ~35°; the strike line after the catch is checked at 2.5:1 above.
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
