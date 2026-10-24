import { describe, expect, it } from 'vitest';
import { BOARD_H, BOARD_W, PX_PER_M_X, PX_PER_M_Y } from '../board/constants';
import type { LaneId, OpenSide, PlayerPos } from '../board/types';
import { DEFENCE_SYSTEMS, type Alignment, type DefenceSystemId } from '../data/defenceSystems';
import { LANES } from '../data/scrumSetups';
import { DEF_DURATION, buildScenario, simulate } from './defenceSim';

const lanes = LANES.map((l) => l.id as LaneId);
const sides: OpenSide[] = ['left', 'right'];
const alignments: Alignment[] = ['deep', 'standard', 'flat'];

/** Who is on the board for each system: backs only, as Rugby Slate draws them. */
const CAST_SIZE: Record<DefenceSystemId, number> = { drift: 3, blitz: 4, pendulum: 3, shooter: 4, dogleg: 4 };

const metresApart = (a: PlayerPos, b: PlayerPos) => Math.hypot((a.x - b.x) / PX_PER_M_X, (a.y - b.y) / PX_PER_M_Y);

function frameAt(sc: ReturnType<typeof buildScenario>, t: number) {
  const { attackers, ball, defence } = simulate(sc, t);
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

          if ((system.id === 'blitz' || system.id === 'drift' || system.id === 'shooter') && !narrow) {
            it(`${label}: we make the tackle and the play freezes there`, () => {
              const tk = sc.tackle!;
              expect(tk, `${label}: no tackle`).toBeTruthy();
              expect(tk.at).toBeLessThan(DEF_DURATION);
              const { ball, def, att, defence } = frameAt(sc, DEF_DURATION);
              expect(ball.carrier, `${label}: ball moved on after the tackle`).toBe(tk.carrier);
              expect(defence.badges[def(tk.tackler).id]).toBe('TACKLE');
              expect(metresApart(def(tk.tackler), att(tk.carrier)), `${label}: tackler not on the carrier`).toBeLessThanOrEqual(1.2);
              // The carrier is held where he was tackled, behind the gain line.
              const atTackle = frameAt(sc, tk.at).att(tk.carrier);
              expect(att(tk.carrier)).toEqual(atTackle);
              expect((atTackle.y - sc.layout.ball.y) / PX_PER_M_Y, `${label}: tackle not behind the gain line`).toBeGreaterThan(1.5);
              const expected: Record<string, { tackler: number; carriers: number[] }> = {
                drift: { tackler: 13, carriers: [14] },
                blitz: { tackler: tk.carrier, carriers: [10, 12, 13] },
                shooter: { tackler: 12, carriers: [12] },
              };
              expect(tk.tackler).toBe(expected[system.id].tackler);
              expect(expected[system.id].carriers).toContain(tk.carrier);
            });
          }

          if (system.id === 'dogleg' || system.id === 'pendulum') {
            it(`${label}: no tackle`, () => {
              expect(sc.tackle).toBeUndefined();
            });
          }

          if ((system.id === 'blitz' || system.id === 'drift') && !narrow) {
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

            it(`${label}: three defenders against five attackers, and nobody moves faster than a sprint`, () => {
              expect(sc.layout.players.filter((p) => p.team === 'attack')).toHaveLength(5);
              expect(sc.layout.players.filter((p) => p.team === 'defence')).toHaveLength(3);
              let prev = frameAt(sc, 0).defence.players;
              for (let t = 0.25; t <= DEF_DURATION; t += 0.25) {
                const now = frameAt(sc, t).defence.players;
                for (const d of now) {
                  const was = prev.find((p) => p.id === d.id)!;
                  const lateral = Math.abs(d.x - was.x) / PX_PER_M_X / 0.25;
                  expect(lateral, `${label}: ${d.id} slid at ${lateral.toFixed(1)} m/s at ${t}s`).toBeLessThanOrEqual(8);
                }
                prev = now;
              }
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
                  expect((lineY - near.y) / PX_PER_M_Y, `${label}: near winger not up at ${t}s`).toBeLessThanOrEqual(2.5);
                  expect((lineY - near.y) / PX_PER_M_Y, `${label}: near winger on or over the line at ${t}s`).toBeGreaterThanOrEqual(1);
                  expect((lineY - far.y) / PX_PER_M_Y, `${label}: far winger not deep at ${t}s`).toBeGreaterThanOrEqual(5);
                }
                for (const d of frameAt(sc, t).defence.players) expect([11, 14, 15], `${label}: ${d.id} should not be in the pendulum`).toContain(d.number);
                expect(frameAt(sc, t).defence.routes?.[0]?.points, `${label}: pendulum line missing at ${t}s`).toHaveLength(3);
                expect(def(15).x, `${label}: 15 outside the wingers at ${t}s`).toBeGreaterThan(Math.min(left.x, right.x));
                expect(def(15).x, `${label}: 15 outside the wingers at ${t}s`).toBeLessThan(Math.max(left.x, right.x));
                expect(def(15).y, `${label}: 15 not behind the wingers at ${t}s`).toBeLessThan(Math.min(left.y, right.y));
              }
            });
          }

          if (system.id === 'shooter' && !narrow) {
            it(`${label}: our 12 shoots on the pass and hits their 12 as he catches, while 10 and 13 hold the line`, () => {
              const catchAt = sc.built.variant.passes[1].t1;
              expect(frameAt(sc, 0.9).defence.badges['defence-12'], `${label}: shot before the pass`).toBeUndefined();
              expect(frameAt(sc, catchAt - 0.2).defence.badges['defence-12']).toBe('SHOOT');
              const { def, att } = frameAt(sc, catchAt + 0.7);
              expect(metresApart(def(12), att(12)), `${label}: shooter did not get to 12`).toBeLessThanOrEqual(2);
              expect((att(12).y - sc.layout.ball.y) / PX_PER_M_Y, `${label}: 12 not behind the gain line`).toBeGreaterThan(1.5);
              const shooterStartX = sc.layout.players.find((p) => p.id === 'defence-12')!.x;
              for (const n of [10, 13]) {
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

            it(`${label}: both options are drawn in front of the runner, then he takes the inside gap`, () => {
              if (narrow) return;
              const mid = frameAt(sc, 1.5);
              expect(mid.defence.routes?.map((r) => r.id).sort()).toEqual(['option-inside', 'option-outside']);
              expect(mid.defence.markers?.map((m) => m.label).sort()).toEqual(['INSIDE', 'OUTSIDE']);
              const later = frameAt(sc, 2.3);
              expect(later.defence.routes?.map((r) => r.id)).toEqual(['option-inside']);
              // He crosses the gain line inside (ruck side of) the late defender.
              for (let t = 1.8; t <= DEF_DURATION; t += 0.1) {
                const f = frameAt(sc, t);
                if (f.att(12).y <= sc.layout.ball.y) {
                  const late = f.defence.players.find((d) => f.defence.badges[d.id] === 'LATE')!;
                  expect((late.x - f.att(12).x) * dir, `${label}: 12 did not go inside the late man`).toBeGreaterThan(PX_PER_M_X);
                  break;
                }
              }
            });
          }
        }
      }
    }
  }
});
