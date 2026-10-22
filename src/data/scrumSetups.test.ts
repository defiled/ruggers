import { describe, expect, it } from 'vitest';
import { LANES, ROWS, scrumLayout } from './scrumSetups';
import { LINEOUT_SIZES, SIDES, lineoutLayout } from './lineoutSetups';
import { BOARD_H, BOARD_W, PLAYER_R, PX_PER_M_X, PX_PER_M_Y } from '../board/constants';
import type { Layout } from '../board/types';

const ours = (layout: Layout, n: number) => {
  const p = layout.players.find((q) => q.team === 'attack' && q.number === n);
  if (!p) throw new Error(`attack ${n} missing`);
  return p;
};

/** Metres our player n stands behind our number 8 (the hindmost foot). */
const depth = (layout: Layout, n: number) => (ours(layout, n).y - ours(layout, 8).y) / PX_PER_M_Y;

describe('scrum formations: our attacking backline', () => {
  for (const row of ROWS) {
    for (const lane of LANES) {
      const label = `${row.id}-${lane.id}`;
      const layout = scrumLayout(row.id, lane.id, 'attacking');

      it(`${label}: every back is onside (5 m behind the hindmost foot)`, () => {
        for (const n of [10, 11, 12, 13, 14, 15]) expect(depth(layout, n), `${n}`).toBeGreaterThanOrEqual(5);
      });

      it(`${label}: 10, 12, 13 form a ladder and 15 is the second wave`, () => {
        expect(depth(layout, 12)).toBeGreaterThan(depth(layout, 10));
        expect(depth(layout, 13)).toBeGreaterThan(depth(layout, 12));
        expect(depth(layout, 15)).toBeGreaterThan(depth(layout, 13));
        expect(depth(layout, 15)).toBeGreaterThan(depth(layout, 14));
      });

      it(`${label}: 14 is wider than 13 and inside the touchline`, () => {
        const scrumX = (ours(layout, 1).x + ours(layout, 3).x) / 2;
        const open = Math.sign(ours(layout, 10).x - scrumX);
        expect(open).not.toBe(0);
        expect((ours(layout, 14).x - ours(layout, 13).x) * open).toBeGreaterThan(5 * PX_PER_M_X);
        expect(ours(layout, 14).x).toBeGreaterThanOrEqual(PLAYER_R);
        expect(ours(layout, 14).x).toBeLessThanOrEqual(BOARD_W - PLAYER_R);
      });

      it(`${label}: 11 holds the blind when it is wide enough, else tucks inside 10`, () => {
        const scrumX = (ours(layout, 1).x + ours(layout, 3).x) / 2;
        const open = Math.sign(ours(layout, 10).x - scrumX);
        const blindWidth = (open > 0 ? scrumX - 10 : BOARD_W - 10 - scrumX) / PX_PER_M_X;
        const elevenSide = Math.sign(ours(layout, 11).x - scrumX);
        if (blindWidth >= 12) {
          expect(elevenSide, 'on the blind').toBe(-open);
        } else {
          expect(elevenSide, 'inside 10').toBe(open);
          expect(Math.abs(ours(layout, 11).x - scrumX)).toBeLessThan(Math.abs(ours(layout, 10).x - scrumX));
        }
      });
    }
  }
});

describe('scrum formations: our defending backline', () => {
  for (const row of ROWS) {
    for (const lane of LANES) {
      const label = `${row.id}-${lane.id}`;
      const layout = scrumLayout(row.id, lane.id, 'defending');

      it(`${label}: every back is onside (5 m behind the hindmost foot)`, () => {
        for (const n of [10, 11, 12, 13, 14, 15]) expect(depth(layout, n), `${n}`).toBeGreaterThanOrEqual(5);
      });

      it(`${label}: 15 is at least as deep as every other back (wingers may drop level as back-three cover)`, () => {
        for (const n of [10, 11, 12, 13, 14]) expect(depth(layout, 15), `${n}`).toBeGreaterThanOrEqual(depth(layout, n));
        // At our own 5 m the board edge (the dead-ball area) is the limit on how deep 15 can be drawn.
        const room = (BOARD_H - PLAYER_R - ours(layout, 8).y) / PX_PER_M_Y;
        expect(depth(layout, 15)).toBeGreaterThanOrEqual(Math.min(12, room));
      });
    }
  }
});

describe('lineout formations: throwing team', () => {
  for (const row of ROWS) {
    for (const side of SIDES) {
      for (const size of LINEOUT_SIZES) {
        it(`${row.id}-${side.id}-${size}: 10 is behind the 10 m line`, () => {
          const layout = lineoutLayout(row.id, side.id, 'attacking', size);
          expect((ours(layout, 10).y - layout.ball.y) / PX_PER_M_Y).toBeGreaterThanOrEqual(10);
        });
      }
    }
  }
});
