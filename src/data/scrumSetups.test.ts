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

const theirs = (layout: Layout, n: number) => {
  const p = layout.players.find((q) => q.team === 'defence' && q.number === n);
  if (!p) throw new Error(`defence ${n} missing`);
  return p;
};

describe('scrum formations: their ball', () => {
  for (const row of ROWS) {
    for (const lane of LANES) {
      const label = `${row.id}-${lane.id}`;
      const layout = scrumLayout(row.id, lane.id, 'defending');
      const scrumX = (ours(layout, 1).x + ours(layout, 3).x) / 2;

      it(`${label}: our backs are onside and flat, 15 deep`, () => {
        for (const n of [10, 11, 12, 13, 14]) expect(depth(layout, n), `${n}`).toBeGreaterThanOrEqual(5);
        for (const n of [10, 12, 13, 14]) expect(depth(layout, n), `${n} flat`).toBeLessThan(7);
        const room = (BOARD_H - PLAYER_R - ours(layout, 8).y) / PX_PER_M_Y;
        expect(depth(layout, 15)).toBeGreaterThanOrEqual(Math.min(12, room));
      });

      it(`${label}: our 10, 12, 13 and 14 stand opposite theirs`, () => {
        for (const n of [10, 12, 13]) expect(Math.abs(ours(layout, n).x - theirs(layout, n).x) / PX_PER_M_X, `${n}`).toBeLessThan(1);
        expect(Math.abs(ours(layout, 14).x - theirs(layout, 14).x) / PX_PER_M_X).toBeLessThan(2);
      });

      it(`${label}: their backs form the attacking ladder, upfield of their 8`, () => {
        const up = (n: number) => (theirs(layout, 8).y - theirs(layout, n).y) / PX_PER_M_Y;
        for (const n of [10, 11, 12, 13, 14, 15]) expect(up(n), `${n}`).toBeGreaterThanOrEqual(5);
        // At our opposition 5 m their backs are on their own try line, so the board edge flattens the ladder.
        expect(up(12)).toBeGreaterThanOrEqual(up(10));
        expect(up(13)).toBeGreaterThanOrEqual(up(12));
        expect(up(15)).toBeGreaterThanOrEqual(up(13));
      });

      it(`${label}: our 11 holds the blind when it is wide enough, else sits inside 10`, () => {
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

describe('scrum formations: our ball, their defence', () => {
  for (const lane of LANES) {
    it(`halfway-${lane.id}: their 10, 12, 13 line up opposite ours, flat and onside`, () => {
      const layout = scrumLayout('halfway', lane.id, 'attacking');
      for (const n of [10, 12, 13]) {
        expect(Math.abs(ours(layout, n).x - theirs(layout, n).x) / PX_PER_M_X, `${n}`).toBeLessThan(1);
        expect((theirs(layout, 8).y - theirs(layout, n).y) / PX_PER_M_Y, `${n} onside`).toBeGreaterThanOrEqual(5);
      }
    });
  }
});

describe('lineout formations: throwing team', () => {
  for (const row of ROWS) {
    for (const side of SIDES) {
      for (const size of LINEOUT_SIZES) {
        it(`${row.id}-${side.id}-${size}: 10 is behind the 10 m line and 11 is inside 10`, () => {
          const layout = lineoutLayout(row.id, side.id, 'attacking', size);
          expect((ours(layout, 10).y - layout.ball.y) / PX_PER_M_Y).toBeGreaterThanOrEqual(10);
          const touchX = side.id === 'left' ? 10 : BOARD_W - 10;
          expect(Math.abs(ours(layout, 11).x - touchX)).toBeLessThan(Math.abs(ours(layout, 10).x - touchX));
        });
      }
    }
  }
});
