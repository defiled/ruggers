import type { BoardView, Layout, PlayerTuple, Possession, RowId, SideId, Team } from '../board/types';
import { BOARD_W, BOARD_H, PLAYER_R, BALL_R, clamp, tuplesToPlayers } from '../board/constants';
import { ROWS } from './scrumSetups';

/**
 * Lineout generator ported 1:1 from rugbytacticsboard.com. The site builds lineouts
 * procedurally (not from a table): hooker throws from touch, the chosen number of
 * forwards stand in the line 35px apart starting 90px infield, unused forwards sit
 * 10 m back, 9 stands at the receiver position, and the backs use fixed x positions
 * with possession-dependent depth.
 */

export const LINEOUT_SIZES = [3, 4, 5, 6, 7] as const;
export type LineoutSize = (typeof LINEOUT_SIZES)[number];
export const DEFAULT_LINEOUT_SIZE: LineoutSize = 5;

export const SIDES: Array<{ id: SideId; label: string; shortLabel: string; x: number }> = [
  { id: 'left', label: 'Left touchline', shortLabel: 'L', x: 100 },
  { id: 'right', label: 'Right touchline', shortLabel: 'R', x: 1000 },
];

/** Order forwards join the line: 1, 4, 5, 6, 3, 7, 8 (hooker throws, 9 receives). */
const LINE_ORDER = [1, 4, 5, 6, 3, 7, 8];
/** Backs' x measured from the throwing touchline (mirrored for the right side). */
const BACK_X: Record<number, number> = { 10: 330, 11: 435, 12: 480, 13: 630, 14: 960, 15: 760 };
/** Depth below the line of touch for the throwing team's backs. */
/** 10 sits at 118 px (10.3 m) rather than the site's 110 px, which is inside the 10 m offside line. */
const THROW_DEPTH: Record<number, number> = { 10: 118, 11: 180, 12: 150, 13: 200, 14: 140, 15: 220 };
/** Depth above the line of touch for the defending team's backs (negative = upfield). */
const DEFEND_DEPTH: Record<number, number> = { 10: -120, 11: -120, 12: -100, 13: -100, 14: -170, 15: -220 };

function teamTuples(team: Team, role: 'throwing' | 'defending', side: SideId, y: number, size: number): PlayerTuple[] {
  const throwing = role === 'throwing';
  const left = side === 'left';
  const dir = left ? 1 : -1;
  const touchX = left ? 18 : BOARD_W - 18;
  const lineStart = left ? 90 : BOARD_W - 90;
  const lineY = y + (throwing ? 20 : -20);
  const spareY = y + (throwing ? 70 : -70);
  const inLine = LINE_ORDER.slice(0, size);
  const spare = LINE_ORDER.filter((n) => !inLine.includes(n));
  const out = new Map<number, PlayerTuple>();
  out.set(2, [team, 2, touchX, y]);
  out.set(9, [team, 9, lineStart + dir * 25, y + (throwing ? 70 : -80)]);
  inLine.forEach((n, i) => out.set(n, [team, n, lineStart + dir * i * 35, lineY]));
  spare.forEach((n, i) => out.set(n, [team, n, lineStart + dir * (size + i + 1) * 35, spareY]));
  for (const n of [10, 11, 12, 13, 14, 15]) {
    const bx = left ? BACK_X[n] : BOARD_W - BACK_X[n];
    out.set(n, [team, n, bx, y + (throwing ? THROW_DEPTH[n] : DEFEND_DEPTH[n])]);
  }
  return Array.from(out.values()).map(([t, n, x, yy]) => [
    t,
    n,
    clamp(x, PLAYER_R, BOARD_W - PLAYER_R),
    clamp(yy, PLAYER_R, BOARD_H - PLAYER_R),
  ]);
}

export function lineoutLayout(row: RowId, side: SideId, possession: Possession, size: LineoutSize): Layout {
  const rowDef = ROWS.find((r) => r.id === row) ?? ROWS[3];
  const throwingTeam: Team = possession === 'attacking' ? 'attack' : 'defence';
  const defendingTeam: Team = throwingTeam === 'attack' ? 'defence' : 'attack';
  const throwers = teamTuples(throwingTeam, 'throwing', side, rowDef.y, size);
  const defenders = teamTuples(defendingTeam, 'defending', side, rowDef.y, size);
  const all = [...throwers, ...defenders].sort((a, b) =>
    a[0] !== b[0] ? (a[0] === 'attack' ? -1 : 1) : a[1] - b[1],
  );
  const ballX = side === 'left' ? 30 : BOARD_W - 30;
  return {
    boardView: rowDef.boardView as BoardView,
    ball: { x: clamp(ballX, BALL_R, BOARD_W - BALL_R), y: clamp(rowDef.y, BALL_R, BOARD_H - BALL_R) },
    players: tuplesToPlayers(all),
  };
}
