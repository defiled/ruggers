import { describe, expect, it } from 'vitest';
import { BOARD_H, BOARD_W, PX_PER_M_X, PX_PER_M_Y } from '../board/constants';
import type { LaneId, OpenSide, PlayerPos } from '../board/types';
import { DEFENCE_SYSTEMS, type Alignment, type DefenceSystemId } from '../data/defenceSystems';
import { LANES } from '../data/scrumSetups';
import { ballAt, positionAt } from './animate';
import { DEF_DURATION, buildScenario, defendersAt } from './defenceSim';

const lanes = LANES.map((l) => l.id as LaneId);
const sides: OpenSide[] = ['left', 'right'];
const alignments: Alignment[] = ['deep', 'standard', 'flat'];

/** Who is on the board for each system: backs only, as Rugby Slate draws them. */
const CAST_SIZE: Record<DefenceSystemId, number> = { drift: 3, blitz: 4, pendulum: 4, shooter: 4, dogleg: 4 };

const metresApart = (a: PlayerPos, b: PlayerPos) => Math.hypot((a.x - b.x) / PX_PER_M_X, (a.y - b.y) / PX_PER_M_Y);

function frameAt(sc: ReturnType<typeof buildScenario>, t: number) {
  const attackers = sc.layout.players.filter((p) => p.team === 'attack').map((p) => ({ ...p, ...positionAt(sc.built.routes[p.id], t) }));
  const ball = sc.ballPath ? { pos: positionAt(sc.ballPath, t), carrier: null, inFlight: false } : ballAt(sc.built, Object.fromEntries(attackers.map((p) => [p.id, p])), t);
  const defence = defendersAt(sc, t, ball.pos, attackers, ball.carrier);
  const def = (n: number) => defence.players.find((d) => d.number === n)!;
  const att = (n: number) => attackers.find((a) => a.number === n)!;
  return { attackers, ball, defence, def, att };
}

describe('defence scenarios', () => {
  expect(DEFENCE_SYSTEMS.map((s) => s.id)).toEqual(['drift', 'blitz', 'pendulum', 'shooter', 'dogleg']);

  for (const system of DEFENCE_SYSTEMS) {
    for (const lane of lanes) {
      for (const side of sides) {
        for (const alignment of alignments) {
          const label = `${system.name} @ ${lane} ${side} ${alignment}`;
          const sc = buildScenario(system.id, lane, side, alignment);
          const dir = sc.dir;
          // A 5 m lane attacking into its own 5 m side has no room for a backline; the UI does not offer it.
          const narrow = sc.geometry.openWidth < 12;

          it(`${label}: the cast stays on the board and never runs through an attacker`, () => {
            for (let t = 0; t <= DEF_DURATION; t += 0.5) {
              const { attackers, defence } = frameAt(sc, t);
              expect(defence.players).toHaveLength(CAST_SIZE[system.id]);
              for (const d of defence.players) {
                expect(d.x).toBeGreaterThanOrEqual(0);
                expect(d.x).toBeLessThanOrEqual(BOARD_W);
                expect(d.y).toBeGreaterThanOrEqual(0);
                expect(d.y).toBeLessThanOrEqual(BOARD_H);
                const start = sc.layout.players.find((p) => p.id === d.id)!;
                for (const a of attackers) {
                  // Only attackers still in front of where the defender started count; a runner who has
                  // broken past a defender leaves him standing, which is the point of the dog-leg demo.
                  if (Math.abs(a.x - d.x) < 10 && a.y > start.y) expect(d.y, `${label}: ${d.id} ran through ${a.id} at ${t}s`).toBeLessThan(a.y + 4);
                }
              }
            }
          });

          if (system.id === 'blitz' || system.id === 'drift') {
            it(`${label}: the front line comes up together`, () => {
              const { defence } = frameAt(sc, 1.0);
              const ys = defence.players.map((d) => d.y);
              const spread = (Math.max(...ys) - Math.min(...ys)) / PX_PER_M_Y;
              expect(spread, `${label}: line spread ${spread.toFixed(1)} m at 1.0s`).toBeLessThanOrEqual(1.6);
            });
          }

          if (system.id === 'drift' && !narrow) {
            it(`${label}: defenders slide out gently, keep their spacing and finish on their men`, () => {
              let prev: Record<string, number> | null = null;
              for (let t = 0; t <= DEF_DURATION; t += 0.25) {
                const { defence, def } = frameAt(sc, t);
                for (const a of defence.players) {
                  for (const b of defence.players) {
                    if (a.id < b.id) expect(metresApart(a, b), `${label}: ${a.id} and ${b.id} piled up at ${t}s`).toBeGreaterThanOrEqual(2);
                  }
                }
                expect((def(12).x - def(10).x) * dir, `${label}: 10 and 12 swapped at ${t}s`).toBeGreaterThan(0);
                expect((def(13).x - def(12).x) * dir, `${label}: 12 and 13 swapped at ${t}s`).toBeGreaterThan(0);
                const now = Object.fromEntries(defence.players.map((d) => [d.id, d.x]));
                if (prev) {
                  for (const id of Object.keys(now)) {
                    expect((now[id] - prev[id]) * dir, `${label}: ${id} slid back toward the ruck at ${t}s`).toBeGreaterThanOrEqual(-0.5 * PX_PER_M_X);
                  }
                }
                prev = now;
              }
              const end = frameAt(sc, DEF_DURATION);
              expect(Math.abs(end.def(13).x - end.att(14).x) / PX_PER_M_X, `${label}: 13 did not get to 14`).toBeLessThanOrEqual(3);
            });
          }

          if (system.id === 'pendulum') {
            it(`${label}: the ball-side winger is up, the far winger is deep, 15 is between them`, () => {
              const lineY = sc.defensiveLineY;
              for (let t = 0; t <= DEF_DURATION; t += 0.25) {
                const { ball, def } = frameAt(sc, t);
                const left = dir === 1 ? def(11) : def(14);
                const right = dir === 1 ? def(14) : def(11);
                const fromLeft = (ball.pos.x - 10) / PX_PER_M_X;
                const fromRight = (BOARD_W - 10 - ball.pos.x) / PX_PER_M_X;
                const near = fromLeft < 15 ? left : fromRight < 15 ? right : null;
                const far = near === left ? right : near === right ? left : null;
                if (near && far) {
                  expect((lineY - near.y) / PX_PER_M_Y, `${label}: near winger not up at ${t}s`).toBeLessThanOrEqual(2);
                  expect((lineY - far.y) / PX_PER_M_Y, `${label}: far winger not deep at ${t}s`).toBeGreaterThanOrEqual(5);
                }
                expect(def(15).x, `${label}: 15 outside the wingers at ${t}s`).toBeGreaterThan(Math.min(left.x, right.x));
                expect(def(15).x, `${label}: 15 outside the wingers at ${t}s`).toBeLessThan(Math.max(left.x, right.x));
                expect(def(15).y, `${label}: 15 not behind the wingers at ${t}s`).toBeLessThan(Math.min(left.y, right.y));
              }
            });
          }

          if (system.id === 'shooter' && !narrow) {
            it(`${label}: the shooter hits the first receiver behind the gain line while 12 and 13 hold the line`, () => {
              const { def, att, defence } = frameAt(sc, 2.2);
              expect(defence.badges[def(10).id]).toBe('SHOOT');
              expect(metresApart(def(10), att(10)), `${label}: shooter did not get to 10`).toBeLessThanOrEqual(2);
              expect((att(10).y - sc.layout.ball.y) / PX_PER_M_Y, `${label}: 10 not behind the gain line`).toBeGreaterThan(1.5);
              const shooterStartX = sc.layout.players.find((p) => p.id === 'defence-10')!.x;
              for (const n of [12, 13]) {
                // They drift slightly in to fill his channel, but never close more than 40 % of the gap.
                const gap0 = Math.abs(sc.layout.players.find((p) => p.id === `defence-${n}`)!.x - shooterStartX);
                expect(Math.abs(def(n).x - shooterStartX), `${label}: ${n} chased the shooter`).toBeGreaterThanOrEqual(gap0 * 0.6);
              }
            });
          }

          if (system.id === 'dogleg') {
            it(`${label}: the late defender is behind the line`, () => {
              const { defence } = frameAt(sc, 1.5);
              const late = defence.players.find((d) => defence.badges[d.id] === 'LATE')!;
              expect(late).toBeTruthy();
              const neighbours = defence.players.filter((d) => d.id !== late.id && Math.abs(d.x - late.x) < 10 * 15 && Math.abs(d.y - late.y) < 10 * PX_PER_M_Y);
              const ahead = neighbours.filter((d) => d.y - late.y > 2 * PX_PER_M_Y);
              expect(ahead.length, `${label}: nobody ahead of the late man`).toBeGreaterThan(0);
            });
          }
        }
      }
    }
  }
});
