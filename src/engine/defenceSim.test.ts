import { describe, expect, it } from 'vitest';
import { BOARD_H, BOARD_W, PX_PER_M_Y } from '../board/constants';
import type { LaneId, OpenSide } from '../board/types';
import { DEFENCE_SYSTEMS, type Alignment } from '../data/defenceSystems';
import { LANES } from '../data/scrumSetups';
import { ballAt, positionAt } from './animate';
import { DEF_DURATION, buildScenario, defendersAt } from './defenceSim';

const lanes = LANES.map((l) => l.id as LaneId);
const sides: OpenSide[] = ['left', 'right'];
const alignments: Alignment[] = ['deep', 'standard', 'flat'];

function frameAt(sc: ReturnType<typeof buildScenario>, t: number) {
  const attackers = sc.layout.players.filter((p) => p.team === 'attack').map((p) => ({ ...p, ...positionAt(sc.built.routes[p.id], t) }));
  const ball = ballAt(sc.built, Object.fromEntries(attackers.map((p) => [p.id, p])), t);
  return { attackers, ball, defence: defendersAt(sc, t, ball.pos, attackers, ball.carrier) };
}

describe('defence scenarios', () => {
  for (const system of DEFENCE_SYSTEMS) {
    for (const lane of lanes) {
      for (const side of sides) {
        for (const alignment of alignments) {
          const label = `${system.name} @ ${lane} ${side} ${alignment}`;
          const sc = buildScenario(system.id, lane, side, alignment);

          it(`${label}: 15 defenders stay on the board and never run through an attacker`, () => {
            for (let t = 0; t <= DEF_DURATION; t += 0.5) {
              const { attackers, defence } = frameAt(sc, t);
              expect(defence.players).toHaveLength(15);
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
              const ruckY = sc.layout.ball.y;
              const front = defence.players.filter((d) => ruckY - d.y < 8 * PX_PER_M_Y && ![9, 15].includes(d.number));
              const ys = front.map((d) => d.y);
              const spread = (Math.max(...ys) - Math.min(...ys)) / PX_PER_M_Y;
              expect(spread, `${label}: line spread ${spread.toFixed(1)} m at 1.0s`).toBeLessThanOrEqual(1.6);
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
